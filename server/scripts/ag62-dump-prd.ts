import "dotenv/config";
import { prisma } from "../src/db/client";

async function main() {
  const ticket = await prisma.ticket.findFirst({
    where: { jiraKey: { equals: "AG-62", mode: "insensitive" } },
  });
  if (!ticket) return;
  const norm = ticket.normalizedData as Record<string, unknown>;
  const pm = norm.pmContext as Record<string, unknown> | undefined;
  const prdOut = pm?.prdOutput as Record<string, unknown> | undefined;
  const gen = pm?.generatedPrd as Record<string, unknown> | undefined;
  console.log("prdOutput keys:", Object.keys(prdOut ?? {}));
  console.log("acceptanceCriteria from prdOutput:", JSON.stringify((prdOut as any)?.acceptanceCriteria?.slice(0, 3), null, 2));
  console.log("deliverableFiles:", JSON.stringify(gen?.deliverableFiles, null, 2));

  const product = await prisma.pipelineStageLog.findFirst({
    where: { stage: "PRODUCT_AGENT", pipeline: { ticketId: ticket.id } },
  });
  console.log("\nPRODUCT output keys:", Object.keys((product?.output as object) ?? {}));
  console.log(JSON.stringify(product?.output, null, 2)?.slice(0, 1500));
}

main().finally(() => prisma.$disconnect());
