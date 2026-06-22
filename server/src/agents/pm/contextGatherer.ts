import { prisma } from "../../db/client";
import {
  buildEnrichedCodebaseContext,
} from "../../codebaseIntelligence/enrichedContextService";
import { resolveRepoScope } from "../../codebaseIntelligence/repoScope";
import { TICKET_RETRIEVAL_CONFIGS } from "../../codebaseIntelligence/retrievalConfig";
import { retriever } from "../../rag/retriever";
import { jiraTool } from "../../tools/jiraTool";
import { logger } from "../../utils/logger";
import { companyIntelligence } from "../../companyIntelligence";
import type { PmTicketInput, SynthesisSummary } from "./types";
import { enrichTicketFromJira } from "./ticketEnrichment";
import type { RetrievalResult } from "../../rag/retriever";

export interface PmContextBundle {
  reporterTier: string;
  similarTicketsList: string;
  componentBugCount: string;
  okrList: string;
  companyContextBlock: string;
  companyName: string;
  companyWebsite: string;
  companyProductSummary: string;
  companyIcp: string;
  companyRevenueModel: string;
  linkedPrs: string;
  candidateFilesList: string;
  relevantCommitHistory: string;
  affectedComponents: string;
  churnRate: string;
  testCoverage: string;
  recentCommitSummary: string;
  capacityRemaining: string;
  inflightCount: string;
  branchName: string;
  /** Structured synthesis computed from RAG hits — for enrichedPrdDocument */
  synthesisSummary: SynthesisSummary;
  /** Full content of top prd/implementation RAG hits — for {{similar_past_work}} prompt block */
  similarPastWork: Array<{ jiraKey: string; contentType: string; similarity: number; content: string; summary?: string }>;
}

function inferReporterTier(labels: string[], reporter: string): string {
  const joined = [...labels, reporter].join(" ").toLowerCase();
  if (/enterprise|ent-|vip|strategic/.test(joined)) return "enterprise";
  if (/paid|pro|team|business/.test(joined)) return "paid";
  if (/free|trial|hobby/.test(joined)) return "free";
  return "paid";
}

async function countComponentBugs(
  jiraKey: string,
  components: string[]
): Promise<string> {
  if (components.length === 0) return "unknown (no components on ticket)";
  try {
    const related = await jiraTool.fetchRelated({
      jiraKey,
      relationshipTypes: ["same_components"],
    });

    const bugLike = related.tickets.filter(
      (t) => /bug/i.test(t.type) && !/done|closed|resolved/i.test(t.status)
    );
    return bugLike.length > 0
      ? `${bugLike.length} open bug-like tickets sharing components`
      : "0 open bug-like tickets found for shared components";
  } catch {
    return "unknown (Jira unavailable)";
  }
}

async function fetchLinkedPrs(jiraKey: string): Promise<string> {
  try {
    const rows = await prisma.branchState.findMany({
      where: { jiraKey },
      take: 5,
      orderBy: { updatedAt: "desc" },
    });
    if (rows.length === 0) return "none found";
    return rows
      .map((r) => {
        const pr = r.prUrl ? ` PR ${r.prUrl}` : "";
        return `${r.branchName} (${r.prStatus ?? "open"})${pr}`;
      })
      .join("; ");
  } catch {
    return "unknown";
  }
}

async function fetchCommitHistory(
  filePaths: string[],
  branchName: string
): Promise<string> {
  if (filePaths.length === 0) return "none";
  try {
    const scope = resolveRepoScope();
    if (!scope) return "none (repo not configured)";

    const commits = await prisma.commitHistory.findMany({
      where: {
        repoOwner: scope.repoOwner,
        repoName: scope.repoName,
        branchName,
      },
      orderBy: { authoredAt: "desc" },
      take: 8,
    });

    const relevant = commits.filter((c) => {
      const modified = [
        ...(Array.isArray(c.filesModified) ? c.filesModified : []),
        ...(Array.isArray(c.filesAdded) ? c.filesAdded : []),
      ] as string[];
      return modified.some((f) =>
        filePaths.some((p) => f.includes(p) || p.includes(f))
      );
    });

    const list = (relevant.length ? relevant : commits).slice(0, 5);
    if (list.length === 0) return "none";

    return list
      .map(
        (c) =>
          `${c.sha.slice(0, 7)} | ${c.author} | ${c.authoredAt.toISOString().slice(0, 10)} | ${c.message.slice(0, 120)}`
      )
      .join("\n");
  } catch {
    return "unknown";
  }
}

