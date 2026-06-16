import { formatToolResult } from "../agenticLoop/toolResultFormatter";
import { auditRepo } from "../db/repositories/auditRepo";
import { searchCodebaseFiles } from "../codebaseIntelligence/searchService";
import {
  getCodingArtifacts,
} from "../engineering/codingArtifactStore";
import { githubClient } from "../integrations/githubClient";
import { logger } from "../utils/logger";
import type { ToolCallInput, ToolCallResult } from "./executor";

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function arrayOfStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function defaultBranch(branchName?: string): string {
  return branchName || process.env.GITHUB_DEFAULT_BRANCH || "main";
}

export async function executeEngineeringCodingToolCall(
  toolCall: ToolCallInput,
  pipelineId: string,
  jiraKey: string
): Promise<ToolCallResult> {
  const startTime = Date.now();

  logger.info(
    { tool: toolCall.name, pipelineId, jiraKey },
    "engineering coding tool call executing"
  );

  await auditRepo.log(pipelineId, "CODING_TOOL_CALL_STARTED", {
    tool: toolCall.name,
    input: toolCall.input,
  });

  try {
    let result: unknown;
    let metaQuery = toolCall.name;
    let resultsFound = 0;

    switch (toolCall.name) {
      case "read_source_file": {
        const filePath = stringValue(toolCall.input.file_path);
        const branch = defaultBranch(stringValue(toolCall.input.branch_name));
        try {
          const file = await githubClient.getFileContent(filePath, branch);
          result = {
            path: file.path,
            branch,
            size: file.size,
            content: file.content,
          };
          resultsFound = 1;
        } catch (error) {
          result = {
            path: filePath,
            branch,
            error: error instanceof Error ? error.message : String(error),
          };
        }
        metaQuery = filePath;
        break;
      }

      case "search_codebase": {
        const query = stringValue(toolCall.input.query);
        const branch = defaultBranch(stringValue(toolCall.input.branch_name));
        const includeContext = toolCall.input.include_context === true;
        const { workFiles, allFiles } = await searchCodebaseFiles({
          query,
          branchName: branch,
          includeContext,
          topN: 10,
        });
        const base = includeContext ? allFiles : workFiles;
        const filters = arrayOfStrings(toolCall.input.filter_patterns);
        const results = filters.length
          ? base.filter((hit) =>
              filters.some((pattern) => String(hit.path ?? "").includes(pattern))
            )
          : base;
        result = { query, branch, workFiles, results };
        resultsFound = results.length;
        metaQuery = query;
        break;
      }

      case "write_source_file": {
        const filePath = stringValue(toolCall.input.file_path);
        const content = stringValue(toolCall.input.content);
        const branch = defaultBranch(stringValue(toolCall.input.branch_name));
        const action = stringValue(toolCall.input.action, "modify") as
          | "create"
          | "modify";
        const summary = stringValue(toolCall.input.summary);
        const artifacts = getCodingArtifacts(pipelineId);
        artifacts.stagedFiles.push({
          filePath,
          content,
          branchName: branch,
          action,
          summary,
        });
        result = {
          staged: true,
          filePath,
          branch,
          action,
          summary,
          note: "Source file staged for pipeline (not pushed to GitHub).",
        };
        resultsFound = 1;
        metaQuery = filePath;
        break;
      }

      default:
        throw new Error(`Unknown engineering coding tool: ${toolCall.name}`);
    }

    const durationMs = Date.now() - startTime;
    await auditRepo.log(pipelineId, "CODING_TOOL_CALL_COMPLETED", {
      tool: toolCall.name,
      durationMs,
      resultsFound,
    });

    return {
      toolUseId: toolCall.toolUseId,
      content: formatToolResult(toolCall.name, result),
      isError: false,
      meta: { query: metaQuery, resultsFound },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(
      { tool: toolCall.name, pipelineId, message },
      "engineering coding tool call failed"
    );

    await auditRepo.log(pipelineId, "CODING_TOOL_CALL_FAILED", {
      tool: toolCall.name,
      error: message,
    });

    return {
      toolUseId: toolCall.toolUseId,
      content: formatToolResult(toolCall.name, { error: message }),
      isError: true,
      meta: { query: toolCall.name, resultsFound: 0 },
    };
  }
}
