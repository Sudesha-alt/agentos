import { codebaseQueryService } from "./queryService";
import { prisma } from "../db/client";
import { requireRepoScope } from "./repoScope";
import {
  formatWorkFilesList,
  mergeWorkFileResults,
  searchWorkFiles,
  type WorkFileHit,
} from "./fileRanker";
import { detectPatternTags, KNOWN_PATTERN_TAGS } from "./patternTags";
import {
  CHUNK_FETCH_THRESHOLD,
  FILE_PRESENT_THRESHOLD,
  RETRIEVAL_CHUNK_TOP_K,
} from "./retrievalConfig";

export { KNOWN_PATTERN_TAGS, detectPatternTags };
export type { PatternTag } from "./patternTags";
export type { WorkFileHit };

const prismaAny = prisma as any;

export interface UnifiedSearchFileHit {
  path: string;
  score: number;
  snippet: string;
  summary?: string;
  matchReasons?: string[];
  changeScope?: "modify" | "create_new" | "context_only";
}

export interface UnifiedSearchPatternHit {
  pattern: string;
  files: Array<{ path: string; summary?: string }>;
}

export interface UnifiedSearchResult {
  query: string;
  files: UnifiedSearchFileHit[];
  workFiles: WorkFileHit[];
  patterns: UnifiedSearchPatternHit[];
  concepts?: Array<{ label: string; paths: string[] }>;
  /** Flat list for backward compatibility with older clients */
  results: UnifiedSearchFileHit[];
}

function parsePatterns(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((p): p is string => typeof p === "string");
  }
  return [];
}

async function getFilesMatchingPatterns(
  patternTags: string[],
  branchName: string
): Promise<UnifiedSearchPatternHit[]> {
  if (patternTags.length === 0) return [];

  const { repoOwner, repoName } = requireRepoScope();
  const rows = await prismaAny.codebaseFile.findMany({
    where: {
      repoOwner,
      repoName,
      branchName,
      isDeleted: false,
    },
    select: {
      filePath: true,
      summary: true,
      patterns: true,
    },
    take: 500,
  });

  const hits: UnifiedSearchPatternHit[] = [];

  for (const tag of patternTags) {
    const matched = rows
      .filter((row: { patterns: unknown }) => parsePatterns(row.patterns).includes(tag))
      .slice(0, 12)
      .map((row: { filePath: string; summary: string | null }) => ({
        path: row.filePath,
        summary: row.summary ?? undefined,
      }));

    if (matched.length > 0) {
      hits.push({ pattern: tag, files: matched });
    }
  }

  return hits;
}

function buildConceptGroupings(files: UnifiedSearchFileHit[]): Array<{ label: string; paths: string[] }> {
  if (files.length < 3) return [];

  const byTopDir = new Map<string, string[]>();
  for (const f of files) {
    const top = f.path.split("/")[0] ?? "root";
    const list = byTopDir.get(top) ?? [];
    list.push(f.path);
    byTopDir.set(top, list);
  }

  return [...byTopDir.entries()]
    .filter(([, paths]) => paths.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 2)
    .map(([label, paths]) => ({ label, paths }));
}

export async function searchCodebaseFiles(input: {
  query: string;
  branchName: string;
  ticketText?: string;
  includeContext?: boolean;
  topN?: number;
}): Promise<{ workFiles: WorkFileHit[]; allFiles: UnifiedSearchFileHit[] }> {
  const workFiles = await searchWorkFiles({
    query: input.query,
    branchName: input.branchName,
    ticketText: input.ticketText,
    topN: input.topN,
  });

  if (!input.includeContext) {
    return {
      workFiles,
      allFiles: workFiles.map((f) => ({
        path: f.path,
        score: f.score,
        snippet: f.bestChunk ?? "",
        summary: f.summary,
        matchReasons: f.matchReasons,
        changeScope: f.changeScope,
      })),
    };
  }

  let semanticRaw: Array<{
    file_path?: string;
    path?: string;
    similarity?: number;
    chunk_content?: string;
    summary?: string;
  }> = [];

  try {
    semanticRaw = await codebaseQueryService.searchCodebaseSemantically({
      query: input.query,
      branchName: input.branchName,
      topK: RETRIEVAL_CHUNK_TOP_K,
      similarityThreshold: CHUNK_FETCH_THRESHOLD,
    });
  } catch {
    semanticRaw = [];
  }

  const allFiles: UnifiedSearchFileHit[] = semanticRaw
    .map((hit) => {
      const path = hit.file_path ?? hit.path ?? "unknown";
      const score = hit.similarity ?? 0;
      return {
        path,
        score,
        snippet: (hit.chunk_content ?? hit.summary ?? "").slice(0, 280),
        summary: hit.summary,
        changeScope:
          score >= FILE_PRESENT_THRESHOLD
            ? ("modify" as const)
            : ("context_only" as const),
      };
    })
    .filter((f) => f.path !== "unknown");

  return { workFiles, allFiles };
}

export async function searchCodebase(input: {
  query: string;
  branchName: string;
  ticketText?: string;
  includeContext?: boolean;
}): Promise<UnifiedSearchResult> {
  const query = input.query.trim();
  if (!query) {
    return { query: "", files: [], workFiles: [], patterns: [], results: [] };
  }

  const { workFiles, allFiles } = await searchCodebaseFiles({
    query,
    branchName: input.branchName,
    ticketText: input.ticketText,
    includeContext: input.includeContext,
  });

  const files: UnifiedSearchFileHit[] =
    input.includeContext && allFiles.length > 0
      ? allFiles
      : workFiles.map((f) => ({
          path: f.path,
          score: f.score,
          snippet: f.bestChunk ?? "",
          summary: f.summary,
          matchReasons: f.matchReasons,
          changeScope: f.changeScope,
        }));

  const patternTags = detectPatternTags(query);
  let patterns = await getFilesMatchingPatterns(patternTags, input.branchName);

  if (patterns.length === 0 && patternTags.length === 0) {
    const keywordHits = await codebaseQueryService.getFilesTouchingFeature(query, input.branchName);
    const keywordPatterns = new Map<string, Array<{ path: string; summary?: string }>>();

    for (const row of keywordHits.slice(0, 20)) {
      for (const tag of parsePatterns(row.patterns)) {
        const list = keywordPatterns.get(tag) ?? [];
        if (list.length < 8) {
          list.push({ path: row.filePath, summary: row.summary ?? undefined });
          keywordPatterns.set(tag, list);
        }
      }
    }

    patterns = [...keywordPatterns.entries()]
      .slice(0, 3)
      .map(([pattern, patternFiles]) => ({ pattern, files: patternFiles }));
  }

  const concepts = buildConceptGroupings(files);

  return {
    query,
    files,
    workFiles,
    patterns,
    concepts: concepts.length ? concepts : undefined,
    results: files,
  };
}

export async function searchCodebaseWithExpandedQueries(input: {
  queries: string[];
  branchName: string;
  ticketText?: string;
  topN?: number;
}): Promise<WorkFileHit[]> {
  const sets = await Promise.all(
    input.queries.map((query) =>
      searchWorkFiles({
        query,
        branchName: input.branchName,
        ticketText: input.ticketText,
        topN: input.topN ?? 10,
      })
    )
  );
  return (await mergeWorkFileResults(sets)).slice(0, input.topN ?? 10);
}

export { formatWorkFilesList };
