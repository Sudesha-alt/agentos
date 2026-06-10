import { DATA_MODE } from "../../shared/config/app";
import { fetchJson } from "../../shared/lib/fetchJson";
import { apiPath } from "../../shared/config/apiBase";
import { useResource } from "../../shared/lib/useResource";

const restAdapter = {
  list: (params = {}) => {
    const q = new URLSearchParams();
    if (params.jiraKey) q.set("jiraKey", params.jiraKey);
    if (params.sourceType) q.set("sourceType", params.sourceType);
    if (params.limit) q.set("limit", String(params.limit));
    const suffix = q.toString() ? `?${q}` : "";
    return fetchJson(apiPath(`/api/org-intelligence${suffix}`));
  },
};

const mockAdapter = {
  list: async () => ({ items: [] }),
};

export const orgIntelligenceAdapter = DATA_MODE === "rest" ? restAdapter : mockAdapter;

export function useOrgIntelligence(options = {}) {
  const deps = [options.jiraKey, options.sourceType, options.limit];
  return useResource(
    () => orgIntelligenceAdapter.list(options),
    deps,
    { pollMs: options.pollMs }
  );
}
