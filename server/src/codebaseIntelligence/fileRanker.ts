import { prisma } from "../db/client";
import { logger } from "../utils/logger";
import { codebaseQueryService } from "./queryService";
import {
  CHUNK_FETCH_THRESHOLD,
  ENGINEERING_CHUNK_FETCH_THRESHOLD,
  FILE_WORK_THRESHOLD,
  RETRIEVAL_CHUNK_TOP_K,
  RETRIEVAL_WORK_FILES_TOP_N,
  SCORE_WEIGHTS,
} from "./retrievalConfig";
import { resolveRepoScope } from "./repoScope";
import { detectPatternTags } from "./patternTags";
import { getCodebaseThresholdOffset } from "../rag/retrievalLearning";

const prismaAny = prisma as any;

export type ChangeScope = "modify" | "create_new" | "context_only";

export interface WorkFileHit {
  path: string;
  changeScope: "modify" | "create_new";
  score: number;
  matchReasons: string[];
  bestChunk?: string;
  summary?: string;
}

export interface AggregatedFileHit {
  path: string;
  score: number;
  matchReasons: string[];
  bestChunk: string;
  bestChunkIndex: number;
  summary?: string;
  patterns: string[];
  indexed: boolean;
  changeScope: ChangeScope;
}

export interface ChunkSearchRow {
  file_path?: string;
  path?: string;
  chunk_content?: string;
  chunk_index?: number;
  similarity?: number;
  summary?: string;
}

function parsePatterns(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((p): p is string => typeof p === "string");
  return [];
}

function ticketMentionsTests(text: string): boolean {
  return /\btest(s)?\b|\bspec\b|\bcoverage\b|\be2e\b/i.test(text);
}

function ticketMentionsConfig(text: string): boolean {
  return /\bconfig\b|\benv\b|\bsettings\b/i.test(text);
}

function hasContextOnlyPattern(patterns: string[]): boolean {
  return patterns.some((p) => p === "test" || p === "config" || p === "utility");
}

export function aggregateChunksToFiles(
  chunks: ChunkSearchRow[],
  query: string,
  patternTags: string[] = detectPatternTags(query)
): Omit<AggregatedFileHit, "indexed" | "changeScope" | "summary" | "patterns">[] {
  const byPath = new Map<
    string,
    { score: number; bestChunk: string; bestChunkIndex: number; matchReasons: Set<string> }
  >();

  for (const row of chunks) {
    const path = row.file_path ?? row.path;
    if (!path || path === "unknown") continue;
    const similarity = row.similarity ?? 0;
    const chunkIndex = row.chunk_index ?? 0;
    const existing = byPath.get(path);

    const reasons = new Set<string>(["semantic"]);
    if (chunkIndex === 0) reasons.add("header_chunk");

    if (!existing || similarity > existing.score) {
      byPath.set(path, {
        score: similarity,
        bestChunk: (row.chunk_content ?? "").slice(0, 400),
        bestChunkIndex: chunkIndex,
        matchReasons: reasons,
      });
    } else {
      for (const r of reasons) existing.matchReasons.add(r);
      if (similarity > existing.score * 0.95) {
        existing.score = Math.max(existing.score, similarity);
      }
    }
  }

  const q = query.toLowerCase();
  return [...byPath.entries()].map(([path, data]) => {
    const matchReasons = [...data.matchReasons];
    let score = data.score * SCORE_WEIGHTS.semantic;

    if (data.bestChunkIndex === 0) score += SCORE_WEIGHTS.headerChunk;
    if (patternTags.length > 0) {
      const pathLower = path.toLowerCase();
      if (patternTags.some((tag) => pathLower.includes(tag.replace(/-/g, "")))) {
        score += SCORE_WEIGHTS.patternTag;
        matchReasons.push("pattern_path");
      }
    }
    if (q && path.toLowerCase().includes(q.split(/\s+/)[0] ?? "")) {
      score += SCORE_WEIGHTS.keyword;
      matchReasons.push("keyword_path");
    }

    return {
      path,
      score: Math.min(score, 1),
      matchReasons,
      bestChunk: data.bestChunk,
      bestChunkIndex: data.bestChunkIndex,
    };
  });
}

export function classifyChangeScope(
  hit: Omit<AggregatedFileHit, "changeScope">,
  opts: {
    topModifyScore: number;
    ticketText: string;
    indexed: boolean;
    patterns: string[];
    workThreshold?: number;
  }
): ChangeScope {
  const { topModifyScore, ticketText, indexed, patterns } = opts;
  const workThreshold = opts.workThreshold ?? FILE_WORK_THRESHOLD;

  if (
    hasContextOnlyPattern(patterns) &&
    !ticketMentionsTests(ticketText) &&
    !ticketMentionsConfig(ticketText) &&
    hit.score < topModifyScore * 0.85
  ) {
    return "context_only";
  }

  if (hit.score < workThreshold) {
    return "context_only";
  }

  if (indexed) {
    return "modify";
  }

  return "create_new";
}

async function loadFileMetadata(
  paths: string[],
  branchName: string
): Promise<
  Map<string, { summary: string | null; patterns: string[]; indexed: boolean }>
> {
  const scope = resolveRepoScope();
  const map = new Map<string, { summary: string | null; patterns: string[]; indexed: boolean }>();
  if (!scope || paths.length === 0) return map;

  const rows = await prismaAny.codebaseFile.findMany({
    where: {
      repoOwner: scope.repoOwner,
      repoName: scope.repoName,
      branchName,
      filePath: { in: paths },
      isDeleted: false,
    },
    select: { filePath: true, summary: true, patterns: true },
  });

  for (const row of rows) {
    map.set(row.filePath, {
      summary: row.summary,
      patterns: parsePatterns(row.patterns),
      indexed: true,
    });
  }
  return map;
}

