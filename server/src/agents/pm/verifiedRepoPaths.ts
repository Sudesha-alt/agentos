import type { PmPipelineContext } from "./pmPipelineContext";
import type { PmAnalysisRecord } from "./types";
import { normalizeRepoPath } from "../../integrations/git/normalizePushFiles";

function addPath(paths: Set<string>, value: unknown): void {
  if (typeof value !== "string" || !value.trim()) return;
  paths.add(normalizeRepoPath(value.trim()));
}

/** Paths grounded in codebase analysis / impact — not LLM-invented layout guesses. */
export function collectVerifiedRepoPaths(
  pmContext?: PmPipelineContext | null,
  record?: PmAnalysisRecord | null
): Set<string> {
  const paths = new Set<string>();
  const doc = pmContext?.enrichedPrdDocument ?? {};

  const impact = doc.pmCodebaseImpact as
    | { affectedFiles?: Array<{ path: string }>; suggestedFirstFile?: string }
    | undefined;
  const analysis = doc.pmCodebaseAnalysis as
    | {
        relevantModules?: Array<{ path: string }>;
        suggestedFirstFile?: string;
        gapsToBuild?: string[];
      }
    | undefined;
  const handoff = doc.pmHandoff as
    | { affectedFiles?: Array<{ path: string }>; suggestedFirstFile?: string }
    | undefined;

  for (const f of impact?.affectedFiles ?? []) addPath(paths, f.path);
  for (const m of analysis?.relevantModules ?? []) addPath(paths, m.path);
  for (const f of handoff?.affectedFiles ?? []) addPath(paths, f.path);
  addPath(paths, impact?.suggestedFirstFile);
  addPath(paths, analysis?.suggestedFirstFile);
  addPath(paths, handoff?.suggestedFirstFile);

  for (const f of record?.codebaseImpact?.affectedFiles ?? []) addPath(paths, f.path);
  for (const m of record?.codebaseAnalysis?.relevantModules ?? []) addPath(paths, m.path);
  addPath(paths, record?.codebaseAnalysis?.suggestedFirstFile);

  for (const f of pmContext?.generatedPrd?.deliverableFiles ?? []) addPath(paths, f.path);

  return paths;
}

export function filterToVerifiedPaths(paths: string[], verified: Set<string>): string[] {
  if (!verified.size) return [];
  return [...new Set(paths.map(normalizeRepoPath))].filter((p) => verified.has(p));
}

export function sanitizeTaskBreakdownFiles<T extends { files?: string[] }>(
  tasks: T[],
  verified: Set<string>
): T[] {
  return tasks.map((task) => ({
    ...task,
    files: filterToVerifiedPaths(task.files ?? [], verified),
  }));
}

export function formatVerifiedPathsBlock(verified: Set<string>): string {
  if (!verified.size) {
    return [
      "VERIFIED REPO PATHS: none from codebase analysis.",
      "Use list_dir and grep in the cloned workspace to find auth, API routes, and UI entry points.",
      "Do not assume a server/ + web/ monorepo layout — discover the actual structure first.",
    ].join("\n");
  }
  return [
    "VERIFIED REPO PATHS (from codebase analysis — prefer these; other paths may not exist):",
    ...[...verified].map((p) => `- ${p}`),
  ].join("\n");
}
