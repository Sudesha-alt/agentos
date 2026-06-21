export type {
  IntakeEnqueueResult,
} from "./intakeOrchestrator";
export {
  tryIntakeEnqueue,
  tryIntakeEnqueueFromWebhook,
} from "./intakeOrchestrator";

import {
  tryIntakeEnqueue,
  tryIntakeEnqueueFromWebhook,
  type IntakeEnqueueResult,
} from "./intakeOrchestrator";
import type { PipelineJiraWebhookPayload } from "./ticketNormalizer";
import type { PmPipelineContext } from "../../agents/pm/pmPipelineContext";

/** @deprecated Use tryIntakeEnqueueFromWebhook */
export async function enqueueIntakeFromWebhook(
  payload: PipelineJiraWebhookPayload
): Promise<IntakeEnqueueResult | null> {
  return tryIntakeEnqueueFromWebhook(payload);
}

/** @deprecated Use tryIntakeEnqueue */
export async function enqueueIntakeFromJiraKey(
  jiraKey: string,
  _webhookPayload?: unknown,
  pmContext?: PmPipelineContext,
  logSource: "webhook" | "scan" | "poll" | "manual" | "startup" = "manual"
): Promise<IntakeEnqueueResult> {
  return tryIntakeEnqueue(jiraKey, logSource, pmContext);
}
