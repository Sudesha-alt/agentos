import { prisma } from "../db/client";
import { redisConnection } from "../queue/jobQueue";
import { logger } from "../utils/logger";
import type { VisualizationLayout, VisualizationNode } from "./layoutComputer";
import { computeVisualizationLayout, type LayoutFileInput } from "./layoutComputer";
import { visualizationService } from "./visualizationService";

const prismaAny = prisma as any;
const REDIS_LAYOUT_TTL_SEC = 60 * 60 * 24 * 7;
const CHANNEL = "codebase:viz:delta";

export type VizDeltaMessage =
  | {
      type: "layout_refresh";
      branchName: string;
      layout: VisualizationLayout;
    }
  | {
      type: "node_update";
      branchName: string;
      nodes: VisualizationNode[];
    }
  | {
      type: "node_remove";
      branchName: string;
      paths: string[];
    };

function repoDefaults() {
  return {
    repoOwner: process.env.GITHUB_REPO_OWNER ?? "",
    repoName: process.env.GITHUB_REPO_NAME ?? "",
  };
}

function cacheKey(branchName: string): string {
  const { repoOwner, repoName } = repoDefaults();
  return `codebase:viz:layout:${repoOwner}:${repoName}:${branchName}`;
}

export const visualizationCache = {
  async get(branchName: string): Promise<VisualizationLayout | null> {
    const key = cacheKey(branchName);
    try {
      const cached = await redisConnection.get(key);
      if (cached) return JSON.parse(cached) as VisualizationLayout;
    } catch (err) {
      logger.warn({ err, branchName }, "redis viz cache read failed");
    }

    const { repoOwner, repoName } = repoDefaults();
    if (!repoOwner || !repoName) return null;

    const row = await prismaAny.codebaseVisualizationCache.findUnique({
      where: {
        repoOwner_repoName_branchName: { repoOwner, repoName, branchName },
      },
    });
    if (!row?.layoutJson) return null;
    return row.layoutJson as VisualizationLayout;
  },

  async set(branchName: string, layout: VisualizationLayout): Promise<void> {
    const key = cacheKey(branchName);
    const payload = JSON.stringify(layout);

    try {
      await redisConnection.setex(key, REDIS_LAYOUT_TTL_SEC, payload);
    } catch (err) {
      logger.warn({ err, branchName }, "redis viz cache write failed");
    }

    const { repoOwner, repoName } = repoDefaults();
    if (!repoOwner || !repoName) return;

    await prismaAny.codebaseVisualizationCache.upsert({
      where: {
        repoOwner_repoName_branchName: { repoOwner, repoName, branchName },
      },
      create: {
        repoOwner,
        repoName,
        branchName,
        layoutJson: layout,
      },
      update: {
        layoutJson: layout,
        computedAt: new Date(),
      },
    });
  },

  async refresh(branchName: string): Promise<VisualizationLayout> {
    const layout = await visualizationService.computeVisualization(branchName);
    await this.set(branchName, layout);
    await publishDelta({ type: "layout_refresh", branchName, layout });
    logger.info(
      { branchName, files: layout.meta.totalFiles, kind: layout.meta.layoutKind },
      "visualization layout cached"
    );
    return layout;
  },

  async onFileIndexed(
    branchName: string,
    filePath: string,
    fileInput: LayoutFileInput
  ): Promise<void> {
    const layout = await this.get(branchName);
    if (!layout) {
      await this.refresh(branchName);
      return;
    }

    const single = computeVisualizationLayout([fileInput], branchName);
    const updatedNode = single.nodes.find((n) => n.path === filePath);
    if (!updatedNode) return;

    const index = layout.nodes.findIndex((n) => n.path === filePath);
    if (index >= 0) layout.nodes[index] = { ...layout.nodes[index], ...updatedNode };
    else layout.nodes.push(updatedNode);

    await this.set(branchName, layout);
    await publishDelta({
      type: "node_update",
      branchName,
      nodes: [layout.nodes[index >= 0 ? index : layout.nodes.length - 1]],
    });
  },

  async onFileRemoved(branchName: string, filePath: string): Promise<void> {
    const layout = await this.get(branchName);
    if (!layout) return;

    layout.nodes = layout.nodes.filter((n) => n.path !== filePath);
    await this.set(branchName, layout);
    await publishDelta({ type: "node_remove", branchName, paths: [filePath] });
  },

  subscribe(handler: (message: VizDeltaMessage) => void): () => void {
    const sub = redisConnection.duplicate();
    sub.subscribe(CHANNEL).catch((err) => {
      logger.error({ err }, "viz delta subscribe failed");
    });
    sub.on("message", (_channel, payload) => {
      try {
        handler(JSON.parse(payload) as VizDeltaMessage);
      } catch {
        /* ignore malformed */
      }
    });
    return () => {
      sub.unsubscribe(CHANNEL).finally(() => sub.quit());
    };
  },
};

async function publishDelta(message: VizDeltaMessage): Promise<void> {
  try {
    await redisConnection.publish(CHANNEL, JSON.stringify(message));
  } catch (err) {
    logger.warn({ err }, "viz delta publish failed");
  }
}
