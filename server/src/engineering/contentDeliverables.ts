import { existsSync, readFileSync } from "node:fs";
import { normalizeRepoPath } from "../integrations/git/normalizePushFiles";
import { logger } from "../utils/logger";
import type { WorkspaceChangedFile } from "./engineeringWorkspace";
import {
  workspaceDeleteFile,
  workspaceFileExists,
  workspaceWriteFile,
} from "./engineeringWorkspace";

export interface ContentDeliverableInput {
  deliverableFiles: Array<{ path: string }>;
  targetFilePaths: string[];
  implementationTargetFiles?: string[];
}

/** PRD deliverable paths are authoritative for content tickets. */
export function resolveContentDeliverablePaths(
  input: ContentDeliverableInput
): string[] {
  const prdPaths = [
    ...new Set([
      ...input.deliverableFiles.map((f) => normalizeRepoPath(f.path)),
      ...input.targetFilePaths.map(normalizeRepoPath),
    ]),
  ].filter(Boolean);

  if (prdPaths.length > 0) return prdPaths;

  return [
    ...new Set((input.implementationTargetFiles ?? []).map(normalizeRepoPath)),
  ].filter(Boolean);
}

function readWorkspaceFile(workspaceDir: string, filePath: string): string | null {
  try {
    const normalized = normalizeRepoPath(filePath);
    const abs = `${workspaceDir.replace(/\\/g, "/")}/${normalized}`.replace(/\/+/g, "/");
    if (!existsSync(abs)) return null;
    return readFileSync(abs, "utf8");
  } catch {
    return null;
  }
}

/**
 * Last-resort fix: model wrote one file at the wrong path but content exists.
 * Copies content to the required PRD path (single-deliverable tickets only).
 */
export function reconcileContentDeliverables(
  workspaceDir: string,
  requiredPaths: string[],
  changedFiles: WorkspaceChangedFile[]
): boolean {
  const required = requiredPaths.map(normalizeRepoPath).filter(Boolean);
  if (required.length !== 1) return false;

  const target = required[0]!;
  if (workspaceFileExists(workspaceDir, target)) return true;

  const changed = changedFiles
    .filter((f) => f.status !== "deleted")
    .map((f) => normalizeRepoPath(f.path));

  const spurious = [...new Set(changed.filter((p) => p !== target))];
  if (spurious.length !== 1) return false;

  const wrongPath = spurious[0]!;
  const content = readWorkspaceFile(workspaceDir, wrongPath);
  if (content == null) return false;

  workspaceWriteFile(workspaceDir, target, content);

  const wrongEntry = changedFiles.find((f) => normalizeRepoPath(f.path) === wrongPath);
  if (wrongEntry?.status === "added") {
    workspaceDeleteFile(workspaceDir, wrongPath);
  }

  logger.info(
    { wrongPath, targetPath: target },
    "reconciled content deliverable from wrong path to PRD path"
  );
  return workspaceFileExists(workspaceDir, target);
}

export function isContentDeliverableSatisfied(
  requiredPath: string,
  changedPaths: Set<string>,
  writtenPaths: string[],
  _workspaceDir: string
): boolean {
  const norm = normalizeRepoPath(requiredPath);
  if (changedPaths.has(norm)) return true;
  if (writtenPaths.some((p) => normalizeRepoPath(p) === norm)) return true;
  return false;
}

export function findMissingContentDeliverables(
  requiredPaths: string[],
  changedPaths: Set<string>,
  writtenPaths: string[],
  workspaceDir: string
): string[] {
  return requiredPaths.filter(
    (p) => !isContentDeliverableSatisfied(p, changedPaths, writtenPaths, workspaceDir)
  );
}
