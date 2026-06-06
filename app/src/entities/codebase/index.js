import { DATA_MODE } from "../../shared/config/app";
import { fetchJson } from "../../shared/lib/fetchJson";
import { apiPath } from "../../shared/config/apiBase";
import { useResource } from "../../shared/lib/useResource";
import { mockApi } from "../../app/api/mock";

const restCodebaseAdapter = {
  status: (branch) => {
    const qs = branch ? `?branch=${encodeURIComponent(branch)}` : "";
    return fetchJson(apiPath("/api", `/codebase/status${qs}`));
  },
  insights: (branch = "main") =>
    fetchJson(apiPath("/api", `/codebase/insights?branch=${encodeURIComponent(branch)}`)),
  triggerFullIndex: (branch) =>
    fetchJson(apiPath("/git-integration", "/index/full"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(branch ? { branch } : {}),
    }),
  structure: () => fetchJson(apiPath("/api", "/codebase/structure")),
  branches: () => fetchJson(apiPath("/api", "/codebase/branches")),
  commits: () => fetchJson(apiPath("/api", "/codebase/commits")),
  search: (query, branch = "main") =>
    fetchJson(apiPath("/api/codebase/search"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, branchName: branch }),
    }),
  visualization: (branch = "main", refresh = false) => {
    const qs = new URLSearchParams({ branch });
    if (refresh) qs.set("refresh", "true");
    return fetchJson(apiPath("/api", `/codebase/visualization?${qs.toString()}`));
  },
  fileInterior: (branch, filePath) =>
    fetchJson(
      apiPath(
        "/api",
        `/codebase/visualization/file?branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(filePath)}`
      )
    ),
  ask: (question, branch = "main") =>
    fetchJson(apiPath("/api/codebase/ask"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, branchName: branch }),
    }),
  directory: (dirPath = "", branch = "main") => {
    const qs = new URLSearchParams({ branch });
    if (dirPath) qs.set("path", dirPath);
    return fetchJson(apiPath("/api", `/codebase/directory?${qs.toString()}`));
  },
  file: (filePath, branch = "main", includeContent = false) => {
    const qs = new URLSearchParams({ branch, path: filePath });
    if (includeContent) qs.set("includeContent", "true");
    return fetchJson(apiPath("/api", `/codebase/file?${qs.toString()}`));
  },
  fileConnections: (filePath, branch = "main") =>
    fetchJson(
      apiPath(
        "/api",
        `/codebase/file/connections?branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(filePath)}`
      )
    ),
  tour: (branch = "main") =>
    fetchJson(apiPath("/api", `/codebase/tour?branch=${encodeURIComponent(branch)}`)),
  generateTour: (branch = "main") =>
    fetchJson(apiPath("/api/codebase/tour/generate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchName: branch }),
    }),
  health: (branch = "main") =>
    fetchJson(apiPath("/api", `/codebase/health?branch=${encodeURIComponent(branch)}`)),
  healthTimeline: (branch = "main", days = 30) =>
    fetchJson(
      apiPath(
        "/api",
        `/codebase/health/timeline?branch=${encodeURIComponent(branch)}&days=${days}`
      )
    ),
  impact: (payload) =>
    fetchJson(apiPath("/api/codebase/impact"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  knowledge: (branch = "main") =>
    fetchJson(apiPath("/api", `/codebase/knowledge?branch=${encodeURIComponent(branch)}`)),
  generateKnowledge: (branch = "main") =>
    fetchJson(apiPath("/api/codebase/knowledge/generate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchName: branch }),
    }),
};

const mockCodebaseAdapter = {
  status: () => mockApi.codebaseLayerStatus(),
  insights: (branch) => mockApi.codebaseInsights(branch),
  triggerFullIndex: (branch) => mockApi.triggerFullCodebaseIndex(branch),
  structure: () => mockApi.codebaseStructure(),
  branches: () => mockApi.codebaseBranches(),
  commits: () => mockApi.codebaseCommits(),
  search: (query, branch) => mockApi.codebaseSearch(query, branch),
  visualization: (branch, refresh) => mockApi.codebaseVisualization(branch, refresh),
  fileInterior: (branch, filePath) => mockApi.codebaseFileInterior(branch, filePath),
  ask: (question, branch) => mockApi.codebaseAsk(question, branch),
  directory: (dirPath, branch) => mockApi.codebaseDirectory(dirPath, branch),
  file: (filePath) => mockApi.codebaseFileIntelligence(filePath),
  fileConnections: (filePath, branch) => mockApi.codebaseFileConnections(filePath, branch),
  tour: (branch) => mockApi.codebaseTour(branch),
  generateTour: (branch) => mockApi.generateCodebaseTour(branch),
  health: (branch) => mockApi.codebaseHealth(branch),
  healthTimeline: (branch, days) => mockApi.codebaseHealthTimeline(branch, days),
  impact: (payload) => mockApi.codebaseImpact(payload),
  knowledge: (branch) => mockApi.codebaseKnowledge(branch),
  generateKnowledge: (branch) => mockApi.generateCodebaseKnowledge(branch),
};

export const codebaseAdapter =
  DATA_MODE === "rest" ? restCodebaseAdapter : mockCodebaseAdapter;

export function fetchCodebaseLayerStatus(branch) {
  return codebaseAdapter.status(branch);
}

export function triggerFullCodebaseIndex(branch) {
  return codebaseAdapter.triggerFullIndex(branch);
}

export function useCodebaseLayerStatus(options = {}) {
  const branch = options.branch;
  return useResource(() => fetchCodebaseLayerStatus(branch), [branch], {
    pollMs: options.pollMs ?? 12000,
  });
}

export function fetchCodebaseInsights(branch) {
  return codebaseAdapter.insights(branch);
}

export function useCodebaseInsights(options = {}) {
  const branch = options.branch ?? "main";
  return useResource(() => fetchCodebaseInsights(branch), [branch], {
    pollMs: options.pollMs ?? 60_000,
  });
}

export function useCodebaseStructure(options = {}) {
  return useResource(() => codebaseAdapter.structure(), [], { pollMs: options.pollMs });
}

export function useCodebaseBranches(options = {}) {
  return useResource(() => codebaseAdapter.branches(), [], { pollMs: options.pollMs });
}

export function useCodebaseCommits(options = {}) {
  return useResource(() => codebaseAdapter.commits(), [], { pollMs: options.pollMs });
}

export function useCodebaseSearch(query, options = {}) {
  const branch = options.branch ?? "main";
  return useResource(
    () =>
      query?.trim()
        ? codebaseAdapter.search(query, branch)
        : Promise.resolve({ query: "", files: [], patterns: [], results: [] }),
    [query, branch],
    { pollMs: options.pollMs }
  );
}

export function useCodebaseVisualization(options = {}) {
  const branch = options.branch ?? "main";
  const refresh = Boolean(options.refresh);
  return useResource(() => codebaseAdapter.visualization(branch, refresh), [branch, refresh], {
    pollMs: options.pollMs ?? 120_000,
  });
}

export function useCodebaseFileInterior(filePath, branch = "main") {
  return useResource(
    () =>
      filePath
        ? codebaseAdapter.fileInterior(branch, filePath)
        : Promise.resolve({ blocks: [] }),
    [filePath, branch],
    { pollMs: 0 }
  );
}

export async function askCodebase(question, branch = "main") {
  return codebaseAdapter.ask(question, branch);
}

export function fetchCodebaseDirectory(dirPath, branch = "main") {
  return codebaseAdapter.directory(dirPath, branch);
}

export function useCodebaseDirectory(dirPath = "", branch = "main") {
  return useResource(
    () => fetchCodebaseDirectory(dirPath, branch),
    [dirPath, branch],
    { pollMs: 0 }
  );
}

export function fetchCodebaseFile(filePath, branch = "main", includeContent = false) {
  if (!filePath) return Promise.resolve({ file: null });
  return codebaseAdapter.file(filePath, branch, includeContent);
}

export function useCodebaseFile(filePath, branch = "main", options = {}) {
  const includeContent = Boolean(options.includeContent);
  return useResource(
    () => fetchCodebaseFile(filePath, branch, includeContent),
    [filePath, branch, includeContent],
    { pollMs: 0 }
  );
}

export function fetchCodebaseFileConnections(filePath, branch = "main") {
  if (!filePath) return Promise.resolve({ outgoing: [], incoming: [] });
  return codebaseAdapter.fileConnections(filePath, branch);
}

export function useCodebaseFileConnections(filePath, branch = "main") {
  return useResource(
    () => fetchCodebaseFileConnections(filePath, branch),
    [filePath, branch],
    { pollMs: 0 }
  );
}

export function fetchCodebaseTour(branch = "main") {
  return codebaseAdapter.tour(branch);
}

export async function generateCodebaseTour(branch = "main") {
  return codebaseAdapter.generateTour(branch);
}

export function useCodebaseTour(options = {}) {
  const branch = options.branch ?? "main";
  return useResource(() => fetchCodebaseTour(branch), [branch], {
    pollMs: options.pollMs ?? 120_000,
  });
}

export function fetchCodebaseHealth(branch = "main") {
  return codebaseAdapter.health(branch);
}

export function useCodebaseHealth(options = {}) {
  const branch = options.branch ?? "main";
  return useResource(() => fetchCodebaseHealth(branch), [branch], {
    pollMs: options.pollMs ?? 60_000,
  });
}

export function fetchCodebaseHealthTimeline(branch = "main", days = 30) {
  return codebaseAdapter.healthTimeline(branch, days);
}

export function useCodebaseHealthTimeline(options = {}) {
  const branch = options.branch ?? "main";
  const days = options.days ?? 30;
  return useResource(() => fetchCodebaseHealthTimeline(branch, days), [branch, days], {
    pollMs: options.pollMs ?? 120_000,
  });
}

export async function analyzeCodebaseImpact(payload) {
  return codebaseAdapter.impact(payload);
}

export function fetchCodebaseKnowledge(branch = "main") {
  return codebaseAdapter.knowledge(branch);
}

export function useCodebaseKnowledge(options = {}) {
  const branch = options.branch ?? "main";
  return useResource(() => fetchCodebaseKnowledge(branch), [branch], {
    pollMs: options.pollMs ?? 120_000,
  });
}

export async function generateCodebaseKnowledge(branch = "main") {
  return codebaseAdapter.generateKnowledge(branch);
}
