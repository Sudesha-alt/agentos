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
};
