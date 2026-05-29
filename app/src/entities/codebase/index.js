import { DATA_MODE } from "../../shared/config/app";
import { fetchJson } from "../../shared/lib/fetchJson";
import { apiPath } from "../../shared/config/apiBase";
import { useResource } from "../../shared/lib/useResource";
import { mockApi } from "../../app/api/mock";

const restCodebaseAdapter = {
  structure: () => fetchJson(apiPath("/api/codebase/structure")),
  branches: () => fetchJson(apiPath("/api/codebase/branches")),
  commits: () => fetchJson(apiPath("/api/codebase/commits")),
  search: (query) =>
    fetchJson(apiPath(`/api/codebase/search?q=${encodeURIComponent(query)}`)),
  visualization: (branch = "main") =>
    fetchJson(apiPath(`/api/codebase/visualization?branch=${encodeURIComponent(branch)}`)),
  fileInterior: (branch, filePath) =>
    fetchJson(
      apiPath(
        `/api/codebase/visualization/file?branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(filePath)}`
      )
    ),
  ask: (question, branch = "main") =>
    fetchJson(apiPath("/api/codebase/ask"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, branchName: branch }),
    }),
};

const mockCodebaseAdapter = {
  structure: () => mockApi.codebaseStructure(),
  branches: () => mockApi.codebaseBranches(),
  commits: () => mockApi.codebaseCommits(),
  search: (query) => mockApi.codebaseSearch(query),
  visualization: (branch) => mockApi.codebaseVisualization(branch),
  fileInterior: (branch, filePath) => mockApi.codebaseFileInterior(branch, filePath),
  ask: (question, branch) => mockApi.codebaseAsk(question, branch),
};

export const codebaseAdapter =
  DATA_MODE === "rest" ? restCodebaseAdapter : mockCodebaseAdapter;

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
  return useResource(
    () =>
      query?.trim()
        ? codebaseAdapter.search(query)
        : Promise.resolve({ results: [] }),
    [query],
    { pollMs: options.pollMs }
  );
}

export function useCodebaseVisualization(options = {}) {
  const branch = options.branch ?? "main";
  return useResource(() => codebaseAdapter.visualization(branch), [branch], {
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