async function buildCandidateFilesList(
  ticket: PmTicketInput,
  branchName: string
): Promise<{ list: string; paths: string[] }> {
  try {
    const ticketText = [
      ticket.summary,
      ticket.description,
      ticket.attachmentsText,
      ...ticket.components,
    ]
      .filter(Boolean)
      .join(" ");

    const bundle = await buildEnrichedCodebaseContext({
      query: [ticket.summary, ...ticket.components].join(" "),
      branchName,
      ticketText,
      components: ticket.components,
      topN: 10,
    });

    if (bundle.workFiles.length === 0) {
      return {
        list: "No candidate files to change (index may be empty or query too narrow)",
        paths: [],
      };
    }

    const paths = bundle.workFiles.map((f) => f.path);
    return { list: bundle.formatted, paths };
  } catch (err) {
    logger.warn({ err }, "pm context: codebase search failed");
    return { list: "Codebase search unavailable", paths: [] };
  }
}

const FAILURE_SIGNAL_RE = /bug|fail|broke|broken|crash|error|regression|incident|outage|defect/i;
const SIMILARITY_BORDERLINE_THRESHOLD = 0.62;

function computeSynthesisSummary(
  ragHits: RetrievalResult[],
  similarPastWork: Array<{ jiraKey: string; contentType: string; similarity: number; content: string; summary?: string }>
): SynthesisSummary {
  const total = ragHits.length;
  if (total === 0) {
    return { historicalCoverage: 0, reusedPatterns: [], knownFailures: [], impliedRequirements: [], blockingGaps: 0 };
  }

  const deepHits = ragHits.filter(
    (h) => h.contentType === "prd" || h.contentType === "implementation"
  );
  const historicalCoverage = parseFloat((deepHits.length / total).toFixed(2));

  const reusedPatterns = similarPastWork
    .filter((h) => h.contentType === "implementation")
    .map((h) => {
      const firstLine = h.content.split("\n").find((l) => l.trim().length > 10) ?? h.summary ?? h.jiraKey;
      return `${h.jiraKey}: ${firstLine.slice(0, 120).trim()}`;
    })
    .slice(0, 5);

  const knownFailures = ragHits
    .filter((h) => {
      const text = [h.content, h.metadata?.summary ?? ""].join(" ");
      return FAILURE_SIGNAL_RE.test(text);
    })
    .map((h) => {
      const label = h.metadata?.summary ?? h.content.slice(0, 80).trim();
      return `${h.jiraKey}: ${label}`;
    })
    .slice(0, 5);

  const impliedRequirements = ragHits
    .filter((h) => h.contentType === "prd" && h.similarity >= 0.7)
    .map((h) => {
      const line = h.content.split("\n").find((l) => l.trim().length > 20) ?? "";
      return line.slice(0, 120).trim();
    })
    .filter(Boolean)
    .slice(0, 5);

  const blockingGaps = ragHits.filter(
    (h) => h.similarity < SIMILARITY_BORDERLINE_THRESHOLD
  ).length;

  return { historicalCoverage, reusedPatterns, knownFailures, impliedRequirements, blockingGaps };
}

interface SimilarTicketsResult {
  list: string;
  synthesisSummary: SynthesisSummary;
  similarPastWork: Array<{ jiraKey: string; contentType: string; similarity: number; content: string; summary?: string }>;
}

