import { Router } from "express";
import { prisma } from "../../db/client";
import type { PipelineStage, PipelineStatus } from "../../generated/prisma/client";
import { listIntakeNotifications } from "../../pipeline/jira/intakeNotificationStore";
import { requireOrganizationUser } from "../orgRequestContext";

const router = Router();

const STAGE_LABELS: Record<PipelineStage, string> = {
  INGESTION: "Ingestion",
  PRODUCT_AGENT: "Virin",
  PRD_VALIDATION: "PRD Gate",
  ENGINEERING_AGENT: "Ananta",
  IMPLEMENTATION_VALIDATION: "Impl. Gate",
  QA_AGENT: "Neel",
  QA_VALIDATION: "QA Gate",
  OUTPUT: "Writeback",
};

function pipelineMessage(
  status: PipelineStatus,
  stage: PipelineStage
): string {
  const stageLabel = STAGE_LABELS[stage] ?? stage;
  if (status === "COMPLETED") return `${stageLabel} finished ✓`;
  if (status === "PAUSED") return `${stageLabel} — awaiting human review`;
  if (status === "FAILED") return `${stageLabel} failed`;
  return `${stageLabel} running…`;
}

router.get("/recent", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    const pipelines = await prisma.pipeline.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { startedAt: "desc" },
      take: 20,
      include: { ticket: true },
    });

    const events = pipelines.map((pipeline) => {
      const tone =
        pipeline.status === "COMPLETED"
          ? "complete"
          : pipeline.status === "RUNNING"
            ? "progress"
            : pipeline.status === "PAUSED"
              ? "attention"
              : "muted";

      return {
        id: pipeline.id,
        pipelineId: pipeline.id,
        jiraKey: pipeline.ticket.jiraKey,
        tone,
        live: pipeline.status === "RUNNING",
        message: pipelineMessage(pipeline.status, pipeline.currentStage),
        timestamp:
          pipeline.completedAt?.toISOString() ??
          pipeline.startedAt.toISOString(),
      };
    });

    const intakeEvents = listIntakeNotifications(user.organizationId).map((item) => ({
      id: item.id,
      pipelineId: null,
      jiraKey: item.jiraKey,
      tone: item.tone,
      live: item.live,
      message: item.message,
      summary: item.summary,
      issueType: item.issueType,
      timestamp: item.timestamp,
    }));

    const merged = [...intakeEvents, ...events]
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, 25);

    res.json({ events: merged });
  } catch (err) {
    next(err);
  }
});

export default router;
