import { apiPath } from "../../shared/config/apiBase";
import { fetchJson } from "../../shared/lib/fetchJson";
import { useResource } from "../../shared/lib/useResource";

const root = (path) => apiPath("/pipeline-jira", path);

export async function getPipelineJiraSetup() {
  return fetchJson(root("/setup"));
}

export async function connectPipelineJira(body) {
  return fetchJson(root("/connect"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function registerPipelineJiraWebhook(body = {}) {
  return fetchJson(root("/webhook/register"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getPipelineJiraBoardColumns() {
  return fetchJson(root("/boards/columns"));
}

export async function savePipelineIntakeColumn(body) {
  return fetchJson(root("/intake-column"), {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function listPipelineIntakeTickets() {
  return fetchJson(root("/intake/tickets"));
}

export async function scanPipelineIntake() {
  return fetchJson(root("/intake/scan"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
