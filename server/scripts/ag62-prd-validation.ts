import "dotenv/config";
import { prisma } from "../src/db/client";
import { validatePrd } from "../src/validators/prdValidator";

async function main() {
  const ticket = await prisma.ticket.findFirst({
    where: { jiraKey: { equals: "AG-62", mode: "insensitive" } },
  });
  if (!ticket) return;

  const product = await prisma.pipelineStageLog.findFirst({
    where: { stage: "PRODUCT_AGENT", pipeline: { ticketId: ticket.id } },
    orderBy: { completedAt: "desc" },
  });
  const prdVal = await prisma.pipelineStageLog.findFirst({
    where: { stage: "PRD_VALIDATION", pipeline: { ticketId: ticket.id } },
    orderBy: { completedAt: "desc" },
  });

  const prd = (product?.output as { parsed?: unknown })?.parsed;
  const stored = prdVal?.validationResult as {
    passed?: boolean;
    score?: number;
    issues?: { code: string; message: string }[];
    amberFlags?: string[];
  };

  console.log("=== Stored PRD validation ===");
  console.log("passed:", stored?.passed, "score:", stored?.score);
  console.log("errors:", stored?.issues?.length ?? 0);
  console.log("amber flags:", stored?.amberFlags?.length ?? 0);

  if (stored?.issues?.length) {
    console.log("\nErrors:");
    for (const i of stored.issues) console.log(`  [${i.code}] ${i.message}`);
  }

  if (stored?.amberFlags?.length) {
    console.log("\nAmber flags (first 5):");
    for (const f of stored.amberFlags.slice(0, 5)) console.log(`  - ${f}`);
    if (stored.amberFlags.length > 5) {
      console.log(`  ... and ${stored.amberFlags.length - 5} more`);
    }
  }

  const norm = ticket.normalizedData as { pmContext?: unknown };
  const hasPm = !!norm?.pmContext;
  console.log("\npmContext (skips LOW_CONFIDENCE gate):", hasPm);

  const recomputed = validatePrd(prd, hasPm ? { source: "pm_agents" } : undefined);
  console.log("\n=== Recomputed ===");
  console.log("score:", recomputed.score, "passed:", recomputed.passed);
  console.log("formula: 1 - errors*0.25 - ambers*0.05");
  console.log(
    `= 1 - ${recomputed.issues.length}*0.25 - ${recomputed.amberFlags.length}*0.05 = ${recomputed.score}`
  );

  const criteria = (prd as { acceptanceCriteria?: string[] })?.acceptanceCriteria ?? [];
  console.log("\nAcceptance criteria count:", criteria.length);
  console.log("Sample criterion:", criteria[0]?.slice(0, 120));
}

main().finally(() => prisma.$disconnect());
