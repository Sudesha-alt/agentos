import {
  PipelineDetailSchema,
  PipelineListResponseSchema,
  ResumePipelineResponseSchema,
  RunPipelineResponseSchema,
} from "../../contracts";
import { apiPath } from "../../shared/config/apiBase";
import { DATA_MODE } from "../../shared/config/app";
import { fetchJson } from "../../shared/lib/fetchJson";
import { authHeaders } from "../../shared/lib/authHeaders";
import { useResource } from "../../shared/lib/useResource";
import { mockApi } from "../../app/api/mock";

const pipelines = (path) => apiPath("/api", path);

function headers(extra = {}) {
  return { ...authHeaders(), ...extra };
}

const restPipelineAdapter = {
  async list(status) {
    const path = pipelines(
      `/pipelines${status ? `?status=${encodeURIComponent(status)}` : ""}`
    );
    return PipelineListResponseSchema.parse(await fetchJson(path, { headers: headers() }));
  },
  async detail(id) {
    return PipelineDetailSchema.parse(
      await fetchJson(pipelines(`/pipelines/${id}`), { headers: headers() })
    );
  },
  async listArtifacts(id) {
    return fetchJson(pipelines(`/pipelines/${id}/artifacts`), { headers: headers() });
  },
  async run(ticketId) {
    return RunPipelineResponseSchema.parse(
      await fetchJson(pipelines(`/pipelines/${ticketId}/run`), {
        method: "POST",
        headers: headers(),
      })
    );
  },
  async live(options = {}) {
    const params = options.jiraKey
      ? `?jiraKey=${encodeURIComponent(options.jiraKey)}`
      : "";
    return fetchJson(pipelines(`/pipelines/live${params}`), { headers: headers() });
  },
  async resume(pipelineId) {
    return ResumePipelineResponseSchema.parse(
      await fetchJson(pipelines(`/pipelines/${encodeURIComponent(pipelineId)}/resume`), {
        method: "POST",
        headers: headers(),
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
  async live(options = {}) {
    return mockApi.getPipelineLive?.(options) ?? { active: null, queue: {} };
  },
  async resume(pipelineId) {
    return ResumePipelineResponseSchema.parse(
      (await mockApi.resumePipeline?.(pipelineId)) ?? { pipelineId, started: true }
    );
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

export function usePipelineLive(options = {}) {
  const pollMs = options.pollMs ?? 3000;
  const jiraKey = options.jiraKey?.trim().toUpperCase() || undefined;
  const query = useResource(
    () => pipelineAdapter.live({ jiraKey }),
    [jiraKey],
    {
      pollMs: options.enabled === false ? undefined : pollMs,
      skip: options.skip,
    }
  );

  return {
    ...query,
    active: query.data?.active ?? null,
    queue: query.data?.queue ?? null,
  };
}
