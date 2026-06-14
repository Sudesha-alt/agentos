import {
  PipelineDetailSchema,
  PipelineListResponseSchema,
  RunPipelineResponseSchema,
} from "../../contracts";
import { apiPath } from "../../shared/config/apiBase";
import { DATA_MODE } from "../../shared/config/app";
import { fetchJson } from "../../shared/lib/fetchJson";
import { useResource } from "../../shared/lib/useResource";
import { mockApi } from "../../app/api/mock";

const pipelines = (path) => apiPath("/api", path);

const restPipelineAdapter = {
  async list(status) {
    const path = pipelines(
      `/pipelines${status ? `?status=${encodeURIComponent(status)}` : ""}`
    );
    return PipelineListResponseSchema.parse(await fetchJson(path));
  },
  async detail(id) {
    return PipelineDetailSchema.parse(
      await fetchJson(pipelines(`/pipelines/${id}`))
    );
  },
  async listArtifacts(id) {
    return fetchJson(pipelines(`/pipelines/${id}/artifacts`));
  },
  async run(ticketId) {
    return RunPipelineResponseSchema.parse(
      await fetchJson(pipelines(`/pipelines/${ticketId}/run`), {
        method: "POST",
      })
    );
  },
};

const mockPipelineAdapter = {
  async list(status) {
    return PipelineListResponseSchema.parse(await mockApi.listPipelines(status));
  },
  async detail(id) {
    return PipelineDetailSchema.parse(await mockApi.getPipeline(id));
  },
  async listArtifacts(id) {
    return mockApi.getPipelineArtifacts?.(id) ?? { pipelineId: id, artifacts: [] };
  },
  async run(ticketId) {
    return RunPipelineResponseSchema.parse(await mockApi.runPipeline(ticketId));
  },
};

export const pipelineAdapter =
  DATA_MODE === "rest" ? restPipelineAdapter : mockPipelineAdapter;

export function mapPipelineSummary(dto) {
  return {
    id: dto.id,
    ticketId: dto.ticketId,
    jiraKey: dto.ticket?.jiraKey ?? dto.id,
    summary: dto.ticket?.normalizedData?.summary ?? "Untitled ticket",
    currentStage: dto.currentStage,
    status: dto.status,
    startedAt: dto.startedAt,
    completedAt: dto.completedAt ?? null,
    ticket: dto.ticket,
    raw: dto,
  };
}

export function mapStageViewModel(stage) {
  return {
    ...stage,
    isValidationStage: stage.stage.endsWith("VALIDATION"),
  };
}

export function mapPipelineDetail(dto) {
  const summaries = dto.stages.map(mapStageViewModel);
  return {
    id: dto.id,
    ticketId: dto.ticketId,
    jiraKey: dto.ticket?.jiraKey ?? dto.id,
    summary: dto.ticket?.normalizedData?.summary ?? "Untitled ticket",
    status: dto.status,
    currentStage: dto.currentStage,
    startedAt: dto.startedAt,
    completedAt: dto.completedAt ?? null,
    ticket: dto.ticket,
    stages: summaries,
    overrides: dto.overrides ?? [],
    auditLogs: dto.auditLogs ?? [],
    raw: dto,
  };
}

export function usePipelineList(status, options = {}) {
  const query = useResource(
    () => pipelineAdapter.list(status),
    [status],
    { pollMs: options.pollMs ?? 10000 }
  );

  return {
    ...query,
    items: (query.data?.items ?? []).map(mapPipelineSummary),
  };
}

export function usePipelineArtifacts(id, options = {}) {
  const query = useResource(
    () => (id ? pipelineAdapter.listArtifacts(id) : Promise.resolve(null)),
    [id],
    { pollMs: options.pollMs ?? 8000 }
  );
  return {
    ...query,
    artifacts: query.data?.artifacts ?? [],
  };
}

export function usePipelineDetail(id, options = {}) {
  const query = useResource(
    () => pipelineAdapter.detail(id),
    [id],
    { pollMs: options.pollMs ?? 6000 }
  );

  return {
    ...query,
    item: query.data ? mapPipelineDetail(query.data) : null,
  };
}
