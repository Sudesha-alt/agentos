import { apiPath } from "../../shared/config/apiBase";
import { DATA_MODE } from "../../shared/config/app";
import { authHeaders } from "../../shared/lib/authHeaders";
import { fetchJson } from "../../shared/lib/fetchJson";
import { useResource } from "../../shared/lib/useResource";
import { mockApi } from "../../app/api/mock";

const sync = (path) => apiPath("/api", `/jira-sync${path}`);

function requestHeaders(extra = {}) {
  return { ...authHeaders(), ...extra };
}

const restAdapter = {
  getStatus: () => fetchJson(sync("/status"), { headers: requestHeaders() }),
  listIssues: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.q) qs.set("q", params.q);
    if (params.project) qs.set("project", params.project);
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    const query = qs.toString();
    return fetchJson(sync(`/issues${query ? `?${query}` : ""}`), {
      headers: requestHeaders(),
    });
  },
  getIssue: (jiraKey) =>
    fetchJson(sync(`/issues/${encodeURIComponent(jiraKey)}`), {
      headers: requestHeaders(),
    }),
  runSync: (body = {}) =>
    fetchJson(sync("/run"), {
      method: "POST",
      headers: requestHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    }),
  embedIssue: (jiraKey) =>
    fetchJson(sync(`/issues/${encodeURIComponent(jiraKey)}/embed`), {
      method: "POST",
      headers: requestHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({}),
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

export function embedJiraIssue(jiraKey) {
  if (DATA_MODE !== "rest") {
    return Promise.resolve({ jiraKey, embedded: true });
  }
  return restAdapter.embedIssue(jiraKey);
}

export function useJiraSyncStatus(options = {}) {
  return useResource(() => getJiraSyncStatus(), [], {
    pollMs: options.pollMs ?? 8000,
    skip: options.skip,
  });
}

export function useJiraSyncIssues(params, options = {}) {
  const key = JSON.stringify(params ?? {});
  return useResource(() => listJiraSyncIssues(params), [key], {
    pollMs: options.pollMs ?? 12000,
    skip: options.skip,
  });
}
