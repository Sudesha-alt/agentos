import { auditRepo } from "../db/repositories/auditRepo";
import { canaryRunRepo } from "../db/repositories/canaryRunRepo";
import { emitEngineeringCodingEvent } from "../engineering/codingEventsHub";
import { indexer } from "../rag/indexer";
import { logger } from "../utils/logger";
import { clearCanaryArtifacts } from "./artifactStore";
import { autoCreateJiraBugsFromFindings } from "./canaryJiraBug";
import {
  isCanaryEnabled,
  resolveCanaryTargetUrl,
} from "./config";
import { runExploration } from "./exploration";
import { generateHypotheses } from "./hypotheses";
import { runReconnaissance } from "./reconnaissance";
import { synthesizeReport } from "./synthesis";
import type { Prisma } from "../db/prisma";
import type { CanaryRunInput, CanaryRunResult } from "./types";

function emitCanaryPhase(
  pipelineId: string | undefined,
  phase: "reconnaissance" | "hypotheses" | "exploration" | "synthesis" | "completed" | "failed",
  jiraKey?: string,
  findingCount?: number
): void {
  if (!pipelineId) return;
  emitEngineeringCodingEvent({
    type: "canary_phase",
    pipelineId,
    phase,
    jiraKey,
    findingCount,
    timestamp: new Date().toISOString(),
  });
}

export async function runCanaryCycle(input: CanaryRunInput): Promise<CanaryRunResult | null> {
  if (!isCanaryEnabled()) {
    logger.info("canary disabled via CANARY_ENABLED=false");
    return null;
  }

  const targetUrl =
    input.targetUrl?.trim() || resolveCanaryTargetUrl(input.environment);
  if (!targetUrl) {
    logger.warn(
      { environment: input.environment },
      "canary skipped — no target URL configured"
    );
    return null;
  }

  const run = await canaryRunRepo.create({
    pipelineId: input.pipelineId,
    jiraKey: input.jiraKey,
    trigger: input.trigger,
    environment: input.environment,
    scope: input.scope ?? "full",
    targetUrl,
    metadata: { orientation: input.orientation ?? {} } as unknown as Prisma.InputJsonValue,
  });

  const jiraKey = input.jiraKey ?? `canary-${run.id}`;

  try {
    emitCanaryPhase(input.pipelineId, "reconnaissance", input.jiraKey);
    await canaryRunRepo.updateProgress(run.id, { phase: "reconnaissance" });
    const understanding = await runReconnaissance({
      targetUrl,
      jiraKey: input.jiraKey,
      scope: input.scope,
      orientation: input.orientation,
    });
    await canaryRunRepo.updateProgress(run.id, {
      understanding: understanding as unknown as Prisma.InputJsonValue,
    });

    emitCanaryPhase(input.pipelineId, "hypotheses", input.jiraKey);
    await canaryRunRepo.updateProgress(run.id, { phase: "hypotheses" });
    const hypotheses = await generateHypotheses(understanding);
    await canaryRunRepo.updateProgress(run.id, {
      hypotheses: hypotheses as unknown as Prisma.InputJsonValue,
    });

    emitCanaryPhase(input.pipelineId, "exploration", input.jiraKey);
    await canaryRunRepo.updateProgress(run.id, { phase: "exploration" });
    const exploration = await runExploration({
      runId: run.id,
      pipelineId: input.pipelineId,
      targetUrl,
      jiraKey,
      understanding,
      hypotheses,
      orientation: input.orientation,
    });

    emitCanaryPhase(input.pipelineId, "synthesis", input.jiraKey);
    await canaryRunRepo.updateProgress(run.id, { phase: "synthesis" });
    const { summary, findings } = await synthesizeReport({
      exploration,
      jiraKey: input.jiraKey,
    });

    const savedFindings = await canaryRunRepo.addFindings(run.id, findings);

    // Auto-create Jira Bug tickets for critical findings
    await autoCreateJiraBugsFromFindings(savedFindings, input.jiraKey);

    if (input.pipelineId) {
      await auditRepo.log(input.pipelineId, "CANARY_RUN_COMPLETED", {
        runId: run.id,
        findingCount: findings.length,
        environment: input.environment,
      });
    }

    if (input.jiraKey && savedFindings.length) {
      await indexer.indexCanaryFindings(input.jiraKey, savedFindings).catch((err) => {
        logger.warn({ err, runId: run.id }, "canary finding embed failed");
      });
    }

    emitCanaryPhase(input.pipelineId, "completed", input.jiraKey, findings.length);
    await canaryRunRepo.updateProgress(run.id, {
      status: "COMPLETED",
      summary,
      completedAt: new Date(),
    });

    clearCanaryArtifacts(run.id);

    return {
      runId: run.id,
      status: "completed",
      understanding,
      hypotheses: exploration.hypotheses,
      findings,
      summary,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emitCanaryPhase(input.pipelineId, "failed", input.jiraKey);
    await canaryRunRepo.updateProgress(run.id, {
      status: "FAILED",
      error: message,
      completedAt: new Date(),
    });
    clearCanaryArtifacts(run.id);
    logger.error({ err, runId: run.id }, "canary cycle failed");
    return {
      runId: run.id,
      status: "failed",
      understanding: {
        targetUrl,
        endpointCount: 0,
        endpoints: [],
        dataModelCount: 0,
        dataModels: [],
        recentChanges: [],
        knownFailurePatterns: [],
        testCoverageGaps: [],
        highRiskAreas: [],
        notes: [message],
      },
      hypotheses: [],
      findings: [],
      summary: "Canary run failed",
      error: message,
    };
  }
}
