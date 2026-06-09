import type Anthropic from "@anthropic-ai/sdk";

export const CANARY_TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "http_request",
    description:
      "Make an HTTP request to the target application. Use for probing API endpoints and verifying responses.",
    input_schema: {
      type: "object" as const,
      properties: {
        method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"] },
        path: { type: "string", description: "Path relative to base URL, e.g. /api/health" },
        headers: { type: "object", additionalProperties: { type: "string" } },
        body: { type: "object", description: "JSON request body" },
        timeout_ms: { type: "number" },
      },
      required: ["method", "path"],
    },
  },
  {
    name: "sequence_operations",
    description:
      "Execute multiple HTTP requests in order, or in parallel for race-condition tests.",
    input_schema: {
      type: "object" as const,
      properties: {
        mode: { type: "string", enum: ["sequential", "parallel"] },
        requests: {
          type: "array",
          items: {
            type: "object",
            properties: {
              method: { type: "string" },
              path: { type: "string" },
              headers: { type: "object" },
              body: { type: "object" },
            },
            required: ["method", "path"],
          },
        },
        delay_ms_between: { type: "number" },
      },
      required: ["mode", "requests"],
    },
  },
  {
    name: "compare_responses",
    description: "Compare two HTTP responses for equality or expected differences (idempotency, leakage).",
    input_schema: {
      type: "object" as const,
      properties: {
        response_a: { type: "object" },
        response_b: { type: "object" },
        expect_equal: { type: "boolean" },
        fields_to_compare: { type: "array", items: { type: "string" } },
      },
      required: ["response_a", "response_b"],
    },
  },
  {
    name: "measure_performance",
    description: "Execute the same HTTP request multiple times and capture latency percentiles.",
    input_schema: {
      type: "object" as const,
      properties: {
        method: { type: "string" },
        path: { type: "string" },
        headers: { type: "object" },
        body: { type: "object" },
        iterations: { type: "number" },
      },
      required: ["method", "path"],
    },
  },
  {
    name: "generate_test_data",
    description: "Generate valid and invalid payload variants for probing a hypothesis.",
    input_schema: {
      type: "object" as const,
      properties: {
        hypothesis_id: { type: "string" },
        endpoint_path: { type: "string" },
        intent: { type: "string" },
      },
      required: ["hypothesis_id", "intent"],
    },
  },
  {
    name: "record_finding",
    description: "Record a confirmed bug finding with reproduction steps and evidence.",
    input_schema: {
      type: "object" as const,
      properties: {
        hypothesis_id: { type: "string" },
        severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
        category: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        reproduction_steps: { type: "string" },
        affected_code: { type: "string" },
        suggested_fix: { type: "string" },
        evidence: { type: "object" },
      },
      required: ["severity", "category", "title", "description"],
    },
  },
  {
    name: "mark_hypothesis",
    description: "Mark a hypothesis as confirmed, disproved, or skipped.",
    input_schema: {
      type: "object" as const,
      properties: {
        hypothesis_id: { type: "string" },
        status: { type: "string", enum: ["confirmed", "disproved", "skipped"] },
        note: { type: "string" },
      },
      required: ["hypothesis_id", "status"],
    },
  },
];
