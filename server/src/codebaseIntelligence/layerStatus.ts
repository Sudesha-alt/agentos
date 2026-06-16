import { createClient } from "@supabase/supabase-js";
import { getPublicGitCredentials } from "../git-integration/gitCredentialsStore";
import { isOpenAIConfigured } from "../llm/openaiClient";
import { prisma } from "../db/client";
import {
  getLatestIndexRun,
  getLastPrMergeForBranch,
  indexRunProgress,
} from "./indexQueue";
import { getOversizedSkippedCount } from "./indexSkipStats";
import { codebaseOrgWhere, resolveRepoScope } from "./repoScope";

const prismaAny = prisma as any;

export type CodebaseLayerStatus = {
  connected: boolean;
  repo: {
    owner: string;
    name: string;
    fullName: string;
    defaultBranch: string;
  } | null;
  ready: boolean;
  index: {
    status: "none" | "queued" | "running" | "completed" | "failed";
    runId: string | null;
    filesTotal: number | null;
    filesProcessed: number;
    filesIndexed: number;
    percent: number | null;
    lastCompletedAt: string | null;
    lastIndexedAt: string | null;
    lastTrigger: "manual" | "webhook" | "pr_merge" | "push" | null;
    lastPrNumber: number | null;
    error: string | null;
  };
  counts: {
    filesIndexed: number;
    embeddings: number;
    indexHealthPercent: number;
    filesSkippedOversized: number;
  };
  graph: {
    ready: boolean;
    computedAt: string | null;
    nodeCount: number | null;
  };
  configuration: {
    openaiConfigured: boolean;
    llmProvider: string;
    fileIntelligenceAvailable: boolean;
  };
  blockers: string[];
};

function llmProviderLabel(): string {
  return "openai";
}

function fileIntelligenceAvailable(): boolean {
  return isOpenAIConfigured();
}

