import { codebaseQueryService } from "../codebaseIntelligence/queryService";
import { searchWorkFiles } from "../codebaseIntelligence/fileRanker";
import { CHUNK_FETCH_THRESHOLD, RETRIEVAL_CHUNK_TOP_K } from "../codebaseIntelligence/retrievalConfig";
import { resolveRepoScope } from "../codebaseIntelligence/repoScope";
import type { RetrievedContext, VectorContentType } from "../types/pipeline";
import { logger } from "../utils/logger";
import { getBoostedPatternTags } from "./retrievalLearning";
import { retriever, RETRIEVAL_CONFIGS } from "./retriever";

export interface UnifiedRetrieveOptions {
  ticketTypes?: readonly VectorContentType[];
  codebase?: { branchName?: string; topK?: number; similarityThreshold?: number };
  includeCodebase?: boolean;
  /** When false (default), codebase hits are work files only (modify/create_new). */
  includeContext?: boolean;
  topKTotal?: number;
  currentJiraKey: string;
  queryComponents?: string[];
  similarityThreshold?: number;
}

export interface UnifiedContextItem {
  kind: "ticket" | "codebase";
  jiraKey?: string;
  filePath?: string;
  contentType?: VectorContentType;
  content: string;
  similarity: number;
  rerankScore: number;
  metadata: Record<string, unknown>;
}

export interface UnifiedRetrievalResult {
  items: UnifiedContextItem[];
  fusedBlock: string;
  retrievedContext: RetrievedContext[];
}

interface RawCandidate {
  kind: "ticket" | "codebase";
  jiraKey?: string;
  filePath?: string;
  contentType?: VectorContentType;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
  embeddedAt?: string;
}

interface CodebaseSearchRow {
  file_path?: string;
  filePath?: string;
  chunk_content?: string;
  content?: string;
  summary?: string;
  similarity?: number;
}

export const unifiedRetriever = {
  async retrieveUnified(
    query: string,
    options: UnifiedRetrieveOptions
  ): Promise<UnifiedRetrievalResult> {
    const scope = resolveRepoScope();
    const branchName =
      options.codebase?.branchName ?? scope?.defaultBranch ?? "main";
    const topKTotal = options.topKTotal ?? 12;
    const ticketTypes =
      options.ticketTypes ?? RETRIEVAL_CONFIGS.ENGINEERING_AGENT.contentTypes;
    const includeCodebase = options.includeCodebase !== false;

    const boostedQuery = appendBoostedTerms(query, options.queryComponents ?? []);

    const codebasePromise =
      includeCodebase && !options.includeContext
        ? searchWorkFiles({
            query: boostedQuery,
            branchName,
            topN: options.codebase?.topK ?? 10,
          })
            .then((workFiles) =>
              workFiles.map(
                (wf): CodebaseSearchRow => ({
                  file_path: wf.path,
                  similarity: wf.score,
                  chunk_content: wf.bestChunk,
                  summary: wf.summary,
                })
              )
            )
            .catch((err) => {
              logger.warn({ err }, "unified retriever work-file search failed");
              return [] as CodebaseSearchRow[];
            })
        : includeCodebase
          ? codebaseQueryService
              .searchCodebaseSemantically({
                query: boostedQuery,
                branchName,
                topK: options.codebase?.topK ?? RETRIEVAL_CHUNK_TOP_K,
                similarityThreshold:
                  options.codebase?.similarityThreshold ?? CHUNK_FETCH_THRESHOLD,
              })
              .catch((err) => {
                logger.warn({ err }, "unified retriever codebase search failed");
                return [] as CodebaseSearchRow[];
              })
          : Promise.resolve([] as CodebaseSearchRow[]);

    const [ticketResults, codebaseRows] = await Promise.all([
      retriever.retrieve(boostedQuery, {
        contentTypes: ticketTypes,
        topK: topKTotal,
        similarityThreshold:
          options.similarityThreshold ??
          RETRIEVAL_CONFIGS.ENGINEERING_AGENT.similarityThreshold,
        currentJiraKey: options.currentJiraKey,
        queryComponents: options.queryComponents,
      }),
      codebasePromise,
    ]);

    const candidates: RawCandidate[] = [
      ...ticketResults.map((t) => ({
        kind: "ticket" as const,
        jiraKey: t.jiraKey,
        contentType: t.contentType,
        content: t.content,
        similarity: normalizeScore(t.similarity, "ticket"),
        metadata: { ...t.metadata, source: t.source ?? "vector" },
        embeddedAt:
          typeof t.metadata.embeddedAt === "string"
            ? t.metadata.embeddedAt
            : undefined,
      })),
      ...codebaseRows.map((row: CodebaseSearchRow) => {
        const filePath = String(row.file_path ?? row.filePath ?? "unknown");
        const chunkContent = String(row.chunk_content ?? row.content ?? "");
        const summary = String(row.summary ?? "");
        return {
          kind: "codebase" as const,
          filePath,
          content: summary
            ? `FILE: ${filePath}\nSUMMARY: ${summary}\n${chunkContent.slice(0, 600)}`
            : `FILE: ${filePath}\n${chunkContent.slice(0, 800)}`,
          similarity: normalizeScore(Number(row.similarity ?? 0), "codebase"),
          metadata: { source: "codebase_embeddings", branchName },
        };
      }),
    ];

    const reranked = rerankCandidates(
      candidates,
      query,
      options.queryComponents ?? []
    ).slice(0, topKTotal);

    const items: UnifiedContextItem[] = reranked.map((c) => ({
      kind: c.kind,
      jiraKey: c.jiraKey,
      filePath: c.filePath,
      contentType: c.contentType,
      content: c.content,
      similarity: c.similarity,
      rerankScore: c.rerankScore,
      metadata: c.metadata,
    }));

    const retrievedContext: RetrievedContext[] = items
      .filter((i) => i.kind === "ticket" && i.jiraKey && i.contentType)
      .map((i) => ({
        jiraTicketId: String(i.jiraKey),
        jiraKey: i.jiraKey!,
        contentType: i.contentType!,
        content: i.content,
        similarity: i.rerankScore,
        metadata: i.metadata,
      }));

    const fusedBlock = formatFusedBlock(items);

    logger.info(
      {
        ticketHits: ticketResults.length,
        codebaseHits: codebaseRows.length,
        fusedCount: items.length,
      },
      "unified retrieval complete"
    );

    return { items, fusedBlock, retrievedContext };
  },
};

