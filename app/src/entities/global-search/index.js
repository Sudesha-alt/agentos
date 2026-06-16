import { DATA_MODE } from "../../shared/config/app";
import { apiPath } from "../../shared/config/apiBase";
import { authHeaders } from "../../shared/lib/authHeaders";
import { fetchJson } from "../../shared/lib/fetchJson";
import { mockApi } from "../../app/api/mock";

const restGlobalSearchAdapter = {
  search: (query, branch = "main") => {
    const params = new URLSearchParams({ q: query, branch });
    return fetchJson(apiPath("/api", `/search?${params.toString()}`), {
      headers: authHeaders(),
    });
  },
};

const mockGlobalSearchAdapter = {
  search: (query, branch = "main") => mockApi.globalSearch(query, branch),
};

export const globalSearchAdapter =
  DATA_MODE === "rest" ? restGlobalSearchAdapter : mockGlobalSearchAdapter;

export async function globalSearch(query, branch = "main") {
  const q = query?.trim() ?? "";
  if (!q) {
    return { query: "", tickets: [], codebase: { files: [], patterns: [], results: [] }, audit: [] };
  }
  return globalSearchAdapter.search(q, branch);
}
