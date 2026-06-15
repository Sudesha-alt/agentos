import type {
  RoadmapItemStatus,
  RoadmapRouteType,
} from "../generated/prisma/client";
import { prisma } from "../db/client";
import { requireActiveOrganizationId } from "../organization/orgScope";
import {
  DEFAULT_ROADMAP_ITEMS,
  DEFAULT_ROADMAP_STAGES,
} from "./defaultTemplate";

export type RoadmapAvailability = "completed" | "available" | "locked" | "in_progress";

export interface RoadmapBoardItem {
  id: string;
  slug: string;
  stageId: string;
  stageKey: string;
  title: string;
  description: string | null;
  routeType: RoadmapRouteType;
  status: RoadmapItemStatus;
  sortOrder: number;
  dependsOnSlugs: string[];
  jiraKey: string | null;
  availability: RoadmapAvailability;
  statusHint: string;
}

export interface RoadmapBoardStage {
  id: string;
  key: string;
  label: string;
  sortOrder: number;
  completedCount: number;
  totalCount: number;
  items: RoadmapBoardItem[];
}

export interface RoadmapBoard {
  id: string;
  title: string;
  stages: RoadmapBoardStage[];
}

function parseDependsOnSlugs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((s): s is string => typeof s === "string");
}

function statusHint(
  availability: RoadmapAvailability,
  routeType: RoadmapRouteType
): string {
  if (availability === "completed") return "Done";
  if (availability === "locked") return "Needs earlier steps first";
  if (availability === "in_progress") {
    if (routeType === "APPROVAL") return "Needs approval";
    if (routeType === "AGENT") return "Agent working on this";
    return "In progress";
  }
  if (routeType === "AGENT") return "Agent can do this";
  if (routeType === "APPROVAL") return "Needs approval";
  return "Needs your input";
}

function computeAvailability(
  item: { status: RoadmapItemStatus; dependsOnSlugs: unknown },
  completedSlugs: Set<string>
): RoadmapAvailability {
  if (item.status === "COMPLETED") return "completed";
  if (item.status === "IN_PROGRESS") return "in_progress";
  const deps = parseDependsOnSlugs(item.dependsOnSlugs);
  const blocked = deps.some((slug) => !completedSlugs.has(slug));
  return blocked ? "locked" : "available";
}

function enrichBoard(
  roadmap: {
    id: string;
    title: string;
    stages: Array<{
      id: string;
      key: string;
      label: string;
      sortOrder: number;
      items: Array<{
        id: string;
        slug: string;
        stageId: string;
        title: string;
        description: string | null;
        routeType: RoadmapRouteType;
        status: RoadmapItemStatus;
        sortOrder: number;
        dependsOnSlugs: unknown;
        jiraKey: string | null;
        stage: { key: string };
      }>;
    }>;
  }
): RoadmapBoard {
  const allItems = roadmap.stages.flatMap((s) => s.items);
  const completedSlugs = new Set(
    allItems.filter((i) => i.status === "COMPLETED").map((i) => i.slug)
  );

  const stages: RoadmapBoardStage[] = roadmap.stages
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((stage) => {
      const items = stage.items
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => {
          const availability = computeAvailability(item, completedSlugs);
          return {
            id: item.id,
            slug: item.slug,
            stageId: item.stageId,
            stageKey: stage.key,
            title: item.title,
            description: item.description,
            routeType: item.routeType,
            status: item.status,
            sortOrder: item.sortOrder,
            dependsOnSlugs: parseDependsOnSlugs(item.dependsOnSlugs),
            jiraKey: item.jiraKey,
            availability,
            statusHint: statusHint(availability, item.routeType),
          };
        });

      const completedCount = items.filter((i) => i.availability === "completed").length;
      return {
        id: stage.id,
        key: stage.key,
        label: stage.label,
        sortOrder: stage.sortOrder,
        completedCount,
        totalCount: items.length,
        items,
      };
    });

  return { id: roadmap.id, title: roadmap.title, stages };
}

async function seedDefaultRoadmap(organizationId: string) {
  const roadmap = await prisma.roadmap.create({
    data: {
      organizationId,
      title: "How to build a company",
      stages: {
        create: DEFAULT_ROADMAP_STAGES.map((s) => ({
          key: s.key,
          label: s.label,
          sortOrder: s.sortOrder,
        })),
      },
    },
    include: { stages: true },
  });

  const stageByKey = new Map(roadmap.stages.map((s) => [s.key, s.id]));

  await prisma.roadmapItem.createMany({
    data: DEFAULT_ROADMAP_ITEMS.map((item) => ({
      organizationId,
      roadmapId: roadmap.id,
      stageId: stageByKey.get(item.stageKey)!,
      slug: item.slug,
      title: item.title,
      description: item.description ?? null,
      routeType: item.routeType,
      status: item.seedCompleted ? "COMPLETED" : "PENDING",
      sortOrder: item.sortOrder,
      dependsOnSlugs: item.dependsOnSlugs ?? [],
    })),
  });
}

