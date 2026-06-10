import { prisma } from "../db/client";
import { embedder } from "../rag/embedder";
import type { ImplementationOutput, PrdOutput, QaOutput } from "../types/agents";
import type { ValidationResult } from "../types/pipeline";
import { logger } from "../utils/logger";

export type OrgIntelSourceType =
  | "PRD"
  | "ENGINEERING"
  | "QA_FAILURE"
  | "CANARY"
  | "OVERRIDE"
  | "PIPELINE_COMPLETE"
  | "COMPANY_PROFILE";

export const orgIntelligence = {
  async capture(input: {
    sourceType: OrgIntelSourceType;
    jiraKey: string;
    pipelineId?: string;
    component?: string;
    signal: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const record = await prisma.orgIntelligenceRecord.create({
        data: {
          sourceType: input.sourceType,
          jiraKey: input.jiraKey,
          pipelineId: input.pipelineId,
          component: input.component,
          signal: input.signal,
          metadata: (input.metadata ?? {}) as object,
        },
      });

      const text = [
        `Source: ${input.sourceType}`,
        `Ticket: ${input.jiraKey}`,
        input.component ? `Component: ${input.component}` : "",
        input.signal,
        input.metadata ? JSON.stringify(input.metadata).slice(0, 2000) : "",
      ]
        .filter(Boolean)
        .join("\n");

      await embedder.embedOrgIntelligence(record.id, input.jiraKey, text, {
        sourceType: input.sourceType,
        component: input.component,
      });

      logger.info(
        { id: record.id, sourceType: input.sourceType, jiraKey: input.jiraKey },
        "ORG_INTEL_CAPTURED"
      );
    } catch (err) {
      logger.warn({ err, jiraKey: input.jiraKey }, "org intelligence capture failed");
    }
  },

  async captureValidation(input: {
    pipelineId: string;
    jiraKey: string;
    sourceType: OrgIntelSourceType;
    validation: ValidationResult;
    components: string[];
    implementation?: ImplementationOutput;
    qa?: QaOutput;
  }): Promise<void> {
    const component = input.components[0];
    const signal = input.validation.passed
      ? `${input.sourceType} validation passed`
      : `${input.sourceType} validation failed: ${input.validation.issues.map((i) => i.message).join("; ")}`;

    await this.capture({
      sourceType: input.sourceType,
      jiraKey: input.jiraKey,
      pipelineId: input.pipelineId,
      component,
      signal,
      metadata: {
        passed: input.validation.passed,
        score: input.validation.score,
        issues: input.validation.issues,
        testCaseIds: input.qa?.testCases?.map((t) => t.id),
        filesChanged: input.implementation?.codeChanges?.map((c) => c.filePath),
      },
    });
  },

  async capturePipelineComplete(input: {
    pipelineId: string;
    jiraKey: string;
    components: string[];
    prd: PrdOutput;
    implementation: ImplementationOutput;
    qa: QaOutput;
    validations: {
      prd: ValidationResult;
      implementation: ValidationResult;
      qa: ValidationResult;
    };
  }): Promise<void> {
    await this.capture({
      sourceType: "PIPELINE_COMPLETE",
      jiraKey: input.jiraKey,
      pipelineId: input.pipelineId,
      component: input.components[0],
      signal: `Pipeline completed for ${input.prd.title}: ${input.implementation.summary?.slice(0, 500) ?? ""}`,
      metadata: {
        prdTitle: input.prd.title,
        testCount: input.qa.testCases?.length ?? 0,
        codeFiles: input.implementation.codeChanges?.length ?? 0,
        validations: {
          prd: input.validations.prd.passed,
          implementation: input.validations.implementation.passed,
          qa: input.validations.qa.passed,
        },
      },
    });
  },

  async listRecent(options: { limit?: number; jiraKey?: string; sourceType?: string } = {}) {
    return prisma.orgIntelligenceRecord.findMany({
      where: {
        ...(options.jiraKey ? { jiraKey: options.jiraKey } : {}),
        ...(options.sourceType ? { sourceType: options.sourceType } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: options.limit ?? 50,
    });
  },
};
