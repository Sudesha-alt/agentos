/**
 * End-to-end discovery smoke test (no BullMQ).
 * Usage: npx tsx scripts/testDiscovery.ts
 */
import "dotenv/config";
import { runDiscovery } from "../src/discovery/discoveryOrchestrator";
import type { NormalizedTicket } from "../src/types/ticket";

const testTicket: NormalizedTicket = {
  jiraTicketId: "TEST-100",
  jiraKey: "TEST-100",
  summary: "Add multi-currency support to checkout",
  description: `
European customers are requesting EUR and GBP payment options.
Currently only USD is supported. We need to show prices in
the user's local currency and process payments accordingly.
Exchange rates should update daily.
  `.trim(),
  issueType: "Story",
  priority: "High",
  reporter: "Sarah Chen",
  assignee: null,
  labels: ["payments", "international", "checkout"],
  epicLink: "EPIC-42",
  storyPoints: null,
  components: ["Checkout", "Payments", "User Settings"],
  createdAt: new Date(),
  projectKey: "TEST",
};

async function main() {
  console.log("Running discovery pipeline...\n");
  const result = await runDiscovery(testTicket, "test-pipeline-001");

  console.log("\n=== DISCOVERY RESULTS ===\n");
  console.log("Requirements:", result.ticketAnalysis.atomicRequirements.length);
  console.log("Ambiguities:", result.ticketAnalysis.ambiguities.length);
  console.log("Total gaps:", result.gapAnalysis.totalGaps);
  console.log("Blocking gaps:", result.gapAnalysis.blockingGaps);
  console.log("Complexity score:", result.complexityAssessment.overallScore);
  console.log(
    "Realistic estimate:",
    result.complexityAssessment.effortEstimate.realistic,
    result.complexityAssessment.effortEstimate.unit
  );
  console.log("PRD confidence:", `${(result.prd.prdConfidence * 100).toFixed(0)}%`);
  console.log("User stories:", result.prd.userStories.length);
  console.log("Endpoints:", result.prd.technicalRequirements.endpoints.length);
  console.log("Duration:", `${result.durationMs}ms`);
  console.log("Cost USD:", result.totalCostUsd.toFixed(4));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
