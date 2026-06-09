import { apiPath } from "../../shared/config/apiBase";
import { DATA_MODE } from "../../shared/config/app";
import { fetchJson } from "../../shared/lib/fetchJson";
import { useResource } from "../../shared/lib/useResource";
import { mockApi } from "../../app/api/mock";

const sync = (path) => apiPath("/api", `/jira-sync${path}`);

const restAdapter = {
  getStatus: () => fetchJson(sync("/status")),
  listIssues: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.q) qs.set("q", params.q);
    if (params.project) qs.set("project", params.project);
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    const query = qs.toString();
    return fetchJson(sync(`/issues${query ? `?${query}` : ""}`));
  },
  getIssue: (jiraKey) =>
    fetchJson(sync(`/issues/${encodeURIComponent(jiraKey)}`)),
  runSync: (body = {}) =>
    fetchJson(sync("/run"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
};

const mockAdapter = {
  getStatus: () => mockApi.getJiraSyncStatus(),
  listIssues: (params) => mockApi.listJiraSyncIssues(params),
  getIssue: (jiraKey) => mockApi.getJiraSyncIssue(jiraKey),
  runSync: (body) => mockApi.runJiraSync(body),
};

const adapter = DATA_MODE === "rest" ? restAdapter : mockAdapter;

export function getJiraSyncStatus() {
  return adapter.getStatus();
}

export function listJiraSyncIssues(params) {
  return adapter.listIssues(params);
}

export function getJiraSyncIssue(jiraKey) {
  return adapter.getIssue(jiraKey);
}

export function runJiraSync(body) {
  return adapter.runSync(body);
}

export function useJiraSyncStatus(options = {}) {
  return useResource(() => getJiraSyncStatus(), [], {
    pollMs: options.pollMs ?? 8000,
  });
}

export function useJiraSyncIssues(params, options = {}) {
  const key = JSON.stringify(params ?? {});
  return useResource(() => listJiraSyncIssues(params), [key], {
    pollMs: options.pollMs ?? 12000,
  });
}