async function countEmbeddings(
  repoOwner: string,
  repoName: string,
  branchName: string
): Promise<number> {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!url || !key) return 0;

  try {
    const supabase = createClient(url, key);
    const { count, error } = await supabase
      .from("codebase_embeddings")
      .select("*", { count: "exact", head: true })
      .eq("repo_owner", repoOwner)
      .eq("repo_name", repoName)
      .eq("branch_name", branchName);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function countIndexedFiles(
  repoOwner: string,
  repoName: string,
  branchName: string
): Promise<{ count: number; lastIndexedAt: string | null }> {
  const orgWhere = codebaseOrgWhere({ repoOwner, repoName, branchName, isDeleted: false });
  const [count, latest] = await Promise.all([
    prismaAny.codebaseFile.count({ where: orgWhere }),
    prismaAny.codebaseFile.findFirst({
      where: orgWhere,
      orderBy: { indexedAt: "desc" },
      select: { indexedAt: true },
    }),
  ]);

  return {
    count,
    lastIndexedAt: latest?.indexedAt?.toISOString() ?? null,
  };
}

async function getGraphStatus(
  organizationId: string,
  repoOwner: string,
  repoName: string,
  branchName: string
): Promise<{ ready: boolean; computedAt: string | null; nodeCount: number | null }> {
  const row = await prismaAny.codebaseVisualizationCache.findUnique({
    where: {
      organizationId_repoOwner_repoName_branchName: {
        organizationId,
        repoOwner,
        repoName,
        branchName,
      },
    },
    select: { layoutJson: true, computedAt: true },
  });

  if (!row?.layoutJson) {
    return { ready: false, computedAt: null, nodeCount: null };
  }

  const layout = row.layoutJson as { nodes?: unknown[]; meta?: { totalFiles?: number } };
  const nodeCount =
    layout.meta?.totalFiles ??
    (Array.isArray(layout.nodes) ? layout.nodes.length : null);

  return {
    ready: true,
    computedAt: row.computedAt?.toISOString() ?? null,
    nodeCount: nodeCount ?? null,
  };
}

async function getLastCompletedRun(
  organizationId: string,
  repoOwner: string,
  repoName: string,
  branchName: string
) {
  return prismaAny.codebaseIndexRun.findFirst({
    where: { organizationId, repoOwner, repoName, branchName, status: "completed" },
    orderBy: { completedAt: "desc" },
  });
}

export async function getCodebaseLayerStatus(
  branchName?: string
): Promise<CodebaseLayerStatus> {
  const git = getPublicGitCredentials();
  const scope = resolveRepoScope();
  const connected = Boolean(git.configured);
  const branch = branchName ?? scope?.defaultBranch ?? git.defaultBranch ?? "main";
  const openaiConfigured = isOpenAIConfigured();
  const blockers: string[] = [];

  if (!connected) {
    blockers.push("Connect GitHub and select a repository.");
  }

  if (!openaiConfigured) {
    blockers.push(
      "OPENAI_API_KEY is not set — per-file summaries, embeddings, and semantic search will be unavailable."
    );
  }

  if (!scope) {
    return {
      connected,
      repo: null,
      ready: false,
      index: {
        status: "none",
        runId: null,
        filesTotal: null,
        filesProcessed: 0,
        filesIndexed: 0,
        percent: null,
        lastCompletedAt: null,
        lastIndexedAt: null,
        lastTrigger: null,
        lastPrNumber: null,
        error: null,
      },
      counts: { filesIndexed: 0, embeddings: 0, indexHealthPercent: 0, filesSkippedOversized: 0 },
      graph: { ready: false, computedAt: null, nodeCount: null },
      configuration: {
        openaiConfigured,
        llmProvider: llmProviderLabel(),
        fileIntelligenceAvailable: fileIntelligenceAvailable(),
      },
      blockers,
    };
  }

  const repo = {
    owner: scope.repoOwner,
    name: scope.repoName,
    fullName: `${scope.repoOwner}/${scope.repoName}`,
    defaultBranch: scope.defaultBranch,
  };

  const [latestRun, lastCompleted, fileStats, embeddingCount, graph] = await Promise.all([
    getLatestIndexRun({
      repoOwner: scope.repoOwner,
      repoName: scope.repoName,
      branchName: branch,
    }),
    getLastCompletedRun(scope.organizationId, scope.repoOwner, scope.repoName, branch),
    countIndexedFiles(scope.repoOwner, scope.repoName, branch),
    countEmbeddings(scope.repoOwner, scope.repoName, branch),
    getGraphStatus(scope.organizationId, scope.repoOwner, scope.repoName, branch),
  ]);

  const progress = latestRun ? indexRunProgress(latestRun) : null;
  const indexStatus =
    (progress?.status as CodebaseLayerStatus["index"]["status"]) ?? "none";

  if (indexStatus === "failed" && progress?.error) {
    blockers.push(`Last index failed: ${progress.error}`);
  }
  if (fileStats.count === 0 && indexStatus !== "running" && indexStatus !== "queued") {
    blockers.push(
      "No indexed files yet — connect GitHub and select a repo, or use Fetch & index on Codebase Intelligence."
    );
  }
  if (openaiConfigured && embeddingCount === 0 && fileStats.count > 0) {
    blockers.push("Files indexed but no embeddings — check OPENAI_API_KEY and re-index.");
  }

  const oversizedSkipped = getOversizedSkippedCount();
  if (oversizedSkipped > 0) {
    blockers.push(`${oversizedSkipped} files skipped (over size limit)`);
  }

  const indexHealthPercent =
    fileStats.count > 0
      ? Math.min(100, Math.round((embeddingCount / fileStats.count) * 100))
      : 0;

  const lastTrigger = (lastCompleted?.triggerType as CodebaseLayerStatus["index"]["lastTrigger"]) ?? null;
  const lastPrNumber =
    lastTrigger === "pr_merge" ? getLastPrMergeForBranch(branch) : null;

  const ready =
    connected &&
    fileStats.count > 0 &&
    (indexStatus === "completed" || (lastCompleted && indexStatus !== "running" && indexStatus !== "queued")) &&
    (!openaiConfigured || embeddingCount > 0) &&
    indexStatus !== "failed";

  return {
    connected,
    repo,
    ready,
    index: {
      status: indexStatus,
      runId: latestRun?.id ?? null,
      filesTotal: progress?.filesTotal ?? null,
      filesProcessed: progress?.filesProcessed ?? 0,
      filesIndexed: progress?.filesIndexed ?? lastCompleted?.filesIndexed ?? 0,
      percent: progress?.percent ?? null,
      lastCompletedAt: lastCompleted?.completedAt?.toISOString() ?? progress?.completedAt ?? null,
      lastIndexedAt: fileStats.lastIndexedAt,
      lastTrigger,
      lastPrNumber,
      error: progress?.error ?? null,
    },
    counts: {
      filesIndexed: fileStats.count,
      embeddings: embeddingCount,
      indexHealthPercent,
      filesSkippedOversized: oversizedSkipped,
    },
    graph,
    configuration: {
      openaiConfigured,
      llmProvider: llmProviderLabel(),
      fileIntelligenceAvailable: fileIntelligenceAvailable(),
    },
    blockers: [...new Set(blockers)],
  };
}
