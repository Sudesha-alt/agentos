import { DATA_MODE } from "../../shared/config/app";
import { fetchJson } from "../../shared/lib/fetchJson";
import { apiPath } from "../../shared/config/apiBase";
import { useResource } from "../../shared/lib/useResource";
import { mockApi } from "../../app/api/mock";

const restAdapter = {
  listRuns: () => fetchJson(apiPath("/api/engineering/runs")),
  getRun: (id) => fetchJson(apiPath(`/api/engineering/runs/${id}`)),
};

const mockAdapter = {
  listRuns: () => mockApi.listEngineeringRuns(),
  getRun: (id) => mockApi.getEngineeringRun(id),
};

export const engineeringAgentAdapter =
  DATA_MODE === "rest" ? restAdapter : mockAdapter;

export function useEngineeringRuns(options = {}) {
  const { data, loading, error, refresh } = useResource(
    () => engineeringAgentAdapter.listRuns(),
    [],
    { pollMs: options.pollMs ?? 15_000 }
  );
  return { items: data?.items ?? [], loading, error, refresh };
}

export function useEngineeringRun(pipelineId, options = {}) {
  const { data, loading, error, refresh } = useResource(
    () =>
      pipelineId
        ? engineeringAgentAdapter.getRun(pipelineId)
        : Promise.resolve(null),
    [pipelineId],
    { pollMs: options.pollMs ?? pipelineId ? 8_000 : 0 }
  );
  return { run: data, loading, error, refresh };
}
