import type { IntentClassification, NormalizedTicket } from "../types/ticket";
import {
  aiWorkerEligibleTypeLabel,
  isAiWorkerEligibleIssueType,
} from "../pipeline/jira/aiWorkerIssueTypes";

const SKIP_TYPES = new Set(["Bug", "Task", "Sub-task", "Spike"]);
const MIN_DESCRIPTION_LENGTH = 50;

/** AI Worker column — only Task and Bug tickets enter the pipeline. */
export function classifyAiWorkerIntake(
  ticket: NormalizedTicket
): IntentClassification {
  if (ticket.summary.toLowerCase().includes("[no-agent]")) {
    return {
      requiresPipeline: false,
      skipReason: "Manually excluded via [no-agent] flag",
    };
  }

  if (!isAiWorkerEligibleIssueType(ticket.issueType)) {
    return {
      requiresPipeline: false,
      skipReason: `AI Worker only processes ${aiWorkerEligibleTypeLabel()} tickets (got ${ticket.issueType})`,
    };
  }

  return {
    requiresPipeline: true,
    confidence: calculateConfidence(ticket),
  };
}

export function classifyIntent(
  ticket: NormalizedTicket
): IntentClassification {
  if (SKIP_TYPES.has(ticket.issueType)) {
    return {
      requiresPipeline: false,
      skipReason: `Issue type ${ticket.issueType} does not require pipeline`,
    };
  }

  if (ticket.description.length < MIN_DESCRIPTION_LENGTH) {
    return {
      requiresPipeline: false,
      skipReason: "Description too short for pipeline processing",
    };
  }

  if (ticket.summary.toLowerCase().includes("[no-agent]")) {
    return {
      requiresPipeline: false,
      skipReason: "Manually excluded via [no-agent] flag",
    };
  }

  return {
    requiresPipeline: true,
    confidence: calculateConfidence(ticket),
  };
}

function calculateConfidence(ticket: NormalizedTicket): number {
  let score = 0.5;
  if (ticket.description.length > 200) score += 0.2;
  if (ticket.storyPoints && ticket.storyPoints > 3) score += 0.1;
  if (ticket.epicLink) score += 0.1;
  if (ticket.components.length > 0) score += 0.1;
  return Math.min(score, 1.0);
}
