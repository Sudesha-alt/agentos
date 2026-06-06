import { getPipelineJiraClient } from "../../pipeline/jira/client";
import { logger } from "../../utils/logger";
import type { QaOutput } from "../../types/agents";
import { formatQaReportForJira } from "./reportFormatter";
import type { QaExecutionReport } from "./reportGenerator";

export async function attachQaReportToJira(
  jiraKey: string,
  qaOutput: QaOutput,
  executionReport?: QaExecutionReport
): Promise<void> {
  logger.info({ jiraKey }, "attaching QA report to Jira");

  const body = formatQaReportForJira(qaOutput, executionReport);
  const client = getPipelineJiraClient();
  await client.addPlainTextComment(jiraKey, body);
  await client.addLabels(jiraKey, ["qa-generated", "agentos-qa"]);

  logger.info({ jiraKey }, "QA report attached to Jira");
}
