import { normalizeRepoPath, resolveToolFilePath } from "../integrations/git/normalizePushFiles";

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
  ensure(pipelineId).requiredDeliverablePaths = [
    ...new Set(paths.filter(Boolean).map(normalizeRepoPath)),
  ];
}

export function markCodingFileWritten(pipelineId: string, filePath: string): void {
  const artifacts = ensure(pipelineId);
  const normalized = normalizeRepoPath(filePath);
  if (!artifacts.writtenPaths.includes(normalized)) {
    artifacts.writtenPaths.push(normalized);
  }
}

function matchRequiredDeliverablePath(
  explicit: string,
  required: string[]
): string | null {
  if (required.includes(explicit)) return explicit;

  const suffixMatch = required.find(
    (path) =>
      path === explicit ||
      path.endsWith(`/${explicit}`) ||
      explicit.endsWith(`/${path}`)
  );
  if (suffixMatch) return suffixMatch;

  const explicitBase = explicit.split("/").pop() ?? explicit;
  const baseMatches = required.filter(
    (path) => (path.split("/").pop() ?? path) === explicitBase
  );
  if (baseMatches.length === 1) return baseMatches[0]!;

  const explicitDir = explicit.includes("/")
    ? explicit.slice(0, explicit.lastIndexOf("/"))
    : "";
  if (explicitDir) {
    const dirMatches = required.filter((path) => path.startsWith(`${explicitDir}/`));
    if (dirMatches.length === 1) return dirMatches[0]!;
  }

  return null;
}

/** Resolve write_file target: PRD deliverable paths win over wrong LLM paths. */
export function resolveWriteTargetPath(
  pipelineId: string,
  input: Record<string, unknown>
): { filePath: string; inferred: boolean; redirected?: boolean } | null {
  const artifacts = ensure(pipelineId);
  const required = artifacts.requiredDeliverablePaths.map(normalizeRepoPath);
  const explicit = resolveToolFilePath(input);

  // Single deliverable: always write to the exact PRD path (models often typo the path).
  if (required.length === 1) {
    const target = required[0]!;
    const redirected = Boolean(explicit && explicit !== target);
    return {
      filePath: target,
      inferred: !explicit,
      redirected,
    };
  }

  if (explicit) {
    const match = matchRequiredDeliverablePath(explicit, required);
    if (match) {
      return {
        filePath: match,
        inferred: false,
        redirected: match !== explicit,
      };
    }
    const written = new Set(artifacts.writtenPaths.map(normalizeRepoPath));
    const remaining = required.filter((path) => !written.has(path));
    if (remaining.length === 1) {
      return {
        filePath: remaining[0]!,
        inferred: false,
        redirected: true,
      };
    }
    return { filePath: explicit, inferred: false };
  }

  const written = new Set(artifacts.writtenPaths.map(normalizeRepoPath));
  const remaining = required.filter((path) => !written.has(path));
  const pick = remaining[0] ?? required[0];
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