export const roadmapService = {
  async getOrCreateBoard(): Promise<RoadmapBoard> {
    const organizationId = requireActiveOrganizationId();

    let roadmap = await prisma.roadmap.findUnique({
      where: { organizationId },
      include: {
        stages: {
          include: {
            items: { include: { stage: { select: { key: true } } } },
          },
        },
      },
    });

    if (!roadmap) {
      await seedDefaultRoadmap(organizationId);
      roadmap = await prisma.roadmap.findUnique({
        where: { organizationId },
        include: {
          stages: {
            include: {
              items: { include: { stage: { select: { key: true } } } },
            },
          },
        },
      });
    }

    if (!roadmap) {
      throw new Error("Failed to load roadmap");
    }

    return enrichBoard(roadmap);
  },

  async createItem(input: {
    stageKey: string;
    title: string;
    description?: string;
    routeType?: RoadmapRouteType;
    dependsOnSlugs?: string[];
  }): Promise<RoadmapBoard> {
    const organizationId = requireActiveOrganizationId();
    const roadmap = await prisma.roadmap.findUnique({
      where: { organizationId },
      include: { stages: true, items: { select: { slug: true, sortOrder: true, stageId: true } } },
    });
    if (!roadmap) {
      await seedDefaultRoadmap(organizationId);
      return this.createItem(input);
    }

    const stage = roadmap.stages.find((s) => s.key === input.stageKey);
    if (!stage) {
      throw new Error(`Unknown stage: ${input.stageKey}`);
    }

    const baseSlug = input.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48);
    let slug = baseSlug || "item";
    let n = 1;
    const existing = new Set(roadmap.items.map((i) => i.slug));
    while (existing.has(slug)) {
      slug = `${baseSlug}-${n++}`;
    }

    const stageItems = roadmap.items.filter((i) => i.stageId === stage.id);
    const sortOrder =
      stageItems.length > 0
        ? Math.max(...stageItems.map((i) => i.sortOrder)) + 1
        : 0;

    await prisma.roadmapItem.create({
      data: {
        organizationId,
        roadmapId: roadmap.id,
        stageId: stage.id,
        slug,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        routeType: input.routeType ?? "USER_INPUT",
        dependsOnSlugs: input.dependsOnSlugs ?? [],
        sortOrder,
      },
    });

    return this.getOrCreateBoard();
  },

  async updateItem(
    itemId: string,
    patch: {
      status?: RoadmapItemStatus;
      stageKey?: string;
      title?: string;
      description?: string;
      routeType?: RoadmapRouteType;
      dependsOnSlugs?: string[];
      jiraKey?: string | null;
    }
  ): Promise<RoadmapBoard> {
    const organizationId = requireActiveOrganizationId();
    const item = await prisma.roadmapItem.findFirst({
      where: { id: itemId, organizationId },
      include: { roadmap: { include: { stages: true } } },
    });
    if (!item) {
      throw new Error("Roadmap item not found");
    }

    let stageId = item.stageId;
    if (patch.stageKey) {
      const stage = item.roadmap.stages.find((s) => s.key === patch.stageKey);
      if (!stage) throw new Error(`Unknown stage: ${patch.stageKey}`);
      stageId = stage.id;
    }

    if (patch.status === "COMPLETED" || patch.status === "IN_PROGRESS") {
      const board = await this.getOrCreateBoard();
      const current = board.stages
        .flatMap((s) => s.items)
        .find((i) => i.id === itemId);
      if (current?.availability === "locked") {
        throw new Error("Complete prerequisite steps first");
      }
    }

    await prisma.roadmapItem.update({
      where: { id: itemId },
      data: {
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.title ? { title: patch.title.trim() } : {}),
        ...(patch.description !== undefined
          ? { description: patch.description.trim() || null }
          : {}),
        ...(patch.routeType ? { routeType: patch.routeType } : {}),
        ...(patch.dependsOnSlugs ? { dependsOnSlugs: patch.dependsOnSlugs } : {}),
        ...(patch.jiraKey !== undefined ? { jiraKey: patch.jiraKey } : {}),
        stageId,
      },
    });

    return this.getOrCreateBoard();
  },

  async deleteItem(itemId: string): Promise<RoadmapBoard> {
    const organizationId = requireActiveOrganizationId();
    const item = await prisma.roadmapItem.findFirst({
      where: { id: itemId, organizationId },
    });
    if (!item) {
      throw new Error("Roadmap item not found");
    }
    await prisma.roadmapItem.delete({ where: { id: itemId } });
    return this.getOrCreateBoard();
  },
};
