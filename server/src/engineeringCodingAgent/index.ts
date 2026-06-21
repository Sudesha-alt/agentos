import { runAgenticLoop } from "../agenticLoop/loop";
import type { PmPipelineContext } from "../agents/pm/pmPipelineContext";
import {
  clearCodingArtifacts,
  getCodingArtifacts,
} from "../engineering/codingArtifactStore";
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
const MAX_CODING_TOOL_CALLS = 16;
const MAX_CONTENT_CODING_TOOL_CALLS = 12;

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
  const branchName = resolveCodingBranchName();
  const mode = input.implementationMode ?? input.implementation.implementationMode ?? "code";
  clearCodingArtifacts(input.pipelineId);

  try {
    const loop = await runAgenticLoop({
      systemPrompt: buildEngineeringCodingSystemPrompt(mode),
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
      forcedWrapUpMessage: `You have used the maximum number of coding tool calls. Produce the final JSON summary now using all staged changes. Do not call more tools.`,
    });

    const parsed = parseDiscoveryJson<CodingAgentJsonOutput>(
      loop.finalResponse,
      "engineeringCodingAgent"
    );
    const artifacts = getCodingArtifacts(input.pipelineId);

    const codeChanges =
      parsed.codeChanges?.length > 0
        ? parsed.codeChanges
        : artifacts.stagedFiles.map((file) => ({
            filePath: file.filePath,
            action: file.action,
            summary: file.summary,
            linesChanged: file.content.split("\n").length,
          }));

    logger.info(
      {
        pipelineId: input.pipelineId,
        jiraKey: input.jiraKey,
        toolCalls: loop.toolCallCount,
        filesStaged: codeChanges.length,
      },
      "engineering coding agent completed"
    );

    return {
      raw: loop.finalResponse,
      codingSummary:
        parsed.codingSummary ??
        `Staged ${codeChanges.length} file(s) for ${input.jiraKey}.`,
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