function appendBoostedTerms(query: string, components: string[]): string {
  const boosts = getBoostedPatternTags(components);
  if (boosts.length === 0) return query;
  return `${query} ${boosts.join(" ")}`.trim();
}

function normalizeScore(raw: number, source: "ticket" | "codebase"): number {
  const clamped = Math.max(0, Math.min(1, raw));
  if (source === "codebase" && clamped < 0.5) {
    return clamped + 0.05;
  }
  return clamped;
}

function rerankCandidates(
  candidates: RawCandidate[],
  query: string,
  queryComponents: string[]
): Array<RawCandidate & { rerankScore: number }> {
  const queryLower = query.toLowerCase();

  return candidates
    .map((c) => {
      let score = 0.6 * c.similarity;

      const age = getAgeInDays(c.embeddedAt ?? c.metadata.embeddedAt);
      if (age < 30) score += 0.2 * 0.1;
      else if (age < 90) score += 0.2 * 0.05;

      if (c.kind === "ticket") {
        if (c.contentType === "prd") score += 0.2 * 0.15;
        if (c.contentType === "implementation") score += 0.2 * 0.12;
        if (c.contentType === "canary_finding") score += 0.2 * 0.1;
        if (c.contentType === "ticket") score += 0.2 * 0.08;
      } else {
        score += 0.2 * 0.1;
      }

      const contentLower = c.content.toLowerCase();
      if (
        queryComponents.some(
          (comp) =>
            contentLower.includes(comp.toLowerCase()) ||
            String(c.metadata.components ?? "")
              .toLowerCase()
              .includes(comp.toLowerCase())
        )
      ) {
        score += 0.03;
      }

      if (
        queryLower
          .split(/\s+/)
          .filter((w) => w.length > 4)
          .some((w) => contentLower.includes(w))
      ) {
        score += 0.01;
      }

      return { ...c, rerankScore: Math.min(score, 1) };
    })
    .sort((a, b) => b.rerankScore - a.rerankScore);
}

function getAgeInDays(value: unknown): number {
  if (typeof value !== "string") return Number.POSITIVE_INFINITY;
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  return (Date.now() - then) / (1000 * 60 * 60 * 24);
}

function formatFusedBlock(items: UnifiedContextItem[]): string {
  if (items.length === 0) return "No unified retrieval results.";

  return items
    .map((item, idx) => {
      const header =
        item.kind === "codebase"
          ? `[${idx + 1}] CODE ${item.filePath} (score ${item.rerankScore.toFixed(3)})`
          : `[${idx + 1}] ${item.jiraKey} / ${item.contentType} (score ${item.rerankScore.toFixed(3)})`;
      const snippet = item.content.slice(0, 900);
      return `${header}\n${snippet}`;
    })
    .join("\n\n");
}
