import type { ImplementationOutput, PrdOutput, QaOutput } from "../types/agents";
import type { NormalizedTicket } from "../types/ticket";
import { embedder } from "./embedder";

export const indexer = {
  async indexTicket(ticket: NormalizedTicket): Promise<void> {
    await embedder.embedTicket(ticket.jiraTicketId, ticket.jiraKey, ticket);
  },

  async indexPrd(
    jiraTicketId: string,
    jiraKey: string,
    prd: PrdOutput
  ): Promise<void> {
    await embedder.embedPRD(jiraTicketId, jiraKey, prd);
  },

  async indexImplementation(
    jiraTicketId: string,
    jiraKey: string,
    implementation: ImplementationOutput
  ): Promise<void> {
    await embedder.embedImplementation(jiraTicketId, jiraKey, implementation);
  },

  async indexQaReport(
    jiraTicketId: string,
    jiraKey: string,
    qa: QaOutput
  ): Promise<void> {
    await embedder.embedQAReport(jiraTicketId, jiraKey, qa);
  },

  async indexCanaryFindings(
    jiraKey: string,
    findings: Array<{
      id: string;
      title: string;
      description: string;
      severity: string;
      category: string;
      reproductionSteps?: string | null;
      suggestedFix?: string | null;
      affectedCode?: string | null;
    }>
  ): Promise<void> {
    for (const finding of findings) {
      await embedder.embedCanaryFinding({
        findingId: finding.id,
        jiraKey,
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        category: finding.category,
        reproductionSteps: finding.reproductionSteps,
        suggestedFix: finding.suggestedFix,
        affectedCode: finding.affectedCode,
      });
    }
  },
};
