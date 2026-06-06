import { codebaseQueryService } from "./queryService";
import { prisma } from "../db/client";
import { requireRepoScope } from "./repoScope";

const prismaAny = prisma as any;

export const KNOWN_PATTERN_TAGS = [
  "api-route",
  "database-query",
  "auth",
  "test",
  "service-layer",
  "ui-component",
  "utility",
  "module",
] as const;

export type PatternTag = (typeof KNOWN_PATTERN_TAGS)[number];

export interface UnifiedSearchFileHit {
  path: string;
  score: number;
  snippet: string;
  summary?: string;
}

export interface UnifiedSearchPatternHit {
  pattern: string;
  files: Array<{ path: string; summary?: string }>;
}

export interface UnifiedSearchResult {
  query: string;
  files: UnifiedSearchFileHit[];
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

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

function detectPatternTags(query: string): string[] {
  const q = normalizeQuery(query);
  const tags: string[] = [];

  for (const tag of KNOWN_PATTERN_TAGS) {
    if (q === tag || q.includes(tag) || q.replace(/\s+/g, "-") === tag) {
      tags.push(tag);
    }
  }

  if (/\bapi\b|\broute\b|\bendpoint\b/.test(q) && !tags.includes("api-route")) {
    tags.push("api-route");
  }
  if (/\bdatabase\b|\bquery\b|\bprisma\b|\bsql\b/.test(q) && !tags.includes("database-query")) {
    tags.push("database-query");
  }
  if (/\bauth\b|\blogin\b|\bjwt\b|\bsession\b/.test(q) && !tags.includes("auth")) {
    tags.push("auth");
  }
  if (/\btest\b|\bspec\b|\bdescribe\b/.test(q) && !tags.includes("test")) {
    tags.push("test");
  }

  return [...new Set(tags)];
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

export async function searchCodebase(input: {
  query: string;
  branchName: string;
}): Promise<UnifiedSearchResult> {
  const query = input.query.trim();
  if (!query) {
    return { query: "", files: [], patterns: [], results: [] };
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
      query,
      branchName: input.branchName,
      topK: 8,
      similarityThreshold: 0.65,
    });
  } catch {
    semanticRaw = [];
  }

  const files: UnifiedSearchFileHit[] = semanticRaw.map((hit) => {
    const path = hit.file_path ?? hit.path ?? "unknown";
    return {
      path,
      score: hit.similarity ?? 0,
      snippet: (hit.chunk_content ?? hit.summary ?? "").slice(0, 280),
      summary: hit.summary,
    };
  }).filter((f) => f.path !== "unknown");

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
    patterns,
    concepts: concepts.length ? concepts : undefined,
    results: files,
  };
}
