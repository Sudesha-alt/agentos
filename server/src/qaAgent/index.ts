import { runAgenticLoop } from "../agenticLoop/loop";
import { parseDiscoveryJson } from "../llm/discoveryCompletion";
import type { AgentOutput, ImplementationMode, ImplementationOutput, PrdOutput, QaOutput } from "../types/agents";
import type { RetrievedContext } from "../types/pipeline";
import { logger } from "../utils/logger";
import { executeQaToolCall } from "../tools/qaToolExecutor";
import { QA_TOOL_DEFINITIONS } from "../tools/qaToolDefinitions";
import {
  clearQaArtifacts,
  getQaArtifacts,
  setQaImplementationBranch,
} from "../qa/qaArtifactStore";
import type { QaExecutionReport } from "../qa/report/reportGenerator";
import { resolveImplementationBranchForQa } from "../qa/resolveImplementationBranch";
import { buildQaInitialUserMessage, resolveQaBranchName } from "./inputBuilder";
import { buildQaSystemPrompt } from "./systemPrompt";

const INPUT_COST_PER_TOKEN = 0.000003;
const OUTPUT_COST_PER_TOKEN = 0.000015;
const MAX_QA_TOOL_CALLS = 20;

export interface QaAgentRunInput {
  pipelineId: string;
  jiraKey: string;
  prd: PrdOutput;
  implementation: ImplementationOutput;
  retrievedContext: RetrievedContext[];
  implementationMode?: ImplementationMode;
  /** Ananta push branch — when omitted, resolved from pipeline audit log. */
  implementationBranch?: string;
}

export interface QaAgentRunResult {
  agentOutput: AgentOutput<QaOutput>;
  executionReport?: QaExecutionReport;
  toolCallLog: Array<{
    tool: string;
    query: string;
    resultsFound: number;
  }>;
}

export async function runQaAgentic(
  input: QaAgentRunInput
): Promise<QaAgentRunResult> {
  const branchName = resolveQaBranchName(
    input.implementationBranch ??
      (await resolveImplementationBranchForQa(input.pipelineId, input.jiraKey)),
    input.jiraKey
  );
  const mode = input.implementationMode ?? input.implementation.implementationMode ?? "code";
  clearQaArtifacts(input.pipelineId);
  setQaImplementationBranch(input.pipelineId, branchName);

  try {
    const loop = await runAgenticLoop({
      systemPrompt: buildQaSystemPrompt(mode),
      initialUserMessage: buildQaInitialUserMessage({
        ...input,
        branchName,
      }),
      pipelineId: input.pipelineId,
      jiraKey: input.jiraKey,
      maxToolCalls: MAX_QA_TOOL_CALLS,
      tools: QA_TOOL_DEFINITIONS,
      executeToolCall: executeQaToolCall,
      forcedWrapUpMessage: `You have used the maximum number of QA tool calls. Produce the final JSON test plan now using everything gathered. Do not call more tools.`,
    });

    const qaOutput = parseDiscoveryJson<QaOutput>(loop.finalResponse, "qaAgent");
    const artifacts = getQaArtifacts(input.pipelineId);

    logger.info(
      {
        pipelineId: input.pipelineId,
        jiraKey: input.jiraKey,
        implementationBranch: branchName,
        toolCalls: loop.toolCallCount,
        testCases: qaOutput.testCases?.length ?? 0,
        recommendation: artifacts.executionReport?.overallRecommendation,
      },
      "QA agent completed"
    );

    return {
      agentOutput: {
        raw: loop.finalResponse,
        parsed: qaOutput,
        metadata: {
          inputTokens: loop.totalInputTokens,
          outputTokens: loop.totalOutputTokens,
          costUsd:
            loop.totalInputTokens * INPUT_COST_PER_TOKEN +
            loop.totalOutputTokens * OUTPUT_COST_PER_TOKEN,
          durationMs: 0,
        },
      },
      executionReport: artifacts.executionReport
        ? {
            ...artifacts.executionReport,
            securityScan:
              artifacts.securityScan ?? artifacts.executionReport.securityScan,
          }
        : artifacts.securityScan
          ? {
              generatedAt: new Date().toISOString(),
              summary: "Security scan only",
              overallRecommendation: "request_changes" as const,
              criteriaCoverage: { total: 0, covered: 0, uncovered: [] },
              securityScan: artifacts.securityScan,
            }
          : undefined,
      toolCallLog: loop.toolCallLog,
    };
  } finally {
    clearQaArtifacts(input.pipelineId);
  }
}
