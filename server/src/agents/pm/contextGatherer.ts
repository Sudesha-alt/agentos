import { prisma } from "../../db/client";
import {
  formatWorkFilesList,
  searchCodebaseWithExpandedQueries,
} from "../../codebaseIntelligence/searchService";
import { expandTicketQueries } from "../../codebaseIntelligence/queryExpander";
import { resolveRepoScope } from "../../codebaseIntelligence/repoScope";
import { getJiraIssueByKey } from "../../jira-sync/issueRepository";
import { getPipelineJiraClient } from "../../pipeline/jira/client";
import { retriever } from "../../rag/retriever";
import { jiraTool } from "../../tools/jiraTool";
import { logger } from "../../utils/logger";
import { companyIntelligence } from "../../companyIntelligence";
import type { PmTicketInput } from "./types";

export interface PmContextBundle {
  reporterTier: string;
  similarTicketsList: string;
  componentBugCount: string;
  okrList: string;
  companyContextBlock: string;
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
}

function inferReporterTier(labels: string[], reporter: string): string {
  const joined = [...labels, reporter].join(" ").toLowerCase();
  if (/enterprise|ent-|vip|strategic/.test(joined)) return "enterprise";
  if (/paid|pro|team|business/.test(joined)) return "paid";
  if (/free|trial|hobby/.test(joined)) return "free";
  return "paid";
}

function syncedIssueToPmInput(
  row: Awaited<ReturnType<typeof getJiraIssueByKey>>
): PmTicketInput | null {
  if (!row) return null;
  const labels = Array.isArray(row.labels) ? (row.labels as string[]) : [];
  const components = Array.isArray(row.components)
    ? (row.components as string[])
    : [];
  return {
    jiraKey: row.jiraKey,
    summary: row.summary,
    description: row.description,
    issueType: row.issueType,
    reporter: row.reporter ?? "Unknown",
    labels,
    components,
    createdDate: row.jiraUpdatedAt?.toISOString() ?? row.createdAt.toISOString(),
    priority: row.priority ?? "Medium",
  };
}

async function fetchJiraIssue(jiraKey: string): Promise<PmTicketInput | null> {
  try {
    const synced = await getJiraIssueByKey(jiraKey);
    const fromSync = syncedIssueToPmInput(synced);
    if (fromSync) return fromSync;
  } catch {
    /* fall through to live Jira */
  }

  try {
    const issue = (await getPipelineJiraClient().getIssue(jiraKey)) as {
      key?: string;
      fields?: Record<string, unknown>;
    };
    const fields = issue.fields ?? {};
    const status = fields.status as { name?: string } | undefined;
    const issuetype = fields.issuetype as { name?: string } | undefined;
    const reporter = fields.reporter as { displayName?: string } | undefined;
    const priority = fields.priority as { name?: string } | undefined;
    const labels = (fields.labels as string[] | undefined) ?? [];
    const components =
      (fields.components as Array<{ name?: string }> | undefined)?.map(
        (c) => c.name ?? ""
      ) ?? [];
    const created = fields.created as string | undefined;
    const description =
      typeof fields.description === "string"
        ? fields.description
        : JSON.stringify(fields.description ?? "");

    return {
      jiraKey: issue.key ?? jiraKey,
      summary: String(fields.summary ?? ""),
      description,
      issueType: issuetype?.name ?? "Task",
      reporter: reporter?.displayName ?? "Unknown",
      labels,
      components: components.filter(Boolean),
      createdDate: created ?? new Date().toISOString(),
      priority: priority?.name ?? "Medium",
    };
  } catch (err) {
    logger.warn({ err, jiraKey }, "pm context: Jira fetch failed");
    return null;
  }
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
    const ticketText = [ticket.summary, ticket.description, ...ticket.components]
      .filter(Boolean)
      .join(" ");

    const queries = await expandTicketQueries({
      summary: ticket.summary,
      description: ticket.description,
      components: ticket.components,
    });

    const workFiles = await searchCodebaseWithExpandedQueries({
      queries,
      branchName,
      ticketText,
      topN: 10,
    });

    if (workFiles.length === 0) {
      return {
        list: "No candidate files to change (index may be empty or query too narrow)",
        paths: [],
      };
    }

    const paths = workFiles.map((f) => f.path);
    const list = formatWorkFilesList(workFiles);
    return { list, paths };
  } catch (err) {
    logger.warn({ err }, "pm context: codebase search failed");
    return { list: "Codebase search unavailable", paths: [] };
  }
}

async function buildSimilarTicketsList(ticket: PmTicketInput): Promise<string> {
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
      return ragHits
        .map((hit) => {
          const snippet = hit.content.replace(/\s+/g, " ").slice(0, 120);
          const source = hit.metadata.source === "keyword_fallback" ? "keyword" : "semantic";
          return `${hit.jiraKey} [${hit.contentType}, ${source}, sim=${hit.similarity.toFixed(2)}]: ${snippet}`;
        })
        .join("\n");
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
      return localMatches
        .map((t) => `${t.jiraKey}: ${t.summary} (${t.status}, synced)`)
        .join("; ");
    }

    const related = await jiraTool.fetchRelated({
      jiraKey: ticket.jiraKey,
      relationshipTypes: ["linked", "same_components", "epic_children"],
    });
    if (related.tickets.length > 0) {
      return related.tickets
        .slice(0, 8)
        .map((t) => `${t.key}: ${t.summary} (${t.status}, ${t.relationship})`)
        .join("; ");
    }

    return "none found";
  } catch {
    return "unavailable (retrieval failed)";
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
        topK: 4,
        similarityThreshold: 0.65,
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
    };
  }

  const fromJira = await fetchJiraIssue(jiraKey);
  if (fromJira) return fromJira;

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
  };
}

export async function gatherPmContext(
  ticket: PmTicketInput
): Promise<PmContextBundle> {
  const scope = resolveRepoScope();
  const branchName = scope?.defaultBranch ?? "main";

  let similarTicketsList = "none found";
  similarTicketsList = await buildSimilarTicketsList(ticket);

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
  };
}
