import { formatToolResult } from "../agenticLoop/toolResultFormatter";
import { auditRepo } from "../db/repositories/auditRepo";
import { logger } from "../utils/logger";
import { jiraTool } from "./jiraTool";
import { ragTool } from "./ragTool";
import { validationTool } from "./validationTool";

export interface ToolCallInput {
  name: string;
  input: Record<string, unknown>;
  toolUseId: string;
}

export interface ToolCallResult {
  toolUseId: string;
  content: string;
  isError: boolean;
  meta?: {
    query: string;
    resultsFound: number;
  };
}

export async function executeToolCall(
  toolCall: ToolCallInput,
  pipelineId: string,
  jiraKey: string
): Promise<ToolCallResult> {
  const startTime = Date.now();

  logger.info(
    {
      tool: toolCall.name,
      pipelineId,
      jiraKey,
    },
    "tool call executing"
  );

  await auditRepo.log(pipelineId, "TOOL_CALL_STARTED", {
    tool: toolCall.name,
    input: toolCall.input,
  });

  try {
    let result: unknown;

    switch (toolCall.name) {
      case "search_historical_context":
        result = await ragTool.search({
          query: stringValue(toolCall.input.query),
          contentTypes: arrayOfStrings(toolCall.input.content_types) as Array<
            "ticket" | "prd" | "implementation" | "qa_report"
          >,
          topK: numberValue(toolCall.input.top_k, 4),
          similarityThreshold: numberValue(
            toolCall.input.similarity_threshold,
            0.72
          ),
          excludeJiraKey: jiraKey,
        });
        break;

      case "fetch_related_jira_tickets":
        result = await jiraTool.fetchRelated({
          jiraKey: stringValue(toolCall.input.jira_key),
          relationshipTypes: arrayOfStrings(
            toolCall.input.relationship_types
          ) as Array<
            "epic_children" | "linked" | "same_components" | "same_sprint"
          >,
        });
        break;

      case "analyse_requirement_completeness":
        result = await validationTool.analyseCompleteness({
          userStories: arrayOfObjects(toolCall.input.user_stories).map((story) => ({
            id: stringValue(story.id),
            story: stringValue(story.story),
            acceptanceCriteria: arrayOfStrings(story.acceptance_criteria),
          })),
          checkTypes: arrayOfStrings(toolCall.input.check_types),
        });
        break;

      case "score_prd_readiness":
        result = await validationTool.scorePRDReadiness({
          prdDraft: objectValue(toolCall.input.prd_draft),
          gapAnalysis: objectValue(toolCall.input.gap_analysis),
        });
        break;

      default:
        throw new Error(`Unknown tool: ${toolCall.name}`);
    }

    const durationMs = Date.now() - startTime;
    const resultSize = JSON.stringify(result).length;

    await auditRepo.log(pipelineId, "TOOL_CALL_COMPLETED", {
      tool: toolCall.name,
      durationMs,
      resultSize,
    });

    logger.info(
      {
        tool: toolCall.name,
        pipelineId,
        durationMs,
        resultSize,
      },
      "tool call completed"
    );

    return {
      toolUseId: toolCall.toolUseId,
      content: formatToolResult(toolCall.name, result),
      isError: false,
      meta: {
        query: inferQuery(toolCall.name, toolCall.input),
        resultsFound: inferResultCount(toolCall.name, result),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    logger.error(
      {
        tool: toolCall.name,
        pipelineId,
        error: message,
      },
      "tool call failed"
    );

    await auditRepo.log(pipelineId, "TOOL_CALL_FAILED", {
      tool: toolCall.name,
      error: message,
    });

    return {
      toolUseId: toolCall.toolUseId,
      content: `Tool call failed: ${message}. Proceed with the information already available.`,
      isError: true,
      meta: {
        query: inferQuery(toolCall.name, toolCall.input),
        resultsFound: 0,
      },
    };
  }
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function arrayOfObjects(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null
      )
    : [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function inferQuery(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "search_historical_context":
      return stringValue(input.query);
    case "fetch_related_jira_tickets":
      return stringValue(input.jira_key);
    case "analyse_requirement_completeness":
      return `${arrayOfObjects(input.user_stories).length} user stories`;
    case "score_prd_readiness":
      return "prd readiness";
    default:
      return toolName;
  }
}

function inferResultCount(toolName: string, result: unknown): number {
  const data =
    typeof result === "object" && result !== null
      ? (result as Record<string, unknown>)
      : {};

  switch (toolName) {
    case "search_historical_context":
      return Array.isArray(data.results) ? data.results.length : 0;
    case "fetch_related_jira_tickets":
      return Array.isArray(data.tickets) ? data.tickets.length : 0;
    case "analyse_requirement_completeness":
      return typeof data.totalIssues === "number" ? data.totalIssues : 0;
    case "score_prd_readiness":
      return typeof data.score === "number" ? 1 : 0;
    default:
      return 0;
  }
}
