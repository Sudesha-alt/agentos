import { resolveToolFilePath } from "../integrations/git/normalizePushFiles";

export interface StagedSourceFile {
  filePath: string;
  content: string;
  branchName: string;
  action: "create" | "modify";
  summary: string;
}

export interface EngineeringCodingArtifacts {
  stagedFiles: StagedSourceFile[];
  readCache: Map<string, string>;
  /** PRD deliverable paths Ananta must write (for path inference + errors). */
  requiredDeliverablePaths: string[];
  /** Paths successfully written this coding run. */
  writtenPaths: string[];
}

const store = new Map<string, EngineeringCodingArtifacts>();
const completedSnapshots = new Map<string, StagedSourceFile[]>();

function ensure(pipelineId: string): EngineeringCodingArtifacts {
  if (!store.has(pipelineId)) {
    store.set(pipelineId, {
      stagedFiles: [],
      readCache: new Map(),
      requiredDeliverablePaths: [],
      writtenPaths: [],
    });
  }
  return store.get(pipelineId)!;
}

export function setCodingDeliverablePaths(
  pipelineId: string,
  paths: string[]
): void {
  ensure(pipelineId).requiredDeliverablePaths = [...new Set(paths.filter(Boolean))];
}

export function markCodingFileWritten(pipelineId: string, filePath: string): void {
  const artifacts = ensure(pipelineId);
  if (!artifacts.writtenPaths.includes(filePath)) {
    artifacts.writtenPaths.push(filePath);
  }
}

/** Resolve write_file target: explicit tool input, else next PRD deliverable path. */
export function resolveWriteTargetPath(
  pipelineId: string,
  input: Record<string, unknown>
): { filePath: string; inferred: boolean } | null {
  const explicit = resolveToolFilePath(input);
  if (explicit) {
    return { filePath: explicit, inferred: false };
  }

  const artifacts = ensure(pipelineId);
  const remaining = artifacts.requiredDeliverablePaths.filter(
    (path) => !artifacts.writtenPaths.includes(path)
  );
  const pick = remaining[0] ?? artifacts.requiredDeliverablePaths[0];
  if (pick) {
    return { filePath: pick, inferred: true };
  }
  return null;
}

export function getCodingArtifacts(pipelineId: string): EngineeringCodingArtifacts {
  return ensure(pipelineId);
}

export function cacheReadSourceFile(
  pipelineId: string,
  filePath: string,
  content: string
): void {
  ensure(pipelineId).readCache.set(filePath, content);
}

export function getCachedReadSourceFile(
  pipelineId: string,
  filePath: string
): string | undefined {
  return ensure(pipelineId).readCache.get(filePath);
}

export function snapshotCodingArtifacts(pipelineId: string): void {
  const files = ensure(pipelineId).stagedFiles;
  if (files.length) {
    completedSnapshots.set(pipelineId, files.map((f) => ({ ...f })));
  }
}

export function getStagedFilesForRun(pipelineId: string): StagedSourceFile[] {
  const live = ensure(pipelineId).stagedFiles;
  if (live.length) return live;
  return completedSnapshots.get(pipelineId) ?? [];
}

export function clearCodingArtifacts(pipelineId: string): void {
  store.delete(pipelineId);
}
