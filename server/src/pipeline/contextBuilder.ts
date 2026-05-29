import type { ImplementationOutput, PrdOutput } from "../types/agents";
import { contextCompressor } from "../rag/contextCompressor";
import type { NormalizedTicket } from "../types/ticket";
import type { RetrievedContext } from "../types/pipeline";

export function buildProductAgentContext(
  ticket: NormalizedTicket,
  retrievedContext: RetrievedContext[]
): string {
  const compressed = contextCompressor.compress({
    currentLabel: "Current Ticket",
    currentBody: `Key: ${ticket.jiraKey}
Type: ${ticket.issueType}
Summary: ${ticket.summary}
Description: ${ticket.description}
Priority: ${ticket.priority}
Components: ${ticket.components.join(", ") || "None specified"}`.trim(),
    retrievedContext,
  });

  return compressed.text;
}

export function buildEngineeringAgentContext(
  prd: PrdOutput,
  retrievedContext: RetrievedContext[],
  codebaseContext?: string
): string {
  const compressed = contextCompressor.compress({
    currentLabel: "Current PRD",
    currentBody: `Title: ${prd.title}
Problem Statement: ${prd.problemStatement}
Proposed Solution: ${prd.proposedSolution}
Acceptance Criteria: ${prd.acceptanceCriteria.join(" | ")}
Open Questions: ${prd.openQuestions.join(" | ") || "None"}`.trim(),
    retrievedContext,
  });

  if (!codebaseContext?.trim()) {
    return compressed.text;
  }

  return `${compressed.text}

Codebase Intelligence Snapshot:
${codebaseContext}`.trim();
}

export function buildQaAgentContext(
  prd: PrdOutput,
  implementation: ImplementationOutput,
  retrievedContext: RetrievedContext[]
): string {
  const compressed = contextCompressor.compress({
    currentLabel: "Current QA Input",
    currentBody: `PRD Title: ${prd.title}
Acceptance Criteria: ${prd.acceptanceCriteria.join(" | ")}
Implementation Summary: ${implementation.summary}
Technical Approach: ${implementation.technicalApproach}
Risks: ${implementation.risks
  .map((risk) => `${risk.description} [${risk.severity}]`)
  .join(" | ")}`.trim(),
    retrievedContext,
  });

  return compressed.text;
}
