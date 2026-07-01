import "dotenv/config";
import { prisma } from "../src/db/client";

const JIRA_KEY = process.argv[2]?.trim() || "AG-62";

async function main() {
  const ticket = await prisma.ticket.findFirst({
    where: { jiraKey: { equals: JIRA_KEY, mode: "insensitive" } },
    include: {
      pipeline: {
        include: {
          stages: { orderBy: { startedAt: "asc" } },
        },
      },
    },
  });

  if (!ticket) {
    console.log("No ticket found for", JIRA_KEY);
    return;
  }

  console.log(
    JSON.stringify(
      {
        jiraKey: ticket.jiraKey,
        ticketId: ticket.id,
        status: ticket.status,
        normalizedSummary: (ticket.normalizedData as { summary?: string })?.summary,
      },
      null,
      2
    )
  );

  const pipeline = ticket.pipeline;
  if (!pipeline) {
    console.log("No pipeline");
    return;
  }

  console.log("\nPipeline:", pipeline.id, pipeline.status, pipeline.currentStage);

  for (const log of pipeline.stages) {
    console.log("\n---", log.stage, log.status, log.error ?? "", "---");
    const out = log.output as Record<string, unknown> | null;
    if (log.stage === "PRODUCT_AGENT" && out) {
      const parsed = (out.parsed ?? out) as Record<string, unknown>;
      console.log("PRD title:", parsed.title);
      console.log("acceptanceCriteria:", JSON.stringify(parsed.acceptanceCriteria, null, 2));
      const pm = ticket.normalizedData as Record<string, unknown>;
      console.log("pmContext keys:", Object.keys((pm?.pmContext as object) ?? {}));
    }
    if (log.stage === "ENGINEERING_AGENT" && out) {
      const parsed = (out.parsed ?? out) as Record<string, unknown>;
      console.log("implementation:", JSON.stringify(parsed, null, 2)?.slice(0, 2500));
    }
    if (log.stage === "QA_AGENT" && out) {
      console.log("QA:", JSON.stringify(out, null, 2)?.slice(0, 3000));
    }
    if (log.validationResult) {
      console.log("validation:", JSON.stringify(log.validationResult, null, 2));
    }
  }

  const audits = await prisma.auditLog.findMany({
    where: { pipelineId: pipeline.id },
    orderBy: { timestamp: "desc" },
    take: 40,
  });
  console.log("\n=== Audit (engineering + QA) ===");
  for (const a of [...audits].reverse()) {
    if (/ENGINEERING|QA|PUSH|CODING/.test(a.event)) {
      console.log(a.event, JSON.stringify(a.metadata)?.slice(0, 400));
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
