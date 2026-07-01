import "dotenv/config";
import { prisma } from "../src/db/client";
import { validateQa } from "../src/validators/qaValidator";
import type { ImplementationOutput, PrdOutput, QaOutput } from "../src/types/agents";

const JIRA_KEY = "AG-62";

async function main() {
  const product = await prisma.pipelineStageLog.findFirst({
    where: {
      stage: "PRODUCT_AGENT",
      pipeline: { ticket: { jiraKey: { equals: JIRA_KEY, mode: "insensitive" } } },
    },
    orderBy: { startedAt: "desc" },
  });
  const eng = await prisma.pipelineStageLog.findFirst({
    where: {
      stage: "ENGINEERING_AGENT",
      pipeline: { ticket: { jiraKey: { equals: JIRA_KEY, mode: "insensitive" } } },
    },
    orderBy: { startedAt: "desc" },
  });
  const qaLog = await prisma.pipelineStageLog.findFirst({
    where: {
      stage: "QA_AGENT",
      pipeline: { ticket: { jiraKey: { equals: JIRA_KEY, mode: "insensitive" } } },
    },
    orderBy: { startedAt: "desc" },
  });

  const prd = (product?.output as { parsed?: PrdOutput })?.parsed;
  const implementation = (eng?.output as { parsed?: ImplementationOutput })?.parsed;
  const qaOutput = (qaLog?.output as { qa?: QaOutput })?.qa;

  if (!prd || !implementation || !qaOutput) {
    console.log("Missing stage outputs");
    return;
  }

  console.log("PRD criteria count:", prd.acceptanceCriteria.length);
  console.log("First PRD criterion:", prd.acceptanceCriteria[0]);
  console.log("First QA linkedCriterion:", qaOutput.testCases[0]?.linkedCriterion);
  console.log("Target files:", implementation.targetFiles);
  console.log("Coverage report:", qaOutput.coverageReport);

  const validation = validateQa(qaOutput, prd);
  console.log("\nvalidateQa result:", JSON.stringify(validation, null, 2));

  // Show normalize comparison
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const linked = new Set(qaOutput.testCases.map((tc) => norm(tc.linkedCriterion)));
  let matches = 0;
  for (const c of prd.acceptanceCriteria) {
    if (linked.has(norm(c))) matches++;
    else {
      const withNum = qaOutput.testCases.find((tc) =>
        norm(tc.linkedCriterion).includes(norm(c).slice(0, 40))
      );
      console.log("NO EXACT MATCH:", c.slice(0, 80));
      if (withNum) console.log("  partial QA link:", withNum.linkedCriterion.slice(0, 80));
    }
  }
  console.log("\nExact normalized matches:", matches, "/", prd.acceptanceCriteria.length);
}

main()
  .finally(() => prisma.$disconnect());