/** Semantic search for the engineering coding agent — no work-threshold filter. */
export async function searchCodebaseForEngineering(input: {
  query: string;
  branchName: string;
  topN?: number;
}): Promise<WorkFileHit[]> {
  const query = input.query.trim();
  if (!query) return [];

  let chunks: ChunkSearchRow[] = [];
  try {
    chunks = await codebaseQueryService.searchCodebaseSemantically({
      query,
      branchName: input.branchName,
      topK: RETRIEVAL_CHUNK_TOP_K,
      similarityThreshold: ENGINEERING_CHUNK_FETCH_THRESHOLD,
    });
  } catch (err) {
    logger.warn({ err }, "searchCodebaseForEngineering failed");
    return [];
  }

  const aggregated = aggregateChunksToFiles(chunks, query);
  aggregated.sort((a, b) => b.score - a.score);

  const paths = aggregated.map((a) => a.path);
  const meta = await loadFileMetadata(paths, input.branchName);

  return aggregated.slice(0, input.topN ?? RETRIEVAL_WORK_FILES_TOP_N).map(
    (hit): WorkFileHit => ({
      path: hit.path,
      changeScope: meta.get(hit.path)?.indexed ? "modify" : "create_new",
      score: hit.score,
      matchReasons: hit.matchReasons,
      bestChunk: hit.bestChunk,
      summary: meta.get(hit.path)?.summary ?? undefined,
    })
  );
}

export async function searchWorkFiles(input: {
  query: string;
  branchName: string;
  ticketText?: string;
  components?: string[];
  topN?: number;
}): Promise<WorkFileHit[]> {
  const query = input.query.trim();
  if (!query) return [];

  let chunks: ChunkSearchRow[] = [];
  try {
    chunks = await codebaseQueryService.searchCodebaseSemantically({
      query,
      branchName: input.branchName,
      topK: RETRIEVAL_CHUNK_TOP_K,
      similarityThreshold: CHUNK_FETCH_THRESHOLD,
    });
  } catch (err) {
    logger.warn({ err }, "searchWorkFiles semantic search failed");
    return [];
  }

  const aggregated = aggregateChunksToFiles(chunks, query);
  aggregated.sort((a, b) => b.score - a.score);

  const paths = aggregated.map((a) => a.path);
  const meta = await loadFileMetadata(paths, input.branchName);
  const ticketText = input.ticketText ?? query;
  const workThreshold =
    FILE_WORK_THRESHOLD + getCodebaseThresholdOffset(input.components ?? []);

  const withScope: AggregatedFileHit[] = aggregated.map((hit) => {
    const fileMeta = meta.get(hit.path);
    const patterns = fileMeta?.patterns ?? [];
    const indexed = fileMeta?.indexed ?? false;
    return {
      ...hit,
      summary: fileMeta?.summary ?? undefined,
      patterns,
      indexed,
      changeScope: "context_only" as ChangeScope,
    };
  });

  const topModifyScore =
    withScope.find((h) => h.indexed && h.score >= workThreshold)?.score ?? 0;

  for (const hit of withScope) {
    hit.changeScope = classifyChangeScope(hit, {
      topModifyScore: topModifyScore || hit.score,
      ticketText,
      indexed: hit.indexed,
      patterns: hit.patterns,
      workThreshold,
    });
  }

  const workFiles = withScope
    .filter((h) => h.changeScope === "modify" || h.changeScope === "create_new")
    .slice(0, input.topN ?? RETRIEVAL_WORK_FILES_TOP_N)
    .map(
      (h): WorkFileHit => ({
        path: h.path,
        changeScope: h.changeScope as "modify" | "create_new",
        score: h.score,
        matchReasons: h.matchReasons,
        bestChunk: h.bestChunk,
        summary: h.summary,
      })
    );

  if (workFiles.length > 0) {
    logger.info(
      {
        query: query.slice(0, 80),
        workFileCount: workFiles.length,
        topScore: workFiles[0]?.score,
        scopes: workFiles.map((f) => f.changeScope),
      },
      "searchWorkFiles ranked"
    );
  }

  return workFiles;
}

export async function mergeWorkFileResults(
  resultSets: WorkFileHit[][]
): Promise<WorkFileHit[]> {
  const byPath = new Map<string, WorkFileHit>();
  for (const set of resultSets) {
    for (const hit of set) {
      const existing = byPath.get(hit.path);
      if (!existing || hit.score > existing.score) {
        byPath.set(hit.path, {
          ...hit,
          matchReasons: [...new Set([...(existing?.matchReasons ?? []), ...hit.matchReasons])],
        });
      }
    }
  }
  return [...byPath.values()].sort((a, b) => b.score - a.score);
}

export function formatWorkFilesList(files: WorkFileHit[]): string {
  if (files.length === 0) {
    return "No candidate files to change (index may be empty or query too narrow)";
  }
  return files
    .map((f) => {
      const prefix = f.changeScope === "create_new" ? "+ " : "~ ";
      const label = f.changeScope === "create_new" ? "new file" : "modify";
      const reasons = f.matchReasons.length ? ` [${f.matchReasons.join(", ")}]` : "";
      const summary = f.summary ? `\n  Summary: ${f.summary}` : "";
      return `${prefix}${f.path} (${label}, score ${f.score.toFixed(2)})${reasons}${summary}`;
    })
    .join("\n\n");
}
