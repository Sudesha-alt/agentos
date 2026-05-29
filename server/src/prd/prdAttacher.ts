import { jiraClient } from "../integrations/jiraClient";
import { logger } from "../utils/logger";
import { estimateStoryPoints, formatPRDComment } from "./prdFormatter";
import type { GeneratedPRD } from "./prdGenerator";
import { validateGeneratedPrd } from "./prdQualityGate";

export async function attachPRDToJira(
  jiraKey: string,
  prd: GeneratedPRD
): Promise<void> {
  const quality = validateGeneratedPrd(prd);
  if (!quality.passed) {
    logger.warn({ jiraKey, issues: quality.issues }, "PRD quality gate warnings");
  }

  logger.info({ jiraKey }, "attaching PRD to Jira");

  const commentBody = formatPRDComment(prd);
  await jiraClient.addPlainTextComment(jiraKey, commentBody);
  await jiraClient.addLabels(jiraKey, ["prd-generated", "agentos-discovery"]);

  if (prd.complexitySummary?.score) {
    await jiraClient.updateStoryPoints(
      jiraKey,
      estimateStoryPoints(prd.complexitySummary.score)
    );
  }

  logger.info({ jiraKey }, "PRD attached to Jira");
}
