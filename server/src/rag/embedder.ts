import type { ImplementationOutput, PrdOutput, QaOutput } from "../types/agents";
import type { NormalizedTicket } from "../types/ticket";
import { getOpenAIClient } from "../llm/openaiClient";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";
import { chunkTextByParagraphs, hashContent } from "./contentHash";
import { shouldSkipTicketEmbed } from "./ticketEmbedCache";
import { vectorStore } from "./vectorStore";

const EMBEDDING_MODEL = "text-embedding-3-small";

export const embedder = {
  async embed(text: string): Promise<number[]> {
    const cleanedText = prepareTextForEmbedding(text);

    const response = await withRetry(
      () =>
        getOpenAIClient().embeddings.create({
          model: EMBEDDING_MODEL,
          input: cleanedText,
        }),
      {
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
      }
    );

    return response.data[0].embedding;
  },

  async embedTicket(
    jiraTicketId: string,
    jiraKey: string,
    ticket: Pick<
      NormalizedTicket,
      "summary" | "description" | "issueType" | "priority" | "components"
    >
  ): Promise<void> {
    const text = buildStructuredTicketText(ticket);
    const contentHash = hashContent(text);

    if (await shouldSkipTicketEmbed(jiraKey, contentHash)) {
      logger.info({ jiraKey, contentHash }, "ticket embed skipped — content unchanged");
      return;
    }

    const embedding = await this.embed(text);

    await vectorStore.upsert({
      jiraTicketId,
      jiraKey,
      contentType: "ticket",
      content: text,
      embedding,
      metadata: {
        summary: ticket.summary,
        issueType: ticket.issueType,
        priority: ticket.priority,
        components: ticket.components,
        contentHash,
        chunkCount: chunkTextByParagraphs(ticket.description).length,
        embeddedAt: new Date().toISOString(),
      },
    });

    logger.info({ jiraKey }, "ticket embedded");
  },

  async embedPRD(
    jiraTicketId: string,
    jiraKey: string,
    prd: Pick<
      PrdOutput,
      | "title"
      | "problemStatement"
      | "proposedSolution"
      | "acceptanceCriteria"
      | "userStories"
      | "edgeCases"
    >
  ): Promise<void> {
    const text = `
PRD: ${prd.title}
PROBLEM: ${prd.problemStatement}
SOLUTION: ${prd.proposedSolution}
USER STORIES: ${prd.userStories.join(" | ")}
ACCEPTANCE CRITERIA: ${prd.acceptanceCriteria.join(" | ")}
EDGE CASES: ${prd.edgeCases.join(" | ")}
    `.trim();

    const embedding = await this.embed(text);

    await vectorStore.upsert({
      jiraTicketId,
      jiraKey,
      contentType: "prd",
      content: text,
      embedding,
      metadata: {
        title: prd.title,
        criteriaCount: prd.acceptanceCriteria.length,
        embeddedAt: new Date().toISOString(),
      },
    });

    logger.info({ jiraKey }, "prd embedded");
  },

  async embedQAReport(
    jiraTicketId: string,
    jiraKey: string,
    qaReport: Pick<QaOutput, "testSummary" | "testCases" | "riskAreas" | "coverageReport">
  ): Promise<void> {
    const text = `
QA REPORT SUMMARY: ${qaReport.testSummary}
RISK AREAS: ${qaReport.riskAreas.join(" | ")}
TEST CASES: ${qaReport.testCases
  .map((tc) => `${tc.title} [${tc.type}/${tc.priority}]`)
  .join(" | ")}
COVERAGE: ${qaReport.coverageReport.coveragePercent}%
    `.trim();

    const embedding = await this.embed(text);

    await vectorStore.upsert({
      jiraTicketId,
      jiraKey,
      contentType: "qa_report",
      content: text,
      embedding,
      metadata: {
        testCaseCount: qaReport.testCases.length,
        coveragePercent: qaReport.coverageReport.coveragePercent,
        embeddedAt: new Date().toISOString(),
      },
    });

    logger.info({ jiraKey }, "qa report embedded");
  },

  async embedImplementation(
    jiraTicketId: string,
    jiraKey: string,
    impl: Pick<
      ImplementationOutput,
      "summary" | "technicalApproach" | "components" | "risks"
    >
  ): Promise<void> {
    const text = `
IMPLEMENTATION: ${impl.summary}
APPROACH: ${impl.technicalApproach}
COMPONENTS: ${impl.components
  .map((c) => `${c.name}: ${c.description}`)
  .join(" | ")}
RISKS: ${impl.risks
  .map((r) => `${r.description} [${r.severity}]`)
  .join(" | ")}
    `.trim();

    const embedding = await this.embed(text);

    await vectorStore.upsert({
      jiraTicketId,
      jiraKey,
      contentType: "implementation",
      content: text,
      embedding,
      metadata: {
        componentCount: impl.components.length,
        riskCount: impl.risks.length,
        embeddedAt: new Date().toISOString(),
      },
    });

    logger.info({ jiraKey }, "implementation embedded");
  },
};

export function prepareTextForEmbedding(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/[^\w\s.,!?-]/g, "")
    .trim()
    .slice(0, 8000);
}

function buildStructuredTicketText(
  ticket: Pick<
    NormalizedTicket,
    "summary" | "description" | "issueType" | "priority" | "components"
  >
): string {
  const header = [
    `TICKET: ${ticket.summary}`,
    `TYPE: ${ticket.issueType}`,
    `PRIORITY: ${ticket.priority}`,
    `COMPONENTS: ${ticket.components.join(", ")}`,
  ].join("\n");

  const descriptionChunks = chunkTextByParagraphs(ticket.description);
  const body =
    descriptionChunks.length <= 1
      ? `DESCRIPTION: ${ticket.description}`
      : descriptionChunks
          .map((chunk, i) => `DESCRIPTION [${i + 1}/${descriptionChunks.length}]:\n${chunk}`)
          .join("\n\n");

  return `${header}\n\n${body}`.trim();
}
