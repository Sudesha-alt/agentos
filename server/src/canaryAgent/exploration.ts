import { runAgenticLoop } from "../agenticLoop/loop";
import { CANARY_TOOL_DEFINITIONS } from "../tools/canaryToolDefinitions";
import { executeCanaryToolCall } from "../tools/canaryToolExecutor";
import {
  clearCanaryArtifacts,
  getCanaryArtifacts,
  setCanaryHypotheses,
} from "./artifactStore";
import { MAX_CANARY_TOOL_CALLS } from "./config";
import type {
  ApplicationUnderstanding,
  CanaryExplorationOutput,
  CanaryHypothesis,
  CanaryOrientation,
} from "./types";

export async function runExploration(input: {
  runId: string;
  pipelineId?: string;
  targetUrl: string;
  jiraKey: string;
  understanding: ApplicationUnderstanding;
  hypotheses: CanaryHypothesis[];
  orientation?: CanaryOrientation;
}): Promise<CanaryExplorationOutput> {
  clearCanaryArtifacts(input.runId);
  setCanaryHypotheses(input.runId, input.hypotheses);

  const loop = await runAgenticLoop({
    systemPrompt: buildExplorationSystemPrompt(input.targetUrl),
    initialUserMessage: buildExplorationUserMessage(input),
    pipelineId: input.pipelineId ?? "",
    jiraKey: input.jiraKey,
    maxToolCalls: MAX_CANARY_TOOL_CALLS,
    tools: CANARY_TOOL_DEFINITIONS,
    executeToolCall: (toolCall, _pipelineId, _jiraKey) =>
      executeCanaryToolCall(toolCall, input.runId, input.targetUrl, input.pipelineId),
    forcedWrapUpMessage:
      "Stop calling tools. Summarize confirmed findings and hypothesis statuses in plain text.",
  });

  const artifacts = getCanaryArtifacts(input.runId);
  if (loop.finalResponse) {
    artifacts.explorationNotes.push(loop.finalResponse.slice(0, 2000));
  }

  return {
    hypotheses: artifacts.hypotheses,
    findings: artifacts.findings,
    explorationNotes: artifacts.explorationNotes,
  };
}

function buildExplorationSystemPrompt(targetUrl: string): string {
  return `
You are a Canary adversarial QA agent. Explore the running application at base URL: ${targetUrl}

Workflow:
1. Work through hypotheses by priority (critical first)
2. Use http_request, sequence_operations (parallel for race tests), compare_responses, measure_performance
3. Use generate_test_data when you need payload variants
4. When a hypothesis is confirmed, call record_finding with full reproduction steps and evidence
5. When disproved, call mark_hypothesis with status disproved
6. You may infer new hypotheses from observations and test them

Rules:
- Never mutate production user data destructively; prefer read-only checks when unsure
- Prefer /health and documented API paths from reconnaissance
- Record findings only when you have evidence (status codes, response bodies, timing)
- Do not write Jest tests — probe the live application only
  `.trim();
}

function buildExplorationUserMessage(input: {
  understanding: ApplicationUnderstanding;
  hypotheses: CanaryHypothesis[];
  orientation?: CanaryOrientation;
}): string {
  return `
APPLICATION UNDERSTANDING:
${JSON.stringify(input.understanding, null, 2)}

HYPOTHESES:
${JSON.stringify(input.hypotheses, null, 2)}

ORIENTATION (what was recently built — not test specs):
${JSON.stringify(input.orientation ?? {}, null, 2)}

Begin adversarial exploration. Confirm or disprove hypotheses using tools.
  `.trim();
}
