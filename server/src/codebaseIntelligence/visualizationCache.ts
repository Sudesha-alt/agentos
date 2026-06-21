import { EventEmitter } from "node:events";
import { prisma } from "../db/client";
import { logger } from "../utils/logger";
import type { VisualizationLayout, VisualizationNode } from "./layoutComputer";
import { computeVisualizationLayout, type LayoutFileInput } from "./layoutComputer";
import { visualizationService } from "./visualizationService";
import { resolveRepoScope } from "./repoScope";

const prismaAny = prisma as any;
const vizEmitter = new EventEmitter();
vizEmitter.setMaxListeners(100);

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

function publishDelta(message: VizDeltaMessage): void {
  vizEmitter.emit("delta", message);
}

export const visualizationCache = {
  async get(branchName: string): Promise<VisualizationLayout | null> {
    const scope = resolveRepoScope();
    if (!scope) return null;

    const row = await prismaAny.codebaseVisualizationCache.findUnique({
      where: {
        organizationId_repoOwner_repoName_branchName: {
          organizationId: scope.organizationId,
          repoOwner: scope.repoOwner,
          repoName: scope.repoName,
          branchName,
        },
      },
    });
    if (!row?.layoutJson) return null;
    return row.layoutJson as VisualizationLayout;
  },

  async set(branchName: string, layout: VisualizationLayout): Promise<void> {
    const scope = resolveRepoScope();
    if (!scope) return;

    await prismaAny.codebaseVisualizationCache.upsert({
      where: {
        organizationId_repoOwner_repoName_branchName: {
          organizationId: scope.organizationId,
          repoOwner: scope.repoOwner,
          repoName: scope.repoName,
          branchName,
        },
      },
      create: {
        organizationId: scope.organizationId,
        repoOwner: scope.repoOwner,
        repoName: scope.repoName,
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
    publishDelta({ type: "layout_refresh", branchName, layout });
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
    if (index < 0) {
      await this.refresh(branchName);
      return;
    }

    const existing = layout.nodes[index];
    layout.nodes[index] = {
      ...existing,
      language: updatedNode.language,
      summary: updatedNode.summary,
      patterns: updatedNode.patterns,
      lastModified: updatedNode.lastModified,
      lastModifiedBy: updatedNode.lastModifiedBy,
      coverage: updatedNode.coverage,
      complexity: updatedNode.complexity,
      importCount: updatedNode.importCount,
      exportCount: updatedNode.exportCount,
      size: updatedNode.size,
      name: updatedNode.name,
    };

    await this.set(branchName, layout);
    publishDelta({
      type: "node_update",
      branchName,
      nodes: [layout.nodes[index]],
    });
  },

  async onFileRemoved(branchName: string, filePath: string): Promise<void> {
    const layout = await this.get(branchName);
    if (!layout) return;

    layout.nodes = layout.nodes.filter((n) => n.path !== filePath);
    await this.set(branchName, layout);
    publishDelta({ type: "node_remove", branchName, paths: [filePath] });
  },

  subscribe(handler: (message: VizDeltaMessage) => void): () => void {
    vizEmitter.on("delta", handler);
    return () => {
      vizEmitter.off("delta", handler);
    };
  },
};