async function buildSimilarTicketsList(ticket: PmTicketInput): Promise<SimilarTicketsResult> {
  const empty: SimilarTicketsResult = {
    list: "none found",
    synthesisSummary: { historicalCoverage: 0, reusedPatterns: [], knownFailures: [], impliedRequirements: [], blockingGaps: 0 },
    similarPastWork: [],
  };

  try {
    const ragHits = await retriever.retrieveForPmAgent(
      {
        summary: ticket.summary,
        description: ticket.description,
        components: ticket.components,
      },
      ticket.jiraKey
    );

    if (ragHits.length > 0) {
      // Full content for prd/implementation hits — these feed the {{similar_past_work}} block
      const similarPastWork = ragHits
        .filter((h) => h.contentType === "prd" || h.contentType === "implementation")
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 6)
        .map((h) => ({
          jiraKey: h.jiraKey,
          contentType: h.contentType,
          similarity: h.similarity,
          content: h.content,
          summary: typeof h.metadata?.summary === "string" ? h.metadata.summary : undefined,
        }));

      const list = ragHits
        .map((hit) => {
          // Extended snippet for prd/implementation hits; brief for others
          const maxLen = hit.contentType === "prd" || hit.contentType === "implementation" ? 400 : 120;
          const snippet = hit.content.replace(/\s+/g, " ").slice(0, maxLen);
          const source = hit.metadata?.source === "keyword_fallback" ? "keyword" : "semantic";
          return `${hit.jiraKey} [${hit.contentType}, ${source}, sim=${hit.similarity.toFixed(2)}]: ${snippet}`;
        })
        .join("\n");

      return {
        list,
        synthesisSummary: computeSynthesisSummary(ragHits, similarPastWork),
        similarPastWork,
      };
    }

    const { listJiraIssues } = await import("../../jira-sync/issueRepository");
    const componentFilter = ticket.components[0];
    const local = await listJiraIssues({
      q: componentFilter || ticket.summary.split(" ")[0],
      limit: 8,
    });
    const localMatches = local.items
      .filter((i) => i.jiraKey !== ticket.jiraKey)
      .slice(0, 5);
    if (localMatches.length > 0) {
      return {
        ...empty,
        list: localMatches
          .map((t) => `${t.jiraKey}: ${t.summary} (${t.status}, synced)`)
          .join("; "),
      };
    }

    const related = await jiraTool.fetchRelated({
      jiraKey: ticket.jiraKey,
      relationshipTypes: ["linked", "same_components", "epic_children"],
    });
    if (related.tickets.length > 0) {
      return {
        ...empty,
        list: related.tickets
          .slice(0, 8)
          .map((t) => `${t.key}: ${t.summary} (${t.status}, ${t.relationship})`)
          .join("; "),
      };
    }

    return empty;
  } catch {
    return { ...empty, list: "unavailable (retrieval failed)" };
  }
}

async function mergeImplementationContext(
  ticket: PmTicketInput,
  codebaseList: string
): Promise<string> {
  try {
    const implHits = await retriever.retrieve(
      [ticket.summary, ...ticket.components].join(" "),
      {
        contentTypes: ["implementation"],
        topK: TICKET_RETRIEVAL_CONFIGS.IMPLEMENTATION_CONTEXT.topK,
        similarityThreshold: TICKET_RETRIEVAL_CONFIGS.IMPLEMENTATION_CONTEXT.similarityThreshold,
        currentJiraKey: ticket.jiraKey,
        queryComponents: ticket.components,
      }
    );

    if (implHits.length === 0) return codebaseList;

    const implBlock = implHits
      .map(
        (hit) =>
          `- ${hit.jiraKey} (sim=${hit.similarity.toFixed(2)}): ${hit.content.slice(0, 300)}`
      )
      .join("\n");

    return `${codebaseList}\n\nPast implementation plans (semantic retrieval):\n${implBlock}`;
  } catch {
    return codebaseList;
  }
}
async function fetchInflightCount(): Promise<string> {
  try {
    const count = await prisma.pipeline.count({
      where: { status: "RUNNING" },
    });
    return String(count);
  } catch {
    return "unknown";
  }
}

