import { formatToolResult } from "../agenticLoop/toolResultFormatter";
import { getDirectoryListing } from "../codebaseIntelligence/directoryService";
import { getCodebaseHealth } from "../codebaseIntelligence/healthService";
import { analyzeImpact } from "../codebaseIntelligence/impactService";
import {
  getArchitectureDoc,
  getRunbook,
} from "../codebaseIntelligence/knowledgeService";
import { searchCodebaseFiles } from "../codebaseIntelligence/searchService";
import { codebaseQueryService } from "../codebaseIntelligence/queryService";
import { logger } from "../utils/logger";
import type { ToolCallInput, ToolCallResult } from "./executor";
import { executeSharedChatToolCall } from "./sharedChatToolExecutor";

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function defaultBranch(branch?: string): string {
  return branch?.trim() || "main";
}

export async function executeAnantaChatToolCall(
  toolCall: ToolCallInput,
  _sessionId: string,
  contextKey: string
): Promise<ToolCallResult> {
  const branch = defaultBranch(
    stringValue(toolCall.input.branch_name) || contextKey || undefined
  );

  logger.info({ tool: toolCall.name, branch }, "ananta chat tool executing");

  const shared = await executeSharedChatToolCall(toolCall);
  if (shared) return shared;

  try {
    let result: unknown;
    let metaQuery = toolCall.name;
    let resultsFound = 0;

    switch (toolCall.name) {
      case "search_codebase": {
        const query = stringValue(toolCall.input.query);
        metaQuery = query;
        const includeContext = toolCall.input.include_context === true;
        const { workFiles, allFiles } = await searchCodebaseFiles({
          query,
          branchName: branch,
          includeContext,
          topN: numberValue(toolCall.input.top_k, 10),
        });
        resultsFound = includeContext ? allFiles.length : workFiles.length;
        result = { workFiles, files: includeContext ? allFiles : workFiles };
        break;
      }
      case "list_directory": {
        const path = stringValue(toolCall.input.path);
        metaQuery = path || "/";
        const listing = await getDirectoryListing(branch, path);
        resultsFound = (listing.files?.length ?? 0) + (listing.directories?.length ?? 0);
        result = listing;
        break;
      }
      case "read_file": {
        const filePath = stringValue(toolCall.input.file_path);
        metaQuery = filePath;
        const includeContent = toolCall.input.include_content === true;
        const file = await codebaseQueryService.getFileIntelligence(
          branch,
          filePath,
          includeContent
        );
        resultsFound = file ? 1 : 0;
        result = { file };
        break;
      }
      case "get_architecture_doc": {
        result = await getArchitectureDoc(branch);
        resultsFound = 1;
        break;
      }
      case "get_runbook": {
        const task = stringValue(toolCall.input.task);
        metaQuery = task;
        result = await getRunbook(task, branch);
        resultsFound = 1;
        break;
      }
      case "get_codebase_health": {
        result = await getCodebaseHealth(branch);
        resultsFound = 1;
        break;
      }
      case "analyze_impact": {
        const filePath = stringValue(toolCall.input.file_path);
        metaQuery = filePath;
        result = await analyzeImpact({
          branchName: branch,
          filePaths: [filePath],
          changeDescription: stringValue(toolCall.input.change_description, "General modification"),
        });
        resultsFound = 1;
        break;
      }
      default:
        return {
          toolUseId: toolCall.toolUseId,
          content: formatToolResult(toolCall.name, { error: `Unknown tool: ${toolCall.name}` }),
          isError: true,
        };
    }

    return {
      toolUseId: toolCall.toolUseId,
      content: formatToolResult(toolCall.name, result),
      isError: false,
      meta: { query: metaQuery, resultsFound },
    };
  } catch (err) {
    logger.warn({ err, tool: toolCall.name }, "ananta chat tool failed");
    return {
      toolUseId: toolCall.toolUseId,
      content: formatToolResult(toolCall.name, {
        error: err instanceof Error ? err.message : "Tool execution failed",
      }),
      isError: true,
    };
  }
}
