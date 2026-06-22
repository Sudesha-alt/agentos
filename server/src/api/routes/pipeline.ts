import { Router } from "express";
import { prisma } from "../../db/client";
import { ENG_QA_ARTIFACT_TYPES } from "../../pipeline/artifacts";
import { listArtifactsFromStageLogs } from "../../pipeline/artifacts/stageLogArtifacts";
import { pipelineRepo } from "../../db/repositories/pipelineRepo";
import { ticketRepo } from "../../db/repositories/ticketRepo";
import {
  isTicketInPipelineQueue,
  isJiraKeyInPipelineQueue,
  resumePipelineInBackground,
} from "../../queue/inProcessRunner";
import { enqueueIntakeFromJiraKey } from "../../pipeline/jira/intakeEnqueueService";
import { getLivePipelineStatus } from "../../pipeline/liveStatus";
import { NotFoundError, ValidationError } from "../../utils/errors";
import {
  requireOrganizationUser,
  withOrganizationContext,
} from "../orgRequestContext";

const router = Router();

router.get("/live", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      const jiraKey =
        typeof req.query.jiraKey === "string" ? req.query.jiraKey : undefined;
      const live = await getLivePipelineStatus(user.organizationId!, { jiraKey });
      res.json(live);
    });
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res) => {
  const user = requireOrganizationUser(req, res);
  if (!user?.organizationId) return;

  await withOrganizationContext(user.organizationId, async () => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const items = await prisma.pipeline.findMany({
      where: {
        organizationId: user.organizationId,
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { startedAt: "desc" },
      take: 50,
      include: { ticket: true },
    });
    res.json({ items });
  });
});

router.get("/:pipelineId/artifacts", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      const pipeline = await pipelineRepo.findById(req.params.pipelineId);
      if (!pipeline) throw new NotFoundError("Pipeline not found");
      const artifacts = (await listArtifactsFromStageLogs(pipeline.id)).filter((a) =>
        ENG_QA_ARTIFACT_TYPES.includes(a.type)
      );
      res.json({ pipelineId: pipeline.id, artifacts });
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:pipelineId", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      const pipeline = await pipelineRepo.findWithLatestStages(req.params.pipelineId);
      if (!pipeline) throw new NotFoundError("Pipeline not found");
      res.json(pipeline);
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:pipelineId/resume", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      const pipeline = await pipelineRepo.findById(req.params.pipelineId);
      if (!pipeline) throw new NotFoundError("Pipeline not found");
      const ticket = pipeline.ticket;
      if (
        (await isTicketInPipelineQueue(ticket.id)) ||
        (await isJiraKeyInPipelineQueue(ticket.jiraKey))
      ) {
        throw new ValidationError("Ticket already active or queued");
      }
      const result = resumePipelineInBackground(
        ticket.id,
        ticket.jiraKey,
        pipeline.id,
        user.organizationId
      );
      res.status(202).json({ pipelineId: pipeline.id, ...result });
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:ticketId/run", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      const ticket = await ticketRepo.findById(req.params.ticketId);
      if (!ticket) throw new NotFoundError("Ticket not found");

      const pausedPipeline = await prisma.pipeline.findFirst({
        where: {
          ticketId: ticket.id,
          status: "PAUSED",
        },
        orderBy: { startedAt: "desc" },
      });
      if (pausedPipeline) {
        throw new ValidationError(
          "Pipeline is paused awaiting review — use Resume on the pipeline detail page instead of Re-run."
        );
      }

      if (
        (await isTicketInPipelineQueue(ticket.id)) ||
        (await isJiraKeyInPipelineQueue(ticket.jiraKey))
      ) {
        throw new ValidationError("Ticket already active or queued");
      }
      const result = await enqueueIntakeFromJiraKey(ticket.jiraKey);
      res.status(202).json(result);
    });
  } catch (err) {
    next(err);
  }
});

export default router;

