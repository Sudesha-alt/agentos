import "dotenv/config";
import { prisma } from "../src/db/client";
import { validateQa, normalizeCriterion } from "../src/validators/qaValidator";
import { loadTicketPipelineInputs } from "./loadTicketPipelineInputs";

async function main() {
  const loaded = await loadTicketPipelineInputs("AG-62");
  if (!loaded?.qaOutput) {
    console.error("FAIL: no AG-62 QA output in DB");
    process.exit(1);
  }

  const { prd, qaOutput } = loaded;
  const linked = qaOutput.testCases.map((tc) => tc.linkedCriterion);

  let exactMatches = 0;
  let normalizedMatches = 0;
  for (const c of prd.acceptanceCriteria) {
    const normPrd = normalizeCriterion(c);
    if (linked.some((l) => l.trim() === c.trim())) exactMatches++;
    if (linked.some((l) => normalizeCriterion(l) === normPrd)) normalizedMatches++;
  }

  console.log("=== AG-62 QA validator verification ===");
  console.log(`PRD criteria: ${prd.acceptanceCriteria.length}`);
  console.log(`Neel test cases: ${qaOutput.testCases.length}`);
  console.log(`Exact text matches (old behavior): ${exactMatches}/${prd.acceptanceCriteria.length}`);
  console.log(`Normalized matches (new behavior): ${normalizedMatches}/${prd.acceptanceCriteria.length}`);
  console.log(`Neel reported coverage: ${qaOutput.coverageReport.coveredCriteria}/${qaOutput.coverageReport.totalCriteria}`);

  const result = validateQa(qaOutput, prd);
  console.log(`\nvalidateQa passed: ${result.passed}`);
  console.log(`score: ${result.score}`);
  if (result.amberFlags.length) console.log(`amberFlags: ${result.amberFlags.join("; ")}`);
  if (result.issues.length) {
    console.log("issues:");
    for (const i of result.issues) console.log(`  - [${i.code}] ${i.message}`);
  }

  const ok =
    result.passed &&
    normalizedMatches === prd.acceptanceCriteria.length &&
    exactMatches === 0;
  console.log(`\n${ok ? "VERIFICATION PASS" : "VERIFICATION FAIL"}`);
  process.exit(ok ? 0 : 1);
}

main().finally(() => prisma.$disconnect());
