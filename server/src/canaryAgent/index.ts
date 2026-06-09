import { auditRepo } from "../db/repositories/auditRepo";
import { canaryRunRepo } from "../db/repositories/canaryRunRepo";
import { indexer } from "../rag/indexer";
import { logger } from "../utils/logger";
import { clearCanaryArtifacts } from "./artifactStore";
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

    await canaryRunRepo.updateProgress(run.id, { phase: "hypotheses" });
    const hypotheses = await generateHypotheses(understanding);
    await canaryRunRepo.updateProgress(run.id, {
      hypotheses: hypotheses as unknown as Prisma.InputJsonValue,
    });

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

    await canaryRunRepo.updateProgress(run.id, { phase: "synthesis" });
    const { summary, findings } = await synthesizeReport({
      exploration,
      jiraKey: input.jiraKey,
    });

    const savedFindings = await canaryRunRepo.addFindings(run.id, findings);

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
