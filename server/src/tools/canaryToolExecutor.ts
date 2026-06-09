import { formatToolResult } from "../agenticLoop/toolResultFormatter";
import { auditRepo } from "../db/repositories/auditRepo";
import { chatCompletionText } from "../llm/openaiCompletion";
import {
  getCanaryArtifacts,
} from "../canaryAgent/artifactStore";
import { resolveCanaryAuthHeader } from "../canaryAgent/config";
import type { CanaryFindingDraft } from "../canaryAgent/types";
import { logger } from "../utils/logger";
import type { ToolCallInput, ToolCallResult } from "./executor";

interface HttpResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  durationMs: number;
  url: string;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function executeHttp(
  baseUrl: string,
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: unknown,
  timeoutMs = 15000
): Promise<HttpResult> {
  const url = new URL(path.startsWith("/") ? path : `/${path}`, baseUrl).toString();
  const auth = resolveCanaryAuthHeader();
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: method.toUpperCase(),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...auth,
        ...headers,
      },
      body:
        body && method.toUpperCase() !== "GET" && method.toUpperCase() !== "HEAD"
          ? JSON.stringify(body)
          : undefined,
      signal: controller.signal,
    });

    const durationMs = Date.now() - start;
    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text.slice(0, 4000);
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: parsed,
      durationMs,
      url,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function executeCanaryToolCall(
  toolCall: ToolCallInput,
  runId: string,
  baseUrl: string,
  pipelineId?: string
): Promise<ToolCallResult> {
  const startTime = Date.now();
  logger.info({ tool: toolCall.name, runId }, "canary tool call executing");

  try {
    const artifacts = getCanaryArtifacts(runId);
    let result: unknown = {};
    let resultsFound = 0;
    const metaQuery = toolCall.name;

    switch (toolCall.name) {
      case "http_request": {
        const method = String(toolCall.input.method ?? "GET");
        const path = String(toolCall.input.path ?? "/");
        const headers = (toolCall.input.headers ?? {}) as Record<string, string>;
        const body = toolCall.input.body;
        const timeoutMs =
          typeof toolCall.input.timeout_ms === "number" ? toolCall.input.timeout_ms : 15000;
        result = await executeHttp(baseUrl, method, path, headers, body, timeoutMs);
        resultsFound = 1;
        break;
      }

      case "sequence_operations": {
        const mode = String(toolCall.input.mode ?? "sequential");
        const requests = (toolCall.input.requests ?? []) as Array<Record<string, unknown>>;
        const delayMs =
          typeof toolCall.input.delay_ms_between === "number"
            ? toolCall.input.delay_ms_between
            : 0;

        const runOne = (req: Record<string, unknown>) =>
          executeHttp(
            baseUrl,
            String(req.method ?? "GET"),
            String(req.path ?? "/"),
            (req.headers ?? {}) as Record<string, string>,
            req.body
          );

        if (mode === "parallel") {
          const responses = await Promise.all(requests.map(runOne));
          result = { mode, responses };
          resultsFound = responses.length;
        } else {
          const responses: HttpResult[] = [];
          for (const req of requests) {
            responses.push(await runOne(req));
            if (delayMs > 0) {
              await new Promise((r) => setTimeout(r, delayMs));
            }
          }
          result = { mode, responses };
          resultsFound = responses.length;
        }
        break;
      }

      case "compare_responses": {
        const a = toolCall.input.response_a as Record<string, unknown>;
        const b = toolCall.input.response_b as Record<string, unknown>;
        const expectEqual = toolCall.input.expect_equal !== false;
        const fields = Array.isArray(toolCall.input.fields_to_compare)
          ? (toolCall.input.fields_to_compare as string[])
          : ["status", "body"];

        const diffs: string[] = [];
        for (const field of fields) {
          const av = a?.[field];
          const bv = b?.[field];
          const equal = JSON.stringify(av) === JSON.stringify(bv);
          if (equal !== expectEqual) {
            diffs.push(field);
          }
        }
        result = {
          equal: diffs.length === 0,
          differingFields: diffs,
          expectEqual,
        };
        resultsFound = diffs.length;
        break;
      }

      case "measure_performance": {
        const method = String(toolCall.input.method ?? "GET");
        const path = String(toolCall.input.path ?? "/");
        const headers = (toolCall.input.headers ?? {}) as Record<string, string>;
        const body = toolCall.input.body;
        const iterations = Math.min(
          typeof toolCall.input.iterations === "number" ? toolCall.input.iterations : 5,
          20
        );
        const durations: number[] = [];
        const statuses: number[] = [];
        for (let i = 0; i < iterations; i += 1) {
          const res = await executeHttp(baseUrl, method, path, headers, body);
          durations.push(res.durationMs);
          statuses.push(res.status);
        }
        result = {
          iterations,
          p50: percentile(durations, 50),
          p95: percentile(durations, 95),
          p99: percentile(durations, 99),
          statuses,
          durations,
        };
        resultsFound = iterations;
        break;
      }

      case "generate_test_data": {
        const intent = String(toolCall.input.intent ?? "");
        const endpoint = String(toolCall.input.endpoint_path ?? "/");
        const { text } = await chatCompletionText({
          system:
            "Generate JSON test payloads only. Return valid JSON with valid_variants and invalid_variants arrays.",
          user: `Endpoint: ${endpoint}\nIntent: ${intent}\nReturn compact JSON.`,
          maxTokens: 1200,
        });
        try {
          result = JSON.parse(text.replace(/```json|```/g, "").trim());
        } catch {
          result = { raw: text };
        }
        resultsFound = 1;
        break;
      }

      case "record_finding": {
        const finding: CanaryFindingDraft = {
          hypothesisId: toolCall.input.hypothesis_id
            ? String(toolCall.input.hypothesis_id)
            : undefined,
          severity: String(toolCall.input.severity ?? "medium") as CanaryFindingDraft["severity"],
          category: String(toolCall.input.category ?? "unknown"),
          title: String(toolCall.input.title ?? "Untitled finding"),
          description: String(toolCall.input.description ?? ""),
          reproductionSteps: toolCall.input.reproduction_steps
            ? String(toolCall.input.reproduction_steps)
            : undefined,
          affectedCode: toolCall.input.affected_code
            ? String(toolCall.input.affected_code)
            : undefined,
          suggestedFix: toolCall.input.suggested_fix
            ? String(toolCall.input.suggested_fix)
            : undefined,
          evidence: (toolCall.input.evidence ?? {}) as Record<string, unknown>,
        };
        artifacts.findings.push(finding);
        if (finding.hypothesisId) {
          const h = artifacts.hypotheses.find((x) => x.id === finding.hypothesisId);
          if (h) h.status = "confirmed";
        }
        result = { recorded: true, findingId: artifacts.findings.length };
        resultsFound = 1;
        break;
      }

      case "mark_hypothesis": {
        const id = String(toolCall.input.hypothesis_id ?? "");
        const status = String(toolCall.input.status ?? "skipped") as
          | "confirmed"
          | "disproved"
          | "skipped";
        const h = artifacts.hypotheses.find((x) => x.id === id);
        if (h) {
          h.status = status;
          if (toolCall.input.note) {
            artifacts.explorationNotes.push(`${id}: ${String(toolCall.input.note)}`);
          }
        }
        result = { updated: Boolean(h), hypothesisId: id, status };
        resultsFound = h ? 1 : 0;
        break;
      }

      default:
        throw new Error(`Unknown canary tool: ${toolCall.name}`);
    }

    await auditRepo.log(pipelineId, "CANARY_TOOL_CALL_COMPLETED", {
      runId,
      tool: toolCall.name,
      durationMs: Date.now() - startTime,
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
    logger.error({ tool: toolCall.name, runId, message }, "canary tool call failed");
    await auditRepo.log(pipelineId, "CANARY_TOOL_CALL_FAILED", {
      runId,
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
