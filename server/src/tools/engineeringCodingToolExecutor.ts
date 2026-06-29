import { formatToolResult } from "../agenticLoop/toolResultFormatter";
import { auditRepo } from "../db/repositories/auditRepo";
import { buildEnrichedCodebaseContext } from "../codebaseIntelligence/enrichedContextService";
import { emitEngineeringCodingEvent } from "../engineering/codingEventsHub";
import {
  getEngWorkspace,
  workspaceApplyEdit,
  workspaceDeleteFile,
  workspaceFileExists,
  workspaceGrep,
  workspaceListDir,
  workspaceReadFile,
  workspaceRunCommand,
  workspaceWriteFile,
} from "../engineering/engineeringWorkspace";
import { githubClient } from "../integrations/githubClient";
import { resolveToolFilePath } from "../integrations/git/normalizePushFiles";
import { resolveRepoScope } from "../codebaseIntelligence/repoScope";
import {
  getCodingArtifacts,
  markCodingFileWritten,
  resolveWriteTargetPath,
  setCodingDeliverablePaths,
} from "../engineering/codingArtifactStore";
import { logger } from "../utils/logger";
import type { ToolCallInput, ToolCallResult } from "./executor";

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Build a short human-readable label for a tool call that is shown in the live UI. */
function buildDisplayLabel(toolName: string, input: Record<string, unknown>): string {
  const filePath = typeof input.file_path === "string" ? input.file_path : "";
  const fileName = filePath ? filePath.split("/").pop() ?? filePath : "";
  switch (toolName) {
    case "read_file":
    case "read_source_file":
      return filePath ? `Reading ${fileName}` : "Reading file";
    case "write_file":
    case "write_source_file":
      return filePath ? `Writing ${fileName}` : "Writing file";
    case "edit_file":
      return filePath ? `Editing ${fileName}` : "Editing file";
    case "delete_file":
      return filePath ? `Deleting ${fileName}` : "Deleting file";
    case "list_dir": {
      const dir = typeof input.dir_path === "string" ? input.dir_path : ".";
      return `Listing ${dir}`;
    }
    case "grep": {
      const pattern = typeof input.pattern === "string" ? input.pattern.slice(0, 40) : "";
      return `Grepping for "${pattern}"`;
    }
    case "search_codebase": {
      const query = typeof input.query === "string" ? input.query.slice(0, 50) : "";
      return `Searching codebase: "${query}"`;
    }
    case "run_command": {
      const cmd = typeof input.command === "string" ? input.command.slice(0, 60) : "command";
      return `Running: ${cmd}`;
    }
    default:
      return toolName.replace(/_/g, " ");
  }
}

function arrayOfStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function defaultBranch(branchName?: string): string {
  if (branchName?.trim()) return branchName.trim();
  return (
    resolveRepoScope()?.defaultBranch ||
    process.env.GITHUB_DEFAULT_BRANCH?.trim() ||
    "main"
  );
}

function requireFilePath(
  toolCall: ToolCallInput
): { filePath: string } | { error: string } {
  const filePath = resolveToolFilePath(toolCall.input as Record<string, unknown>);
  if (!filePath) {
    return {
      error:
        "file_path is required and must be a non-empty repo-relative path (e.g. docs/curriculum/guide.md).",
    };
  }
  return { filePath };
}

function resolveWriteFilePath(
  pipelineId: string,
  toolCall: ToolCallInput
): { filePath: string; inferred?: boolean } | { error: string } {
  const resolved = resolveWriteTargetPath(
    pipelineId,
    toolCall.input as Record<string, unknown>
  );
    if (resolved) {
      if (resolved.inferred || resolved.redirected) {
        logger.info(
          {
            pipelineId,
            inferredPath: resolved.filePath,
            redirected: resolved.redirected ?? false,
          },
          "resolved write_file path from PRD deliverables"
        );
      }
      return {
        filePath: resolved.filePath,
        inferred: resolved.inferred || resolved.redirected,
      };
    }

  return {
    error:
      "file_path is required and must be a non-empty repo-relative path " +
      "(e.g. docs/curriculum/guide.md).",
  };
}

