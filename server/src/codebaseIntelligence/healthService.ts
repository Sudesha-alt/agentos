import { prisma } from "../db/client";
import {
  estimateComplexity,
  estimateCoverage,
  inferAuthorType,
} from "./fileMetrics";
import { resolveRepoScope } from "./repoScope";

const prismaAny = prisma as any;
const COMPLEXITY_DANGER_THRESHOLD = Number(process.env.CODEBASE_COMPLEXITY_THRESHOLD ?? 15);
const MS_DAY = 86_400_000;

export type CoverageBucket = { bucket: string; count: number };

export type CodebaseHealth = {
  branchName: string;
  totals: {
    files: number;
    avgCoverage: number;
    zeroCoveragePct: number;
    avgComplexity: number;
    highComplexityCount: number;
    modifiedLast7Days: { total: number; agent: number; human: number };
    technicalDebtScore: number;
  };
  coverageHistogram: CoverageBucket[];
  complexityHotspots: Array<{ path: string; complexity: number; coverage: number }>;
};

export type HealthTimelineDay = {
  date: string;
  totalFiles: number;
  agentFiles: number;
  humanFiles: number;
};

export type DriftItem = {
  feature: string;
  jiraKey: string | null;
  signal: string;
  detectedAt: string;
};

function coverageBucket(coverage: number): string {
  const floor = Math.floor(coverage / 10) * 10;
  const hi = Math.min(100, floor + 10);
  return `${floor}-${hi}%`;
}

function technicalDebtScore(avgCoverage: number, avgComplexity: number, zeroPct: number): number {
  const coverageGap = Math.max(0, 70 - avgCoverage);
  const complexityPenalty = Math.max(0, avgComplexity - 5) * 4;
  const zeroPenalty = zeroPct * 0.35;
  return Math.round(Math.min(100, coverageGap + complexityPenalty + zeroPenalty));
}

export async function getCodebaseHealth(branchName = "main"): Promise<CodebaseHealth> {
  const scope = resolveRepoScope();
  if (!scope) {
    return emptyHealth(branchName);
  }

  const rows = await prismaAny.codebaseFile.findMany({
    where: {
      repoOwner: scope.repoOwner,
      repoName: scope.repoName,
      branchName,
      isDeleted: false,
    },
    select: {
      filePath: true,
      size: true,
      lastCommitAt: true,
      lastAuthor: true,
      lastCommitMsg: true,
    },
  });

  if (!rows.length) return emptyHealth(branchName);

  const now = Date.now();
  const weekAgo = now - 7 * MS_DAY;
  const histogram = new Map<string, number>();
  let coverageSum = 0;
  let complexitySum = 0;
  let zeroCoverage = 0;
  let highComplexity = 0;
  let modifiedTotal = 0;
  let modifiedAgent = 0;
  let modifiedHuman = 0;
  const hotspots: Array<{ path: string; complexity: number; coverage: number }> = [];

  for (const row of rows) {
    const coverage = estimateCoverage(row.filePath, row.size);
    const complexity = estimateComplexity(row.size);
    coverageSum += coverage;
    complexitySum += complexity;
    if (coverage < 1) zeroCoverage += 1;

    const bucket = coverageBucket(coverage);
    histogram.set(bucket, (histogram.get(bucket) ?? 0) + 1);

    if (complexity >= COMPLEXITY_DANGER_THRESHOLD / 1.5) {
      highComplexity += 1;
      hotspots.push({ path: row.filePath, complexity, coverage });
    }

    const at = row.lastCommitAt ? new Date(row.lastCommitAt).getTime() : 0;
    if (at >= weekAgo) {
      modifiedTotal += 1;
      const kind = inferAuthorType(row);
      if (kind === "agent") modifiedAgent += 1;
      else if (kind === "human") modifiedHuman += 1;
    }
  }

  hotspots.sort((a, b) => b.complexity - a.complexity);

  const fileCount = rows.length;
  const avgCoverage = Math.round((coverageSum / fileCount) * 10) / 10;
  const avgComplexity = Math.round((complexitySum / fileCount) * 10) / 10;
  const zeroCoveragePct = Math.round((zeroCoverage / fileCount) * 1000) / 10;

  return {
    branchName,
    totals: {
      files: fileCount,
      avgCoverage,
      zeroCoveragePct,
      avgComplexity,
      highComplexityCount: highComplexity,
      modifiedLast7Days: {
        total: modifiedTotal,
        agent: modifiedAgent,
        human: modifiedHuman,
      },
      technicalDebtScore: technicalDebtScore(avgCoverage, avgComplexity, zeroCoveragePct),
    },
    coverageHistogram: [...histogram.entries()]
      .map(([bucket, count]) => ({ bucket, count }))
      .sort((a, b) => a.bucket.localeCompare(b.bucket)),
    complexityHotspots: hotspots.slice(0, 20),
  };
}

export async function getHealthTimeline(
  branchName = "main",
  days = 30
): Promise<{ days: HealthTimelineDay[] }> {
  const scope = resolveRepoScope();
  if (!scope) return { days: [] };

  const since = new Date(Date.now() - days * MS_DAY);
  const commits = await prismaAny.commitHistory.findMany({
    where: {
      repoOwner: scope.repoOwner,
      repoName: scope.repoName,
      branchName,
      authoredAt: { gte: since },
    },
    select: {
      authoredAt: true,
      author: true,
      message: true,
      filesModified: true,
      filesAdded: true,
    },
    orderBy: { authoredAt: "asc" },
  });

  const byDay = new Map<string, { agent: number; human: number }>();

  for (const commit of commits) {
    const date = commit.authoredAt.toISOString().slice(0, 10);
    const entry = byDay.get(date) ?? { agent: 0, human: 0 };
    const fileCount =
      (Array.isArray(commit.filesModified) ? commit.filesModified.length : 0) +
      (Array.isArray(commit.filesAdded) ? commit.filesAdded.length : 0);
    const kind = inferAuthorType({
      lastAuthor: commit.author,
      lastCommitMsg: commit.message,
    });
    if (kind === "agent") entry.agent += fileCount || 1;
    else entry.human += fileCount || 1;
    byDay.set(date, entry);
  }

  const daysOut: HealthTimelineDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * MS_DAY).toISOString().slice(0, 10);
    const entry = byDay.get(d) ?? { agent: 0, human: 0 };
    daysOut.push({
      date: d,
      totalFiles: entry.agent + entry.human,
      agentFiles: entry.agent,
      humanFiles: entry.human,
    });
  }

  return { days: daysOut };
}

export async function getHealthDrift(): Promise<{ items: DriftItem[]; note: string }> {
  return {
    items: [],
    note: "Specification drift detection will link indexed features to Jira tickets in a future release.",
  };
}

function emptyHealth(branchName: string): CodebaseHealth {
  return {
    branchName,
    totals: {
      files: 0,
      avgCoverage: 0,
      zeroCoveragePct: 0,
      avgComplexity: 0,
      highComplexityCount: 0,
      modifiedLast7Days: { total: 0, agent: 0, human: 0 },
      technicalDebtScore: 0,
    },
    coverageHistogram: [],
    complexityHotspots: [],
  };
}
