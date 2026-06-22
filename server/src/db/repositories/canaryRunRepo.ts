import type { Prisma } from "../prisma";
import { prisma } from "../client";
import type { CanaryFindingDraft } from "../../canaryAgent/types";

export const canaryRunRepo = {
  async create(input: {
    pipelineId?: string;
    jiraKey?: string;
    trigger: string;
    environment: string;
    scope: string;
    targetUrl: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return prisma.canaryRun.create({
      data: {
        pipelineId: input.pipelineId,
        jiraKey: input.jiraKey,
        trigger: input.trigger,
        environment: input.environment,
        scope: input.scope,
        targetUrl: input.targetUrl,
        status: "RUNNING",
        metadata: input.metadata ?? {},
      },
    });
  },

  async updateProgress(
    id: string,
    data: {
      phase?: string;
      understanding?: Prisma.InputJsonValue;
      hypotheses?: Prisma.InputJsonValue;
      summary?: string;
      status?: "RUNNING" | "COMPLETED" | "FAILED";
      error?: string;
      completedAt?: Date;
    }
  ) {
    return prisma.canaryRun.update({ where: { id }, data });
  },

  async addFindings(runId: string, findings: CanaryFindingDraft[]) {
    if (!findings.length) return [];
    await prisma.canaryFinding.createMany({
      data: findings.map((f) => ({
        canaryRunId: runId,
        hypothesisId: f.hypothesisId,
        severity: f.severity,
        category: f.category,
        title: f.title,
        description: f.description,
        reproductionSteps: f.reproductionSteps,
        evidence: (f.evidence ?? {}) as Prisma.InputJsonValue,
        affectedCode: f.affectedCode,
        suggestedFix: f.suggestedFix,
      })),
    });
    return prisma.canaryFinding.findMany({
      where: { canaryRunId: runId },
      orderBy: { createdAt: "desc" },
      take: findings.length,
    });
  },

  async listRecent(limit = 20) {
    return prisma.canaryRun.findMany({
      orderBy: { startedAt: "desc" },
      take: limit,
      include: {
        findings: { orderBy: { createdAt: "desc" } },
        pipeline: { include: { ticket: true } },
      },
    });
  },

  async getById(id: string) {
    return prisma.canaryRun.findUnique({
      where: { id },
      include: {
        findings: { orderBy: { createdAt: "desc" } },
        pipeline: { include: { ticket: true } },
      },
    });
  },

  async markFindingEmbedded(findingId: string) {
    return prisma.canaryFinding.update({
      where: { id: findingId },
      data: { embeddedAt: new Date() },
    });
  },

  async updateFindingJiraKey(findingId: string, jiraKey: string) {
    return prisma.canaryFinding.update({
      where: { id: findingId },
      data: { jiraKeyCreated: jiraKey },
    });
  },

  async nightlySummary(since: Date) {
    const runs = await prisma.canaryRun.findMany({
      where: { startedAt: { gte: since }, status: "COMPLETED" },
      include: { findings: true },
    });
    const findings = runs.flatMap((r) => r.findings);
    return {
      runCount: runs.length,
      findingCount: findings.length,
      critical: findings.filter((f) => f.severity === "critical").length,
      high: findings.filter((f) => f.severity === "high").length,
      runs,
    };
  },
};
