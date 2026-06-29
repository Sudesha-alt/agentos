import { runAgenticLoop } from "../agenticLoop/loop";
import type { PmPipelineContext } from "../agents/pm/pmPipelineContext";
import type { CodebaseKnowledge } from "../codebaseIntelligence/knowledgeService";
import {
  resolveContentDeliverablePaths,
} from "../engineering/contentDeliverables";
import {
  clearCodingArtifacts,
  getCodingArtifacts,
  markCodingFileWritten,
  setCodingDeliverablePaths,
} from "../engineering/codingArtifactStore";
import {
  getEngWorkspace,
  workspaceGetChangedFiles,
} from "../engineering/engineeringWorkspace";
import { parseDiscoveryJson } from "../llm/discoveryCompletion";
import { executeEngineeringCodingToolCall } from "../tools/engineeringCodingToolExecutor";
import { ENGINEERING_CODING_TOOL_DEFINITIONS } from "../tools/engineeringCodingToolDefinitions";
import type {
  AgentMetadata,
  CodeChange,
  ImplementationMode,
  ImplementationOutput,
  PrdOutput,
} from "../types/agents";
import { logger } from "../utils/logger";
import {
  buildEngineeringCodingInitialUserMessage,
  resolveCodingBranchName,
} from "./inputBuilder";
import { buildEngineeringCodingSystemPrompt } from "./systemPrompt";

const INPUT_COST_PER_TOKEN = 0.000003;
const OUTPUT_COST_PER_TOKEN = 0.000015;

// Increased budgets: Phase 2 enables in-loop edit→run→fix cycles
const MAX_CODING_TOOL_CALLS = 30;
const MAX_CONTENT_CODING_TOOL_CALLS = 16;

export interface EngineeringCodingAgentRunInput {
  pipelineId: string;
  jiraKey: string;
  prd: PrdOutput;
  implementation: ImplementationOutput;
  enrichedPrdDocument: Record<string, unknown>;
  pmContext?: PmPipelineContext;
  compileFeedback?: string;
  retainArtifacts?: boolean;
  implementationMode?: ImplementationMode;
  deliverableFiles?: Array<{ path: string; format: string; purpose: string }>;
  /** Authoritative deliverable paths from orchestrator (merged with PRD/targetFiles). */
  requiredDeliverablePaths?: string[];
  /** Injected from CodebaseKnowledgeCache for repo conventions */
  repoKnowledge?: CodebaseKnowledge | null;
}

interface CodingAgentJsonOutput {
  codingSummary: string;
  codeChanges: CodeChange[];
  confidenceScore?: number;
  confidenceReason?: string;
}

export interface EngineeringCodingAgentRunResult {
  raw: string;
  codingSummary: string;
  codeChanges: CodeChange[];
  metadata: AgentMetadata;
  toolCallLog: Array<{
    tool: string;
    query: string;
    resultsFound: number;
  }>;
}

export async function runEngineeringCodingAgentic(
  input: EngineeringCodingAgentRunInput
): Promise<EngineeringCodingAgentRunResult> {
  const mode = input.implementationMode ?? input.implementation.implementationMode ?? "code";

  // Use per-ticket workspace branch when available, otherwise default source branch
  const workspace = getEngWorkspace(input.pipelineId);
  const branchName = workspace?.branchName ?? resolveCodingBranchName();

  clearCodingArtifacts(input.pipelineId);

  const requiredPaths =
    mode === "content"
      ? resolveContentDeliverablePaths({
          deliverableFiles: input.deliverableFiles ?? [],
          targetFilePaths: (input.deliverableFiles ?? []).map((f) => f.path),
          implementationTargetFiles: input.implementation.targetFiles,
        })
      : [
          ...new Set([
            ...(input.requiredDeliverablePaths ?? []),
            ...(input.deliverableFiles?.map((f) => f.path) ?? []),
            ...(input.implementation.targetFiles ?? []),
          ]),
        ].filter(Boolean);
  if (requiredPaths.length > 0) {
    setCodingDeliverablePaths(input.pipelineId, requiredPaths);
  }

  try {
    const loop = await runAgenticLoop({
      systemPrompt: buildEngineeringCodingSystemPrompt(mode, input.repoKnowledge),
      initialUserMessage: buildEngineeringCodingInitialUserMessage({
        ...input,
        branchName,
        compileFeedback: input.compileFeedback,
        implementationMode: mode,
        deliverableFiles: input.deliverableFiles,
      }),
      pipelineId: input.pipelineId,
      jiraKey: input.jiraKey,
      maxToolCalls: mode === "content" ? MAX_CONTENT_CODING_TOOL_CALLS : MAX_CODING_TOOL_CALLS,
      tools: ENGINEERING_CODING_TOOL_DEFINITIONS,
      executeToolCall: executeEngineeringCodingToolCall,
      forcedWrapUpMessage: `You have used the maximum number of coding tool calls. Produce the final JSON summary now using all changes made so far. Do not call more tools.`,
    });

    const parsed = parseDiscoveryJson<CodingAgentJsonOutput>(
      loop.finalResponse,
      "engineeringCodingAgent"
    );

    // Derive code changes: prefer agent's self-report, then workspace git diff, then legacy in-memory store
    let codeChanges: CodeChange[] = parsed.codeChanges ?? [];

    if (codeChanges.length === 0 && workspace) {
      // Derive from workspace git diff
      const changedFiles = await workspaceGetChangedFiles(workspace.workspaceDir);
      codeChanges = changedFiles.map((f) => ({
        filePath: f.path,
        action: f.status === "added" ? "create" : f.status === "deleted" ? "delete" : "modify",
        summary: `${f.status} by engineering agent`,
        linesChanged: 0,
      }));
    }

    if (codeChanges.length === 0) {
      // Legacy fallback: in-memory artifact store
      const artifacts = getCodingArtifacts(input.pipelineId);
      codeChanges = artifacts.stagedFiles.map((file) => ({
        filePath: file.filePath,
        action: file.action,
        summary: file.summary,
        linesChanged: file.content.split("\n").length,
      }));
    }

    logger.info(
      {
        pipelineId: input.pipelineId,
        jiraKey: input.jiraKey,
        toolCalls: loop.toolCallCount,
        filesChanged: codeChanges.length,
        hasWorkspace: Boolean(workspace),
      },
      "engineering coding agent completed"
    );

    return {
      raw: loop.finalResponse,
      codingSummary:
        parsed.codingSummary ??
        `Changed ${codeChanges.length} file(s) for ${input.jiraKey}.`,
      codeChanges,
      metadata: {
        inputTokens: loop.totalInputTokens,
        outputTokens: loop.totalOutputTokens,
        costUsd:
          loop.totalInputTokens * INPUT_COST_PER_TOKEN +
          loop.totalOutputTokens * OUTPUT_COST_PER_TOKEN,
        durationMs: 0,
      },
      toolCallLog: loop.toolCallLog,
    };
  } finally {
    if (!input.retainArtifacts) {
      clearCodingArtifacts(input.pipelineId);
    }
  }
}
