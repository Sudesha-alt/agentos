import { apiPath } from "../../shared/config/apiBase";
import { authHeaders } from "../../shared/lib/authHeaders";
import { fetchJson } from "../../shared/lib/fetchJson";

const oauthRoot = (path = "") => apiPath("/api", `/jira/oauth${path}`);

function requestHeaders(extra = {}) {
  return { ...authHeaders(), ...extra };
}

export async function getJiraOAuthStatus() {
  return fetchJson(oauthRoot("/status"), { headers: requestHeaders() });
}

export async function startJiraOAuth() {
  const { url } = await fetchJson(oauthRoot("/start"), {
    headers: requestHeaders(),
  });
  if (!url) {
    throw new Error("Server did not return an Atlassian authorize URL");
  }
  window.location.href = url;
}

export async function disconnectJiraOAuth() {
  return fetchJson(oauthRoot("/disconnect"), {
    method: "POST",
    headers: requestHeaders(),
  });
}
