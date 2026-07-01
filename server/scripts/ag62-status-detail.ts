import "dotenv/config";
import { prisma } from "../src/db/client";

async function main() {
  const ticket = await prisma.ticket.findFirst({
    where: { jiraKey: { equals: "AG-62", mode: "insensitive" } },
    include: { pipeline: true },
  });
  if (!ticket?.pipeline) return;

  const running = await prisma.pipelineStageLog.findMany({
    where: { pipelineId: ticket.pipeline.id, status: "RUNNING" },
    orderBy: { startedAt: "desc" },
  });
  console.log("Running stages:", running.map((s) => `${s.stage} since ${s.startedAt.toISOString()}`));

  const failures = await prisma.auditLog.findMany({
    where: { pipelineId: ticket.pipeline.id, event: "PIPELINE_FAILED" },
    orderBy: { timestamp: "desc" },
    take: 5,
  });
  console.log("\nRecent PIPELINE_FAILED:");
  for (const f of failures) {
    console.log(f.timestamp.toISOString(), JSON.stringify(f.metadata));
  }

  const completed = await prisma.auditLog.findMany({
    where: { pipelineId: ticket.pipeline.id, event: "PIPELINE_COMPLETED" },
    orderBy: { timestamp: "desc" },
    take: 2,
  });
  console.log("\nPIPELINE_COMPLETED:");
  for (const c of completed) {
    console.log(c.timestamp.toISOString(), JSON.stringify(c.metadata));
  }
}

main().finally(() => prisma.$disconnect());
