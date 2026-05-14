import { Router } from "express";
import { prisma } from "../../db/client";
import { pipelineRepo } from "../../db/repositories/pipelineRepo";
import { ticketRepo } from "../../db/repositories/ticketRepo";
import { jobQueue, JOB_NAMES } from "../../queue/jobQueue";
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

router.get("/:pipelineId", async (req, res, next) => {
  try {
    const pipeline = await pipelineRepo.findWithLatestStages(req.params.pipelineId);
    if (!pipeline) throw new NotFoundError("Pipeline not found");
    res.json(pipeline);
  } catch (err) {
    next(err);
  }
});

router.post("/:ticketId/run", async (req, res, next) => {
  try {
    const ticket = await ticketRepo.findById(req.params.ticketId);
    if (!ticket) throw new NotFoundError("Ticket not found");
    if (ticket.status === "PROCESSING") {
      throw new ValidationError("Ticket already processing");
    }
    const job = await jobQueue.add(JOB_NAMES.RUN_PIPELINE, {
      ticketId: ticket.id,
    });
    res.status(202).json({ jobId: job.id, ticketId: ticket.id });
  } catch (err) {
    next(err);
  }
});

export default router;
