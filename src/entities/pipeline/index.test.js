import { describe, expect, it } from "vitest";
import {
  PipelineDetailSchema,
  PipelineListResponseSchema,
} from "../../contracts";
import {
  mapPipelineDetail,
  mapPipelineSummary,
  pipelineAdapter,
} from "./index";

describe("pipeline contracts and mappers", () => {
  it("maps pipeline summaries into UI-friendly fields", () => {
    const dto = PipelineListResponseSchema.parse({
      items: [
        {
          id: "pl_123",
          ticketId: "tk_123",
          currentStage: "QA_VALIDATION",
          status: "RUNNING",
          startedAt: "2026-05-13T10:00:00.000Z",
          completedAt: null,
          ticket: {
            id: "tk_123",
            jiraKey: "PLT-77",
            normalizedData: { summary: "Ship audit export" },
          },
        },
      ],
    }).items[0];

    const mapped = mapPipelineSummary(dto);

    expect(mapped.jiraKey).toBe("PLT-77");
    expect(mapped.summary).toBe("Ship audit export");
    expect(mapped.currentStage).toBe("QA_VALIDATION");
  });

  it("maps stage metadata for validation-aware rendering", () => {
    const dto = PipelineDetailSchema.parse({
      id: "pl_123",
      ticketId: "tk_123",
      currentStage: "PRD_VALIDATION",
      status: "PAUSED",
      startedAt: "2026-05-13T10:00:00.000Z",
      completedAt: null,
      ticket: {
        id: "tk_123",
        jiraKey: "PLT-77",
        normalizedData: { summary: "Ship audit export" },
      },
      stages: [
        {
          id: "stg_1",
          stage: "PRD_VALIDATION",
          status: "AWAITING_HUMAN",
          input: {},
          output: null,
          validationResult: {
            passed: false,
            score: 0.62,
            issues: [],
            amberFlags: ["Needs human review"],
            checkedAt: "2026-05-13T10:01:00.000Z",
          },
          confidenceScore: 0.62,
          tokenCount: 1234,
          costUsd: 0.12,
          startedAt: "2026-05-13T10:00:10.000Z",
          completedAt: "2026-05-13T10:01:00.000Z",
          error: null,
        },
      ],
      overrides: [],
      auditLogs: [],
    });

    const mapped = mapPipelineDetail(dto);

    expect(mapped.stages[0].isValidationStage).toBe(true);
    expect(mapped.summary).toBe("Ship audit export");
  });

  it("validates adapter output against shared contracts", async () => {
    const result = await pipelineAdapter.list();
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
  });
});