export async function executeEngineeringCodingToolCall(
  toolCall: ToolCallInput,
  pipelineId: string,
  jiraKey: string
): Promise<ToolCallResult> {
  const startTime = Date.now();
  const workspace = getEngWorkspace(pipelineId);

  logger.info(
    { tool: toolCall.name, pipelineId, jiraKey, hasWorkspace: Boolean(workspace) },
    "engineering coding tool call executing"
  );

  await auditRepo.log(pipelineId, "CODING_TOOL_CALL_STARTED", {
    tool: toolCall.name,
    input: toolCall.input,
  });

  const displayLabel = buildDisplayLabel(toolCall.name, toolCall.input as Record<string, unknown>);
  emitEngineeringCodingEvent({
    type: "tool_started",
    pipelineId,
    tool: toolCall.name,
    displayLabel,
    input: toolCall.input as Record<string, unknown>,
    timestamp: new Date().toISOString(),
  });

  try {
    let result: unknown;
    let metaQuery = toolCall.name;
    let resultsFound = 0;

    switch (toolCall.name) {
      // ── Navigation ─────────────────────────────────────────────────────────
      case "list_dir": {
        const dirPath = stringValue(toolCall.input.dir_path, ".");
        if (!workspace) {
          result = { error: "No workspace available — list_dir requires a local workspace." };
          break;
        }
        const entries = workspaceListDir(workspace.workspaceDir, dirPath);
        result = { dirPath, entries, count: entries.length };
        resultsFound = entries.length;
        metaQuery = dirPath;
        break;
      }

      // ── Reading ─────────────────────────────────────────────────────────────
      case "read_file": {
        const resolved = requireFilePath(toolCall);
        if ("error" in resolved) {
          result = { error: resolved.error };
          break;
        }
        const filePath = resolved.filePath;
        metaQuery = filePath;

        if (workspace) {
          try {
            const content = workspaceReadFile(workspace.workspaceDir, filePath);
            result = { path: filePath, content, source: "workspace" };
            resultsFound = 1;
          } catch (err) {
            result = {
              path: filePath,
              error: err instanceof Error ? err.message : String(err),
              source: "workspace",
            };
          }
        } else {
          // Fallback: GitHub Contents API
          try {
            const branch = defaultBranch();
            const file = await githubClient.getFileContent(filePath, branch);
            result = { path: file.path, content: file.content, source: "github" };
            resultsFound = 1;
          } catch (err) {
            result = {
              path: filePath,
              error: err instanceof Error ? err.message : String(err),
            };
          }
        }
        break;
      }

      // Backward-compat alias
      case "read_source_file": {
        const resolved = requireFilePath(toolCall);
        if ("error" in resolved) {
          result = { error: resolved.error };
          break;
        }
        const filePath = resolved.filePath;
        const branch = defaultBranch(stringValue(toolCall.input.branch_name));
        metaQuery = filePath;

        if (workspace && workspaceFileExists(workspace.workspaceDir, filePath)) {
          try {
            const content = workspaceReadFile(workspace.workspaceDir, filePath);
            result = { path: filePath, branch: workspace.branchName, content };
            resultsFound = 1;
          } catch (err) {
            result = { path: filePath, error: err instanceof Error ? err.message : String(err) };
          }
        } else {
          try {
            const file = await githubClient.getFileContent(filePath, branch);
            result = { path: file.path, branch, content: file.content };
            resultsFound = 1;
          } catch (err) {
            result = { path: filePath, branch, error: err instanceof Error ? err.message : String(err) };
          }
        }
        break;
      }

      // ── Semantic search ─────────────────────────────────────────────────────
      case "search_codebase": {
        const query = stringValue(toolCall.input.query);
        const branchName = workspace?.sourceBranch ?? defaultBranch(stringValue(toolCall.input.branch_name));
        const bundle = await buildEnrichedCodebaseContext({
          query,
          branchName,
          topN: 10,
          fetchFreshContent: !workspace, // fetch fresh only when no local workspace
        });

        const filters = arrayOfStrings(toolCall.input.filter_patterns);
        const filteredFiles = filters.length
          ? bundle.files.filter((f) => filters.some((p) => f.path.includes(p)))
          : bundle.files;

        // Phase 1b: override contentPreview with live workspace content when available
        const enrichedFiles = filteredFiles.map((f) => {
          if (!workspace) return f;
          try {
            const liveContent = workspaceReadFile(workspace.workspaceDir, f.path);
            return {
              ...f,
              contentPreview: liveContent.slice(0, 4000),
              contentSource: "workspace" as const,
            };
          } catch {
            // File not in workspace (new file or path mismatch) — keep indexed preview
            return f;
          }
        });

        result = { query, branchName, ...bundle, files: enrichedFiles };
        resultsFound = enrichedFiles.length;
        metaQuery = query;
        break;
      }

      // ── Literal grep ────────────────────────────────────────────────────────
      case "grep": {
        const pattern = stringValue(toolCall.input.pattern);
        const fileGlob = stringValue(toolCall.input.file_glob) || undefined;
        metaQuery = pattern;

        if (!workspace) {
          result = { error: "No workspace available — grep requires a local workspace." };
          break;
        }
        const matches = await workspaceGrep(workspace.workspaceDir, pattern, fileGlob);
        result = { pattern, fileGlob, matches, count: matches.length };
        resultsFound = matches.length;
        break;
      }

      // ── Incremental edit ────────────────────────────────────────────────────
      case "edit_file": {
        const writeResolved = resolveWriteTargetPath(
          pipelineId,
          toolCall.input as Record<string, unknown>
        );
        let filePath: string;
        if (writeResolved) {
          filePath = writeResolved.filePath;
        } else {
          const required = requireFilePath(toolCall);
          if ("error" in required) {
            result = { error: required.error };
            break;
          }
          filePath = required.filePath;
        }
        const oldString = stringValue(toolCall.input.old_string);
        const newString = stringValue(toolCall.input.new_string);
        const summary = stringValue(toolCall.input.summary);
        metaQuery = filePath;

        if (!workspace) {
          result = { error: "No workspace available — edit_file requires a local workspace." };
          break;
        }
        if (
          !workspaceFileExists(workspace.workspaceDir, filePath) &&
          newString.trim()
        ) {
          workspaceWriteFile(workspace.workspaceDir, filePath, newString);
          markCodingFileWritten(pipelineId, filePath);
          emitEngineeringCodingEvent({
            type: "file_staged",
            pipelineId,
            filePath,
            action: "create",
            summary,
            contentLength: newString.length,
            timestamp: new Date().toISOString(),
          });
          result = {
            filePath,
            summary,
            replaced: true,
            occurrences: 1,
            note: "File did not exist — created via write fallback.",
          };
          resultsFound = 1;
          break;
        }
        const editResult = workspaceApplyEdit(
          workspace.workspaceDir,
          filePath,
          oldString,
          newString
        );
        if (editResult.replaced) {
          markCodingFileWritten(pipelineId, filePath);
          emitEngineeringCodingEvent({
            type: "file_staged",
            pipelineId,
            filePath,
            action: "modify",
            summary,
            contentLength: newString.length,
            timestamp: new Date().toISOString(),
          });
        }
        result = { filePath, summary, ...editResult };
        resultsFound = editResult.replaced ? 1 : 0;
        break;
      }

      // ── Full-file write ─────────────────────────────────────────────────────
      case "write_file":
      case "write_source_file": {
        const resolved = resolveWriteFilePath(pipelineId, toolCall);
        if ("error" in resolved) {
          await auditRepo.log(pipelineId, "CODING_TOOL_CALL_FAILED", {
            tool: toolCall.name,
            error: resolved.error,
          });
          return {
            toolUseId: toolCall.toolUseId,
            content: formatToolResult(toolCall.name, { error: resolved.error }),
            isError: true,
            meta: { query: toolCall.name, resultsFound: 0 },
          };
        }
        const filePath = resolved.filePath;
        const content = stringValue(toolCall.input.content);
        const summary = stringValue(toolCall.input.summary);
        const action = workspaceFileExists(workspace?.workspaceDir ?? "", filePath)
          ? "modify"
          : "create";
        metaQuery = filePath;

        if (workspace) {
          workspaceWriteFile(workspace.workspaceDir, filePath, content);
          markCodingFileWritten(pipelineId, filePath);
          emitEngineeringCodingEvent({
            type: "file_staged",
            pipelineId,
            filePath,
            action,
            summary,
            contentLength: content.length,
            timestamp: new Date().toISOString(),
          });
          result = {
            filePath,
            action,
            summary,
            written: true,
            inferredPath: resolved.inferred ?? false,
            note: resolved.inferred
              ? "File path inferred from PRD deliverable list."
              : "File written to workspace.",
          };
        } else {
          const { getCodingArtifacts } = await import("../engineering/codingArtifactStore");
          const artifacts = getCodingArtifacts(pipelineId);
          const existing = artifacts.stagedFiles.findIndex((f) => f.filePath === filePath);
          const entry = {
            filePath,
            content,
            branchName: defaultBranch(),
            action: action as "create" | "modify",
            summary,
          };
          if (existing >= 0) {
            artifacts.stagedFiles[existing] = entry;
          } else {
            artifacts.stagedFiles.push(entry);
          }
          markCodingFileWritten(pipelineId, filePath);
          emitEngineeringCodingEvent({
            type: "file_staged",
            pipelineId,
            filePath,
            action: action as "create" | "modify",
            summary,
            contentLength: content.length,
            timestamp: new Date().toISOString(),
          });
          result = {
            filePath,
            action,
            summary,
            staged: true,
            inferredPath: resolved.inferred ?? false,
            note: resolved.inferred
              ? "Source file staged in memory (path inferred from PRD)."
              : "Source file staged in memory (no workspace).",
          };
        }
        resultsFound = 1;
        break;
      }

      // ── Delete ──────────────────────────────────────────────────────────────
      case "delete_file": {
        const resolved = requireFilePath(toolCall);
        if ("error" in resolved) {
          result = { error: resolved.error };
          break;
        }
        const filePath = resolved.filePath;
        const reason = stringValue(toolCall.input.reason);
        metaQuery = filePath;

        if (!workspace) {
          result = { error: "No workspace available — delete_file requires a local workspace." };
          break;
        }
        workspaceDeleteFile(workspace.workspaceDir, filePath);
        emitEngineeringCodingEvent({
          type: "file_staged",
          pipelineId,
          filePath,
          action: "delete",
          summary: `Deleted: ${reason}`,
          contentLength: 0,
          timestamp: new Date().toISOString(),
        });
        result = { filePath, deleted: true, reason };
        resultsFound = 1;
        break;
      }

      // ── Commands ────────────────────────────────────────────────────────────
      case "run_command": {
        const command = stringValue(toolCall.input.command);
        const subdir = stringValue(toolCall.input.working_dir) || undefined;
        metaQuery = command;

        if (!workspace) {
          result = { error: "No workspace available — run_command requires a local workspace." };
          break;
        }
        const cmdResult = await workspaceRunCommand(workspace.workspaceDir, command, subdir);
        result = {
          command,
          workingDir: subdir ?? "(root)",
          exitCode: cmdResult.exitCode,
          stdout: cmdResult.stdout,
          stderr: cmdResult.stderr,
          success: cmdResult.exitCode === 0,
        };
        resultsFound = cmdResult.exitCode === 0 ? 1 : 0;

        await auditRepo.log(pipelineId, "CODING_COMMAND_RUN", {
          command,
          exitCode: cmdResult.exitCode,
          subdir,
        });
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
      filePath:
        toolCall.name === "write_file" ||
        toolCall.name === "write_source_file" ||
        toolCall.name === "edit_file" ||
        toolCall.name === "read_file" ||
        toolCall.name === "read_source_file"
          ? resolveToolFilePath(toolCall.input as Record<string, unknown>) || undefined
          : undefined,
    });

    const hasFilePath =
      toolCall.name === "write_file" ||
      toolCall.name === "write_source_file" ||
      toolCall.name === "edit_file" ||
      toolCall.name === "read_file" ||
      toolCall.name === "read_source_file" ||
      toolCall.name === "delete_file";
    emitEngineeringCodingEvent({
      type: "tool_completed",
      pipelineId,
      tool: toolCall.name,
      durationMs,
      displayLabel,
      filePath: hasFilePath
        ? resolveToolFilePath(toolCall.input as Record<string, unknown>) || undefined
        : undefined,
      timestamp: new Date().toISOString(),
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
