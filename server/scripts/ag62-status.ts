import "dotenv/config";
import { prisma } from "../src/db/client";

const JIRA_KEY = "AG-62";

async function main() {
  const ticket = await prisma.ticket.findFirst({
    where: { jiraKey: { equals: JIRA_KEY, mode: "insensitive" } },
    include: {
      pipeline: {
        include: {
          stages: { orderBy: { startedAt: "asc" } },
          auditLogs: {
            where: {
              event: {
                in: [
                  "ENGINEERING_PUSHED_TO_BRANCH",
                  "ENGINEERING_CODING_COMPLETED",
                  "PIPELINE_COMPLETED",
                  "PIPELINE_FAILED",
                ],
              },
            },
            orderBy: { timestamp: "desc" },
            take: 5,
          },
        },
      },
    },
  });

  if (!ticket) {
    console.log("Ticket not found");
    return;
  }

  const p = ticket.pipeline;
  console.log("=== AG-62 STATUS ===\n");
  console.log("Ticket status:", ticket.status);
  console.log("Summary:", (ticket.normalizedData as { summary?: string })?.summary);
  console.log("\nPipeline ID:", p?.id ?? "(none)");
  console.log("Pipeline status:", p?.status);
  console.log("Current stage:", p?.currentStage);
  console.log("Started:", p?.startedAt?.toISOString());
  console.log("Completed:", p?.completedAt?.toISOString() ?? "(not completed)");

  if (p) {
    console.log("\n--- Stage timeline ---");
    const byStage = new Map<string, typeof p.stages>();
    for (const s of p.stages) {
      const list = byStage.get(s.stage) ?? [];
      list.push(s);
      byStage.set(s.stage, list);
    }
    for (const [stage, logs] of byStage) {
      const latest = logs[logs.length - 1]!;
      const val = latest.validationResult as { passed?: boolean; score?: number } | null;
      console.log(
        `${stage}: ${latest.status}` +
          (val ? ` (validation passed=${val.passed}, score=${val.score})` : "") +
          (latest.error ? ` ERROR: ${latest.error.slice(0, 80)}` : "") +
          ` @ ${latest.completedAt?.toISOString() ?? latest.startedAt.toISOString()}`
      );
    }

    console.log("\n--- Recent engineering audit ---");
    for (const a of p.auditLogs) {
      console.log(a.event, JSON.stringify(a.metadata));
    }

    const allAudits = await prisma.auditLog.findMany({
      where: { pipelineId: p.id, event: "ENGINEERING_PUSHED_TO_BRANCH" },
      orderBy: { timestamp: "desc" },
      take: 1,
    });
    const push = allAudits[0]?.metadata as { targetBranch?: string; commitSha?: string } | null;
    if (push) {
      console.log("\nImplementation branch:", push.targetBranch);
      console.log("Latest push SHA:", push.commitSha?.slice(0, 12));
    }
  }
}

main().finally(() => prisma.$disconnect());
