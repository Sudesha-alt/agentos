import { prisma } from "../db/client";
import { githubClient } from "../integrations/githubClient";
import { logger } from "../utils/logger";
import {
  computeVisualizationLayout,
  type LayoutFileInput,
  type VisualizationLayout,
} from "./layoutComputer";
import {
  extractFunctionBlocks,
  layoutFunctionBlocks,
} from "./functionBlocks";

const prismaAny = prisma as any;

function repoDefaults() {
  return {
    repoOwner: process.env.GITHUB_REPO_OWNER ?? "",
    repoName: process.env.GITHUB_REPO_NAME ?? "",
  };
}

function lineCount(content: string, storedSize: number): number {
  if (storedSize > 0) return storedSize;
  return content.split("\n").length;
}

export const visualizationService = {
  async computeVisualization(branchName = "main"): Promise<VisualizationLayout> {
    const files = await loadIndexedFiles(branchName);
    if (files.length > 0) {
      return computeVisualizationLayout(files, branchName);
    }

    logger.info({ branchName }, "no indexed files — building visualization from GitHub tree");
    const fallback = await loadGithubTreeFiles(branchName);
    return computeVisualizationLayout(fallback, branchName);
  },

  async getFileInterior(branchName: string, filePath: string) {
    const { repoOwner, repoName } = repoDefaults();
    const row = await prismaAny.codebaseFile.findUnique({
      where: {
        repoOwner_repoName_filePath_branchName: {
          repoOwner,
          repoName,
          filePath,
          branchName,
        },
      },
      select: { content: true, summary: true, filePath: true },
    });

    if (!row?.content) {
      return { filePath, blocks: [], summary: null };
    }

    const blocks = extractFunctionBlocks(row.content, filePath);
    const laid = layoutFunctionBlocks(blocks, 960, 520);
    return {
      filePath,
      summary: row.summary,
      blocks: laid,
    };
  },
};

async function loadIndexedFiles(branchName: string): Promise<LayoutFileInput[]> {
  const { repoOwner, repoName } = repoDefaults();
  if (!repoOwner || !repoName) return [];

  const rows = await prismaAny.codebaseFile.findMany({
    where: { repoOwner, repoName, branchName, isDeleted: false },
    select: {
      filePath: true,
      size: true,
      language: true,
      summary: true,
      patterns: true,
      imports: true,
      exports: true,
      lastCommitAt: true,
      lastAuthor: true,
      lastCommitMsg: true,
      content: true,
    },
    take: 2000,
  });

  return rows.map((row: {
    filePath: string;
    size: number;
    language: string | null;
    summary: string | null;
    patterns: unknown;
    imports: unknown;
    exports: unknown;
    lastCommitAt: Date | null;
    lastAuthor: string | null;
    lastCommitMsg: string | null;
    content: string;
  }) => ({
    filePath: row.filePath,
    size: lineCount(row.content, row.size),
    language: row.language,
    summary: row.summary,
    patterns: row.patterns,
    imports: row.imports,
    exports: row.exports,
    lastCommitAt: row.lastCommitAt,
    lastAuthor: row.lastAuthor,
    lastCommitMsg: row.lastCommitMsg,
  }));
}

async function loadGithubTreeFiles(branchName: string): Promise<LayoutFileInput[]> {
  try {
    const tree = await githubClient.getRepoTree(branchName);
    return tree
      .filter((item) => item.type === "blob")
      .filter((item) => isCodePath(item.path))
      .slice(0, 400)
      .map((item) => ({
        filePath: item.path,
        size: Math.max(20, Math.min(item.size ?? 80, 800)),
        language: inferLanguage(item.path),
        summary: null,
        patterns: inferPatterns(item.path),
        imports: [],
        exports: [],
      }));
  } catch (error) {
    logger.warn(
      { branchName, error: error instanceof Error ? error.message : String(error) },
      "github tree fallback failed — using demo layout"
    );
    return demoFiles();
  }
}

function isCodePath(path: string): boolean {
  if (path.includes("node_modules") || path.includes("dist/")) return false;
  return /\.(ts|tsx|js|jsx|py|go|rs|sql|prisma|json|md)$/i.test(path);
}

function inferLanguage(path: string): string | null {
  return path.split(".").pop()?.toLowerCase() ?? null;
}

function inferPatterns(path: string): string[] {
  if (path.includes("__tests__") || path.includes(".test.")) return ["test"];
  if (path.includes("/api/") || path.includes("routes/")) return ["api-route"];
  if (path.includes("middleware")) return ["middleware"];
  if (path.includes("service") || path.includes("Service")) return ["service-layer"];
  if (path.includes("prisma") || path.includes("model")) return ["data-model"];
  if (path.includes("widget") || path.includes("pages/")) return ["ui-component"];
  return ["utility"];
}

function demoFiles(): LayoutFileInput[] {
  const paths = [
    "server/src/pipeline/orchestrator.ts",
    "server/src/agents/productAgent.ts",
    "server/src/agents/engineeringAgent.ts",
    "server/src/agents/qaAgent.ts",
    "server/src/qaAgent/index.ts",
    "server/src/codebaseIntelligence/indexer.ts",
    "server/src/codebaseIntelligence/layoutComputer.ts",
    "server/src/codebaseIntelligence/visualizationService.ts",
    "server/src/api/routes/codebase.ts",
    "app/src/widgets/codebase-viz/CodebaseVisualization.jsx",
    "app/src/widgets/codebase-viz/TreemapCanvas.jsx",
    "app/src/entities/codebase/index.js",
  ];
  return paths.map((filePath) => ({
    filePath,
    size: 120 + (filePath.length % 200),
    language: inferLanguage(filePath),
    summary: null,
    patterns: inferPatterns(filePath),
    imports: [],
    exports: [],
  }));
}
