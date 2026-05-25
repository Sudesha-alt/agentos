import { completionJson } from "../llm/discoveryCompletion";
import type { NormalizedTicket } from "../types/ticket";
import { logger } from "../utils/logger";

export interface TicketAnalysis {
  coreIntent: string;
  atomicRequirements: Array<{
    id: string;
    description: string;
    type: "functional" | "non-functional" | "constraint";
    source: "explicit" | "implicit";
    clarity: "clear" | "ambiguous" | "missing";
  }>;
  ambiguities: Array<{
    description: string;
    impact: "blocking" | "high" | "medium" | "low";
    question: string;
  }>;
  userPersonas: Array<{
    persona: string;
    need: string;
    currentPain: string;
  }>;
  systemsAffected: string[];
  roughComplexity: "trivial" | "small" | "medium" | "large" | "epic";
  workType:
    | "new-feature"
    | "enhancement"
    | "integration"
    | "refactor"
    | "infrastructure";
  understandingConfidence: number;
}

export async function analyseTicket(
  ticket: NormalizedTicket,
  pipelineId: string
): Promise<{ analysis: TicketAnalysis; usage: import("../llm/discoveryCompletion").LlmUsage }> {
  logger.info({ jiraKey: ticket.jiraKey, pipelineId }, "starting ticket analysis");

  const systemPrompt = `
You are a principal product manager with 15 years of experience
in B2B SaaS. You read tickets and understand what is actually being
asked versus what is written. You flag ambiguities before sprint failure.

Your job is NOT to write requirements. Your job is to deeply understand
what this ticket is asking for before anyone writes code or requirements.

Return ONLY valid JSON. No markdown. No explanation outside JSON.
  `.trim();

  const userPrompt = `
Analyse this Jira ticket deeply. Break it down completely.

TICKET DATA:
Key: ${ticket.jiraKey}
Type: ${ticket.issueType}
Priority: ${ticket.priority}
Summary: ${ticket.summary}
Description: ${ticket.description}
Components: ${ticket.components.join(", ") || "Not specified"}
Labels: ${ticket.labels.join(", ") || "None"}
Story Points: ${ticket.storyPoints ?? "Not estimated"}
Reporter: ${ticket.reporter}

Return this exact JSON structure:
{
  "coreIntent": "One sentence",
  "atomicRequirements": [
    {
      "id": "REQ-001",
      "description": "Single atomic requirement",
      "type": "functional | non-functional | constraint",
      "source": "explicit | implicit",
      "clarity": "clear | ambiguous | missing"
    }
  ],
  "ambiguities": [
    {
      "description": "What is unclear",
      "impact": "blocking | high | medium | low",
      "question": "Specific question to answer"
    }
  ],
  "userPersonas": [
    {
      "persona": "Who this affects",
      "need": "What they need",
      "currentPain": "Current problem"
    }
  ],
  "systemsAffected": ["systems touched"],
  "roughComplexity": "trivial | small | medium | large | epic",
  "workType": "new-feature | enhancement | integration | refactor | infrastructure",
  "understandingConfidence": 0.0
}

Rules:
- Separate explicit vs implicit requirements
- Every ambiguity must include the resolving question
- Flag hidden requirements: auth, permissions, logging, errors, empty states, mobile, performance
  `.trim();

  const { parsed, usage } = await completionJson<TicketAnalysis>({
    source: "ticketAnalyser",
    systemPrompt,
    userPrompt,
    maxTokens: 3000,
  });

  logger.info(
    {
      jiraKey: ticket.jiraKey,
      requirementsFound: parsed.atomicRequirements.length,
      ambiguitiesFound: parsed.ambiguities.length,
      confidence: parsed.understandingConfidence,
    },
    "ticket analysis complete"
  );

  return { analysis: parsed, usage };
}