export async function resolveTicketInput(
  jiraKey: string,
  raw?: Partial<PmTicketInput>
): Promise<PmTicketInput> {
  const fromJira = await enrichTicketFromJira(jiraKey);
  if (fromJira) {
    return {
      ...fromJira,
      ...raw,
      jiraKey: raw?.jiraKey ?? fromJira.jiraKey,
      summary: raw?.summary?.trim() ? raw.summary : fromJira.summary,
      description: raw?.description?.trim() ? raw.description : fromJira.description,
      issueType: raw?.issueType ?? fromJira.issueType,
      reporter: raw?.reporter ?? fromJira.reporter,
      labels: raw?.labels?.length ? raw.labels : fromJira.labels,
      components: raw?.components?.length ? raw.components : fromJira.components,
      createdDate: raw?.createdDate ?? fromJira.createdDate,
      priority: raw?.priority ?? fromJira.priority,
      commentsText: fromJira.commentsText,
      attachmentsText: fromJira.attachmentsText,
      status: fromJira.status,
      assignee: fromJira.assignee,
    };
  }

  if (raw?.summary) {
    return {
      jiraKey: raw.jiraKey ?? jiraKey,
      summary: raw.summary,
      description: raw.description ?? "",
      issueType: raw.issueType ?? "Task",
      reporter: raw.reporter ?? "Unknown",
      labels: raw.labels ?? [],
      components: raw.components ?? [],
      createdDate: raw.createdDate ?? new Date().toISOString(),
      priority: raw.priority ?? "Medium",
      commentsText: raw.commentsText ?? "No comments on ticket.",
      attachmentsText: raw.attachmentsText ?? "No file attachments on this Jira ticket.",
      status: raw.status,
      assignee: raw.assignee,
    };
  }

  return {
    jiraKey,
    summary: `Ticket ${jiraKey}`,
    description: "No description available — Jira not connected or ticket not found.",
    issueType: "Task",
    reporter: "Unknown",
    labels: [],
    components: [],
    createdDate: new Date().toISOString(),
    priority: "Medium",
    commentsText: "No comments on ticket.",
    attachmentsText: "No file attachments on this Jira ticket.",
  };
}

export async function gatherPmContext(
  ticket: PmTicketInput
): Promise<PmContextBundle> {
  const scope = resolveRepoScope();
  const branchName = scope?.defaultBranch ?? "main";

  const {
    list: similarTicketsList,
    synthesisSummary,
    similarPastWork,
  } = await buildSimilarTicketsList(ticket);

  const { list: candidateFilesListRaw, paths } = await buildCandidateFilesList(
    ticket,
    branchName
  );
  const candidateFilesList = await mergeImplementationContext(
    ticket,
    candidateFilesListRaw
  );
  const relevantCommitHistory = await fetchCommitHistory(paths, branchName);

  const reporterTier = inferReporterTier(ticket.labels, ticket.reporter);
  const componentBugCount = await countComponentBugs(ticket.jiraKey, ticket.components);
  const linkedPrs = await fetchLinkedPrs(ticket.jiraKey);
  const inflightCount = await fetchInflightCount();

  let companyProfile;
  try {
    companyProfile = await companyIntelligence.getProfile();
  } catch {
    companyProfile = null;
  }
  const companyContextBlock = companyIntelligence.toPromptBlock(companyProfile);
  const okrList =
    companyProfile?.strategicGoals?.length
      ? companyProfile.strategicGoals.join("; ")
      : "not configured — set company intelligence in workspace settings";

  return {
    reporterTier,
    similarTicketsList,
    componentBugCount,
    okrList,
    companyContextBlock,
    companyName: companyProfile?.companyName?.trim() ?? "",
    companyWebsite: companyProfile?.website?.trim() ?? "",
    companyProductSummary: companyProfile?.productSummary?.trim() ?? "",
    companyIcp: companyProfile?.icp?.trim() ?? "",
    companyRevenueModel: companyProfile?.revenueModel?.trim() ?? "",
    linkedPrs,
    candidateFilesList,
    relevantCommitHistory,
    affectedComponents: ticket.components.join(", ") || "none specified",
    churnRate: "unknown (per-file churn not indexed)",
    testCoverage: "unknown (per-file coverage not indexed)",
    recentCommitSummary: relevantCommitHistory.split("\n")[0] ?? "none",
    capacityRemaining: "40% (mock — connect sprint tooling for live data)",
    inflightCount,
    branchName,
    synthesisSummary,
    similarPastWork,
  };
}
