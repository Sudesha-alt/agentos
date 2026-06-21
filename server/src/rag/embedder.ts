import type { ImplementationOutput, PrdOutput, QaOutput } from "../types/agents";
import type { NormalizedTicket } from "../types/ticket";
import { requireActiveOrganizationId } from "../organization/orgScope";
import { createEmbeddingVectors } from "../llm/embeddings";
import { prepareTextForEmbedding as normalizeForEmbedding } from "./chunking";
import { logger } from "../utils/logger";
import { embedNormalizedTicket } from "./ticketEmbedService";
import { vectorStore } from "./vectorStore";
import { buildEmbeddingMetadata } from "./embeddingMetadata";

export const embedder = {
  async embed(text: string): Promise<number[]> {
    const cleanedText = normalizeForEmbedding(text);
    const [embedding] = await createEmbeddingVectors([cleanedText], {
      operation: "ticket_embedding",
    });
    if (!embedding) {
      throw new Error("embedding returned empty result");
    }
    return embedding;
  },

  async embedBatch(texts: string[]): Promise<number[][]> {
    const cleaned = texts.map((t) => normalizeForEmbedding(t));
    return createEmbeddingVectors(cleaned, { operation: "ticket_embedding_batch" });
  },

  async embedTicket(
    jiraTicketId: string,
    jiraKey: string,
    ticket: Pick<
      NormalizedTicket,
      | "jiraKey"
      | "summary"
      | "description"
      | "issueType"
      | "priority"
      | "components"
      | "labels"
    >
  ): Promise<void> {
    await embedNormalizedTicket({
      jiraTicketId,
      jiraKey,
      summary: ticket.summary,
      description: ticket.description,
      issueType: ticket.issueType,
      priority: ticket.priority,
      reporter: "",
      assignee: null,
      labels: ticket.labels ?? [],
      epicLink: null,
      storyPoints: null,
      components: ticket.components,
      createdAt: new Date(),
      projectKey: jiraKey.split("-")[0] ?? "PROJ",
    });
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

    await upsertSingleVector(jiraTicketId, jiraKey, "prd", text, {
      title: prd.title,
      criteriaCount: prd.acceptanceCriteria.length,
    });
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

    await upsertSingleVector(jiraTicketId, jiraKey, "qa_report", text, {
      testCaseCount: qaReport.testCases.length,
      coveragePercent: qaReport.coverageReport.coveragePercent,
    });
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

    await upsertSingleVector(jiraTicketId, jiraKey, "implementation", text, {
      componentCount: impl.components.length,
      riskCount: impl.risks.length,
    });
  },

  async embedCanaryFinding(input: {
    findingId: string;
    jiraKey: string;
    title: string;
    description: string;
    severity: string;
    category: string;
    reproductionSteps?: string | null;
    suggestedFix?: string | null;
    affectedCode?: string | null;
  }): Promise<void> {
    const text = `
CANARY FINDING [${input.severity}/${input.category}]: ${input.title}
DESCRIPTION: ${input.description}
REPRODUCTION: ${input.reproductionSteps ?? "—"}
AFFECTED CODE: ${input.affectedCode ?? "—"}
SUGGESTED FIX: ${input.suggestedFix ?? "—"}
    `.trim();

    await upsertSingleVector(input.findingId, input.jiraKey, "canary_finding", text, {
      severity: input.severity,
      category: input.category,
    });
  },

  async embedOrgIntelligence(
    recordId: string,
    jiraKey: string,
    text: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    await upsertSingleVector(recordId, jiraKey, "org_intelligence", text, metadata);
  },

  async embedCompanyIntelligence(
    profileId: string,
    text: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    await upsertSingleVector(profileId, "COMPANY", "company_intelligence", text, metadata);
  },
};

async function upsertSingleVector(
  jiraTicketId: string,
  jiraKey: string,
  contentType: Parameters<typeof vectorStore.upsert>[0]["contentType"],
  text: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const organizationId = requireActiveOrganizationId();
  const embedding = await embedder.embed(text);
  await vectorStore.deleteByJiraKeyAndContentType(jiraKey, contentType, organizationId);
  await vectorStore.upsert({
    jiraTicketId,
    jiraKey,
    contentType,
    content: text,
    embedding,
    chunkIndex: 0,
    organizationId,
    metadata: buildEmbeddingMetadata(metadata),
  });
  logger.info({ jiraKey, contentType }, "artifact embedded");
}
