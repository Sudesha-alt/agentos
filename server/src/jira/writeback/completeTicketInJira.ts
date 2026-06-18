import { attachPRDToJira } from "../../prd/prdAttacher";
import { formatPRDComment } from "../../prd/prdFormatter";
import type { GeneratedPRD } from "../../prd/prdGenerator";
import { attachQaReportToJira } from "../../qa/report/reportAttacher";
import type { QaExecutionReport } from "../../qa/report/reportGenerator";
import type { ImplementationOutput, PrdOutput, QaOutput } from "../../types/agents";
import type { ValidationResult } from "../../types/pipeline";
import { getPipelineJiraClient } from "../../pipeline/jira/client";
import { getPipelineCompletionSettings } from "../../pipeline/jira/intakeConfig";
import { logger } from "../../utils/logger";
import { formatPrdDescriptionSummary, formatRcaComment } from "./rcaFormatter";
import { writeEngineeringToTicket } from "./stageWriteback";

export interface PipelineCompletionPayload {
  prd: PrdOutput;
  generatedPrd?: GeneratedPRD;
  implementation: ImplementationOutput;
  qa: QaOutput;
  executionReport?: Record<string, unknown>;
  validations: {
    prd: ValidationResult;
    implementation: ValidationResult;
    qa: ValidationResult;
  };
  canaryCriticals?: Array<{ title: string; description: string }>;
}

export interface JiraCompletionResult {
  prdAttached: boolean;
  qaAttached: boolean;
  engineeringAttached: boolean;
  rcaAttached: boolean;
  descriptionUpdated: boolean;
  jsonAttached: boolean;
  transitioned: boolean;
  transitionStatus?: string;
  errors: string[];
}

export async function completeTicketInJira(
  jiraKey: string,
  payload: PipelineCompletionPayload,
  fullJsonOutput?: Record<string, unknown>
): Promise<JiraCompletionResult> {
  const settings = getPipelineCompletionSettings();
  const client = getPipelineJiraClient();
  const result: JiraCompletionResult = {
    prdAttached: false,
    qaAttached: false,
    engineeringAttached: false,
    rcaAttached: false,
    descriptionUpdated: false,
    jsonAttached: false,
    transitioned: false,
    errors: [],
  };

  const generatedPrd = payload.generatedPrd;

  if (settings.attachPrdComment) {
    try {
      const labels = await client.getIssueLabels(jiraKey);
      if (labels.includes("prd-generated")) {
        result.prdAttached = true;
      } else if (generatedPrd) {
        await attachPRDToJira(jiraKey, generatedPrd);
        result.prdAttached = true;
      } else {
        await client.addPlainTextComment(jiraKey, formatPRDCommentFromPrdOutput(payload.prd));
        result.prdAttached = true;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`PRD comment: ${msg}`);
      logger.warn({ err, jiraKey }, "JIRA_WRITEBACK prd failed");
    }
  }

  if (settings.attachQaComment) {
    try {
      await attachQaReportToJira(
        jiraKey,
        payload.qa,
        payload.executionReport as unknown as QaExecutionReport | undefined
      );
      result.qaAttached = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`QA comment: ${msg}`);
      logger.warn({ err, jiraKey }, "JIRA_WRITEBACK qa failed");
    }
  }

  if (settings.attachEngineeringComment) {
    try {
      result.engineeringAttached = await writeEngineeringToTicket(jiraKey, payload.implementation);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Engineering comment: ${msg}`);
      logger.warn({ err, jiraKey }, "JIRA_WRITEBACK engineering failed");
    }
  }

  if (settings.attachRcaComment) {
    try {
      const rca = formatRcaComment({
        jiraKey,
        validations: payload.validations,
        qa: payload.qa,
        canaryCriticals: payload.canaryCriticals,
        engineeringSummary: payload.implementation.summary,
      });
      await client.addPlainTextComment(jiraKey, rca);
      result.rcaAttached = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`RCA comment: ${msg}`);
    }
  }

  if (settings.updateDescription) {
    try {
      const summary = formatPrdDescriptionSummary({
        title: payload.prd.title,
        problemStatement: payload.prd.problemStatement,
        proposedSolution: payload.prd.proposedSolution,
        successDefinition: generatedPrd?.successDefinition,
      });
      await client.updateIssueDescription(jiraKey, summary);
      result.descriptionUpdated = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Description update: ${msg}`);
    }
  }

  if (settings.attachJsonArtifact && fullJsonOutput) {
    try {
      await client.addAttachmentNote(jiraKey, "Agentos pipeline output", fullJsonOutput);
      result.jsonAttached = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`JSON artifact: ${msg}`);
    }
  }

  if (settings.completionStatusName) {
    try {
      result.transitioned = await client.transitionToStatus(
        jiraKey,
        settings.completionStatusName
      );
      if (result.transitioned) {
        result.transitionStatus = settings.completionStatusName;
      } else {
        result.errors.push(
          `Transition to "${settings.completionStatusName}" not available in workflow`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Transition: ${msg}`);
      logger.warn({ err, jiraKey }, "JIRA_TRANSITION_FAILED");
    }
  }

  return result;
}

function formatPRDCommentFromPrdOutput(prd: PrdOutput): string {
  const stub: GeneratedPRD = {
    title: prd.title,
    version: "1.0",
    status: "Draft",
    jiraKey: "",
    createdAt: new Date().toISOString(),
    priority: "Medium",
    effortEstimate: "TBD",
    problemStatement: prd.problemStatement,
    proposedSolution: prd.proposedSolution,
    successDefinition: prd.proposedSolution,
    userPersonas: [],
    userStories: prd.userStories.map((s, i) => ({
      id: `US-${i + 1}`,
      story: s,
      acceptanceCriteria: prd.acceptanceCriteria,
      priority: "must-have" as const,
    })),
    technicalRequirements: {
      endpoints: [],
      dataModel: [],
      systemsAffected: [],
      technicalAssumptions: [],
    },
    nonFunctionalRequirements: [],
    assumptions: [],
    outOfScope: [],
    openQuestions: prd.openQuestions.map((q) => ({
      question: q,
      impact: "",
      defaultAssumption: "",
      owner: "",
    })),
    risks: [],
    successMetrics: [],
    complexitySummary: {
      score: prd.confidenceScore * 10,
      effortOptimistic: "",
      effortRealistic: "",
      effortPessimistic: "",
      keyComplexityDrivers: [],
    },
    prdConfidence: prd.confidenceScore,
    confidenceNotes: "",
  };
  return formatPRDComment(stub);
}
