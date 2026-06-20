import { apiPath } from "../../shared/config/apiBase";
import { authHeaders } from "../../shared/lib/authHeaders";
import { fetchJson } from "../../shared/lib/fetchJson";
import { useResource } from "../../shared/lib/useResource";

const root = (path) => apiPath("/pipeline-jira", path);

function requestHeaders(extra = {}) {
  return { ...authHeaders(), ...extra };
}

export async function getPipelineJiraSetup() {
  return fetchJson(root("/setup"), { headers: requestHeaders() });
}

export async function connectPipelineJira(body) {
  return fetchJson(root("/connect"), {
    method: "POST",
    headers: requestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
}

export async function registerPipelineJiraWebhook(body = {}) {
  return fetchJson(root("/webhook/register"), {
    method: "POST",
    headers: requestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
}

export async function getPipelineJiraBoardColumns(boardId) {
  const query =
    boardId != null && String(boardId).trim()
      ? `?boardId=${encodeURIComponent(String(boardId).trim())}`
      : "";
  return fetchJson(root(`/boards/columns${query}`), { headers: requestHeaders() });
}

export async function getPipelineJiraProjects() {
  return fetchJson(root("/projects"), { headers: requestHeaders() });
}

export async function getPipelineJiraBoards(projectKey) {
  const query = projectKey?.trim()
    ? `?projectKey=${encodeURIComponent(projectKey.trim())}`
    : "";
  return fetchJson(root(`/boards${query}`), { headers: requestHeaders() });
}

export async function savePipelineIntakeColumn(body) {
  return fetchJson(root("/intake-column"), {
    method: "PUT",
    headers: requestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
}

export async function listPipelineIntakeTickets() {
  return fetchJson(root("/intake/tickets"), { headers: requestHeaders() });
}

export async function scanPipelineIntake() {
  return fetchJson(root("/intake/scan"), {
    method: "POST",
    headers: requestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({}),
  });
}

export function usePipelineJiraSetup(options = {}) {
  return useResource(() => getPipelineJiraSetup(), [], {
    pollMs: options.pollMs ?? 30000,
  });
}

export function usePipelineIntakeTickets(enabled, options = {}) {
  return useResource(
    () => (enabled ? listPipelineIntakeTickets() : Promise.resolve({ items: [] })),
    [enabled],
    { pollMs: enabled ? (options.pollMs ?? 10000) : undefined }
  );
}
