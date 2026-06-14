import { Router } from "express";
import { prisma } from "../../db/client";
import { listPipelineArtifacts, ENG_QA_ARTIFACT_TYPES } from "../../pipeline/artifacts";
import { pipelineRepo } from "../../db/repositories/pipelineRepo";
import { ticketRepo } from "../../db/repositories/ticketRepo";
import {
  isTicketInPipelineQueue,
  isJiraKeyInPipelineQueue,
  resumePipelineInBackground,
} from "../../queue/inProcessRunner";
import { enqueueIntakeFromJiraKey } from "../../pipeline/jira/intakeEnqueueService";
import { NotFoundError, ValidationError } from "../../utils/errors";

const router = Router();

router.get("/", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const items = await prisma.pipeline.findMany({
    where: status ? { status: status as never } : undefined,
    orderBy: { startedAt: "desc" },
    take: 50,
    include: { ticket: true },
  });
  res.json({ items });
});

router.get("/:pipelineId/artifacts", async (req, res, next) => {
  try {
    const pipeline = await pipelineRepo.findById(req.params.pipelineId);
    if (!pipeline) throw new NotFoundError("Pipeline not found");
    const artifacts = listPipelineArtifacts(pipeline.id).filter((a) =>
      ENG_QA_ARTIFACT_TYPES.includes(a.type)
    );
    res.json({ pipelineId: pipeline.id, artifacts });
  } catch (err) {
    next(err);
  }
});

router.get("/:pipelineId", async (req, res, next) => {
  try {
    const pipeline = await pipelineRepo.findWithLatestStages(req.params.pipelineId);
    if (!pipeline) throw new NotFoundError("Pipeline not found");
    res.json(pipeline);
  } catch (err) {
    next(err);
  }
});

router.post("/:pipelineId/resume", async (req, res, next) => {
  try {
    const pipeline = await pipelineRepo.findById(req.params.pipelineId);
    if (!pipeline) throw new NotFoundError("Pipeline not found");
    const ticket = pipeline.ticket;
    if (isTicketInPipelineQueue(ticket.id) || isJiraKeyInPipelineQueue(ticket.jiraKey)) {
      throw new ValidationError("Ticket already active or queued");
    }
    const result = resumePipelineInBackground(ticket.id, ticket.jiraKey, pipeline.id);
    res.status(202).json({ pipelineId: pipeline.id, ...result });
  } catch (err) {
    next(err);
  }
});

router.post("/:ticketId/run", async (req, res, next) => {
  try {
    const ticket = await ticketRepo.findById(req.params.ticketId);
    if (!ticket) throw new NotFoundError("Ticket not found");
    if (isTicketInPipelineQueue(ticket.id) || isJiraKeyInPipelineQueue(ticket.jiraKey)) {
      throw new ValidationError("Ticket already active or queued");
    }
    const result = await enqueueIntakeFromJiraKey(ticket.jiraKey);
    res.status(202).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
