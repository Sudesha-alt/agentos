import "dotenv/config";
import { prisma } from "../src/db/client";
import { validateQa } from "../src/validators/qaValidator";
import type { PrdOutput, QaOutput } from "../src/types/agents";
import { loadTicketPipelineInputs } from "./loadTicketPipelineInputs";

async function main() {
  const loaded = await loadTicketPipelineInputs("AG-62");
  if (!loaded?.qaOutput) {
    console.log("No AG-62 QA output");
    return;
  }
  const result = validateQa(loaded.qaOutput, loaded.prd);
  console.log("AG-62 validateQa passed:", result.passed);
  console.log("score:", result.score);
  if (!result.passed) {
    console.log("issues:", JSON.stringify(result.issues, null, 2));
  }
}

main().finally(() => prisma.$disconnect());
