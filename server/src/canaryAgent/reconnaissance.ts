import { codebaseQueryService } from "../codebaseIntelligence/queryService";
import { resolveRepoScope } from "../codebaseIntelligence/repoScope";
import { retriever } from "../rag/retriever";
import { chatCompletionText } from "../llm/openaiCompletion";
import type { ApplicationUnderstanding, CanaryOrientation, CanaryScope } from "./types";

const ROUTE_PATTERNS = [
  "app.use(",
  "router.get(",
  "router.post(",
  "router.put(",
  "router.patch(",
  "router.delete(",
];

type SearchHit = {
  file_path?: string;
  path?: string;
  chunk_content?: string;
  summary?: string;
};

export async function runReconnaissance(input: {
  targetUrl: string;
  jiraKey?: string;
  scope?: CanaryScope;
  orientation?: CanaryOrientation;
}): Promise<ApplicationUnderstanding> {
  const scope = input.scope ?? "full";
  const notes: string[] = [];
  const endpoints: ApplicationUnderstanding["endpoints"] = [];
  const dataModels: string[] = [];
  const recentChanges: ApplicationUnderstanding["recentChanges"] = [];
  const knownFailurePatterns: string[] = [];
  const testCoverageGaps: string[] = [];
  const highRiskAreas: string[] = [];

  try {
    const repo = resolveRepoScope();
    const branch = repo?.defaultBranch ?? "main";

    const routeSearch = (await codebaseQueryService.searchCodebaseSemantically({
      query: "API routes express router endpoints",
      branchName: branch,
      topK: 8,
    })) as SearchHit[];

    for (const hit of routeSearch) {
      const snippet = hit.chunk_content ?? hit.summary ?? "";
      const path = hit.file_path ?? hit.path;
      if (ROUTE_PATTERNS.some((p) => snippet.includes(p))) {
        endpoints.push({
          method: inferMethod(snippet),
          path: inferPath(snippet),
          source: path,
        });
      }
    }

    const schemaSearch = (await codebaseQueryService.searchCodebaseSemantically({
      query: "prisma schema model database",
      branchName: branch,
      topK: 5,
    })) as SearchHit[];

    for (const hit of schemaSearch) {
      const path = hit.file_path ?? hit.path;
      if (path?.includes("schema.prisma")) {
        dataModels.push(path);
      }
    }

    if (input.orientation?.changedFiles?.length) {
      for (const filePath of input.orientation.changedFiles.slice(0, 12)) {
        recentChanges.push({ path: filePath });
      }
    } else if (scope === "changed_files" && input.jiraKey) {
      notes.push("changed_files scope requested but no changed file list supplied");
    }

    if (input.jiraKey) {
      const history = await retriever.retrieve(
        `failures bugs race conditions auth ${input.jiraKey}`,
        {
          contentTypes: ["canary_finding", "qa_report"],
          topK: 8,
          similarityThreshold: 0.65,
          currentJiraKey: input.jiraKey,
        }
      );
      for (const row of history) {
        knownFailurePatterns.push(row.content.slice(0, 280));
      }
    }

    const testSearch = (await codebaseQueryService.searchCodebaseSemantically({
      query: "test files unit integration e2e",
      branchName: branch,
      topK: 6,
    })) as SearchHit[];

    const testedPaths = new Set(
      testSearch.map((r) => r.file_path ?? r.path).filter(Boolean) as string[]
    );
    for (const ep of endpoints) {
      if (ep.source && !Array.from(testedPaths).some((t) => ep.source?.includes(t))) {
        testCoverageGaps.push(`${ep.method} ${ep.path} (${ep.source})`);
      }
    }
  } catch (err) {
    notes.push(
      `Codebase recon partial: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (endpoints.length === 0) {
    endpoints.push(
      { method: "GET", path: "/health", source: "default" },
      { method: "GET", path: "/healthz", source: "default" },
      { method: "GET", path: "/api/health", source: "default" }
    );
  }

  const riskQuery = [
    input.orientation?.implementationSummary,
    input.orientation?.qaSummary,
    ...knownFailurePatterns,
  ]
    .filter(Boolean)
    .join(" ");

  if (riskQuery) {
    const { text } = await chatCompletionText({
      system: "Return JSON only: { highRiskAreas: string[] }",
      user: `Identify high-risk areas from:\n${riskQuery.slice(0, 3000)}`,
      maxTokens: 500,
    });
    try {
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim()) as {
        highRiskAreas?: string[];
      };
      highRiskAreas.push(...(parsed.highRiskAreas ?? []));
    } catch {
      notes.push("Could not parse high-risk LLM output");
    }
  }

  if (!highRiskAreas.length) {
    highRiskAreas.push("auth", "payments", "data export", "webhooks");
  }

  return {
    targetUrl: input.targetUrl,
    endpointCount: endpoints.length,
    endpoints: endpoints.slice(0, 50),
    dataModelCount: dataModels.length,
    dataModels,
    recentChanges,
    knownFailurePatterns: knownFailurePatterns.slice(0, 14),
    testCoverageGaps: testCoverageGaps.slice(0, 23),
    highRiskAreas: [...new Set(highRiskAreas)].slice(0, 8),
    notes,
  };
}

function inferMethod(snippet: string): string {
  const match = snippet.match(/\.(get|post|put|patch|delete)\(/i);
  return match ? match[1].toUpperCase() : "GET";
}

function inferPath(snippet: string): string {
  const match = snippet.match(/["'`](\/[^"'`]+)["'`]/);
  return match ? match[1] : "/api/unknown";
}
