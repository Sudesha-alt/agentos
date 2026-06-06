import { prisma } from "../db/client";
import { resolveRepoScope } from "./repoScope";

const prismaAny = prisma as any;

const HIGHLIGHT_LIMIT = 40;
const PATTERN_SAMPLE_LIMIT = 2000;

export type CodebaseInsights = {
  repo: { owner: string; name: string; branch: string } | null;
  totals: { files: number; withSummary: number };
  languages: Array<{ language: string; count: number }>;
  patterns: Array<{ pattern: string; count: number }>;
  topDirectories: Array<{ path: string; fileCount: number }>;
  highlights: Array<{
    path: string;
    language: string | null;
    summary: string | null;
    patterns: string[];
    size: number;
  }>;
};

export async function getCodebaseInsights(branchName = "main"): Promise<CodebaseInsights> {
  const scope = resolveRepoScope();
  if (!scope) {
    return {
      repo: null,
      totals: { files: 0, withSummary: 0 },
      languages: [],
      patterns: [],
      topDirectories: [],
      highlights: [],
    };
  }

  const where = {
    repoOwner: scope.repoOwner,
    repoName: scope.repoName,
    branchName,
    isDeleted: false,
  };

  const [totalFiles, withSummary, highlights, pathRows] = await Promise.all([
    prismaAny.codebaseFile.count({ where }),
    prismaAny.codebaseFile.count({
      where: { ...where, summary: { not: null } },
    }),
    prismaAny.codebaseFile.findMany({
      where,
      select: {
        filePath: true,
        language: true,
        summary: true,
        patterns: true,
        size: true,
      },
      orderBy: { indexedAt: "desc" },
      take: HIGHLIGHT_LIMIT,
    }),
    prismaAny.codebaseFile.findMany({
      where,
      select: { filePath: true, language: true, patterns: true },
      take: PATTERN_SAMPLE_LIMIT,
    }),
  ]);

  const languageCounts = new Map<string, number>();
  const patternCounts = new Map<string, number>();
  const dirCounts = new Map<string, number>();

  for (const row of pathRows) {
    const lang = row.language?.trim() || "other";
    languageCounts.set(lang, (languageCounts.get(lang) ?? 0) + 1);

    const patterns = Array.isArray(row.patterns) ? (row.patterns as string[]) : [];
    for (const pattern of patterns) {
      if (typeof pattern === "string" && pattern.trim()) {
        patternCounts.set(pattern, (patternCounts.get(pattern) ?? 0) + 1);
      }
    }

    const topDir = row.filePath.includes("/") ? row.filePath.split("/")[0] : row.filePath;
    dirCounts.set(topDir, (dirCounts.get(topDir) ?? 0) + 1);
  }

  return {
    repo: {
      owner: scope.repoOwner,
      name: scope.repoName,
      branch: branchName,
    },
    totals: { files: totalFiles, withSummary },
    languages: [...languageCounts.entries()]
      .map(([language, count]) => ({ language, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    patterns: [...patternCounts.entries()]
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    topDirectories: [...dirCounts.entries()]
      .map(([path, fileCount]) => ({ path, fileCount }))
      .sort((a, b) => b.fileCount - a.fileCount)
      .slice(0, 12),
    highlights: highlights.map(
      (row: {
        filePath: string;
        language: string | null;
        summary: string | null;
        patterns: unknown;
        size: number;
      }) => ({
        path: row.filePath,
        language: row.language,
        summary: row.summary,
        patterns: Array.isArray(row.patterns) ? (row.patterns as string[]) : [],
        size: row.size,
      })
    ),
  };
}
