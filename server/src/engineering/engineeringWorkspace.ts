import { exec } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { gitClient } from "../integrations/gitProvider";
import { normalizeRepoPath } from "../integrations/git/normalizePushFiles";
import { SANDBOX_BASE, sandboxManager } from "../qa/testing/sandboxManager";
import { logger } from "../utils/logger";

const execAsync = promisify(exec);

export interface WorkspaceHandle {
  pipelineId: string;
  workspaceDir: string;
  /** The per-ticket work branch (e.g. agentos/AG-61) */
  branchName: string;
  /** The source/default branch the workspace was cloned from (e.g. main) */
  sourceBranch: string;
}

// Per-process registry — keyed by pipelineId
const activeWorkspaces = new Map<string, WorkspaceHandle>();

/** Sanitize a Jira key into a valid branch name segment */
export function sanitizeBranchSegment(jiraKey: string): string {
  return jiraKey.toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

/** Shared branch for legacy Git Data API pushes (no local workspace). */
export const LEGACY_API_PUSH_BRANCH = "work/agentos";

/** Derive the per-ticket engineering branch name */
export function resolveEngineeringBranchName(jiraKey: string): string {
  const env = process.env.ENGINEERING_TARGET_BRANCH;
  if (env) return env; // allow env override (single-branch mode)
  return `agentos/${sanitizeBranchSegment(jiraKey)}`;
}

/** Branch Ananta pushes to when using the Git Data API fallback path. */
export function resolveFallbackApiPushBranch(): string {
  return process.env.ENGINEERING_TARGET_BRANCH?.trim() || LEGACY_API_PUSH_BRANCH;
}

export type EngineeringWorkspaceOptions = {
  /** When true, skip npm install after clone (content/docs tickets). */
  skipDependencyInstall?: boolean;
};

/** Skip npm install for doc-only work or when Render memory is constrained. */
export function shouldSkipEngineeringDependencyInstall(input?: {
  implementationMode?: "content" | "code";
  skipDependencyInstall?: boolean;
}): boolean {
  if (input?.skipDependencyInstall) return true;
  const env = process.env.ENGINEERING_SKIP_NPM_INSTALL?.trim().toLowerCase();
  if (env === "1" || env === "true" || env === "yes") return true;
  return input?.implementationMode === "content";
}

async function configureGitUser(workspaceDir: string): Promise<void> {
  await execAsync('git config user.email "agentos@agentos.ai"', { cwd: workspaceDir, timeout: 10_000 });
  await execAsync('git config user.name "AgentOS"', { cwd: workspaceDir, timeout: 10_000 });
}

/** Strip PATs and embedded credentials from git shell errors before surfacing to users/logs. */
export function sanitizeGitShellError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message
    .replace(/https:\/\/x-access-token:[^@\s]+@/gi, "https://x-access-token:***@")
    .replace(/https:\/\/[^@\s]+:[^@\s]+@github\.com/gi, "https://***:***@github.com")
    .replace(/github_pat_[A-Za-z0-9_]+/g, "github_pat_***")
    .replace(/gh[pousr]_[A-Za-z0-9_]+/g, "gh***");
}

/** Remove leftover workspace dir from a prior failed run or process restart. */
export function resetEngWorkspaceDir(pipelineId: string, workspaceDir: string): void {
  destroyEngWorkspace(pipelineId);
  if (existsSync(workspaceDir)) {
    rmSync(workspaceDir, { recursive: true, force: true });
    logger.info({ pipelineId, workspaceDir }, "cleared stale engineering workspace directory");
  }
}

/**
 * Create a persistent workspace for an engineering run.
 * Clones the source branch, creates the per-ticket work branch, and installs deps.
 */
export async function createEngWorkspace(
  pipelineId: string,
  jiraKey: string,
  sourceBranch: string,
  options: EngineeringWorkspaceOptions = {}
): Promise<WorkspaceHandle> {
  const runId = `${pipelineId}-eng`;
  const workspaceDir = join(SANDBOX_BASE, runId);

  resetEngWorkspaceDir(pipelineId, workspaceDir);
  mkdirSync(workspaceDir, { recursive: true });

  // Clone source branch (shallow)
  const repoUrl = await gitClient.cloneUrl();
  try {
    await execAsync(
      `git clone --depth 1 --branch ${sourceBranch} ${repoUrl} .`,
      { cwd: workspaceDir, timeout: 120_000 }
    );
  } catch (err) {
    rmSync(workspaceDir, { recursive: true, force: true });
    throw new Error(sanitizeGitShellError(err));
  }

  await configureGitUser(workspaceDir);

  // Set up the per-ticket work branch
  const targetBranch = resolveEngineeringBranchName(jiraKey);
  try {
    // Try to fetch existing remote branch and resume from it
    await execAsync(
      `git fetch origin ${targetBranch} --depth 1`,
      { cwd: workspaceDir, timeout: 30_000 }
    );
    await execAsync(
      `git checkout -b ${targetBranch} FETCH_HEAD`,
      { cwd: workspaceDir, timeout: 10_000 }
    );
    logger.info({ pipelineId, targetBranch }, "resuming existing engineering branch");
  } catch {
    // Branch doesn't exist remotely — create fresh from source HEAD
    await execAsync(
      `git checkout -b ${targetBranch}`,
      { cwd: workspaceDir, timeout: 10_000 }
    );
    logger.info({ pipelineId, targetBranch }, "created new engineering branch");
  }

  if (options.skipDependencyInstall) {
    logger.info(
      { pipelineId, workspaceDir },
      "skipping npm install in engineering workspace (content mode or ENGINEERING_SKIP_NPM_INSTALL)"
    );
  } else {
    // Needed for in-workspace typecheck; skip on content tickets or low-memory hosts (Render 512MB).
    await sandboxManager.installDependencies(workspaceDir);
  }

  const handle: WorkspaceHandle = {
    pipelineId,
    workspaceDir,
    branchName: targetBranch,
    sourceBranch,
  };
  activeWorkspaces.set(pipelineId, handle);

  logger.info(
    { pipelineId, workspaceDir, branchName: targetBranch, sourceBranch },
    "engineering workspace ready"
  );
  return handle;
}

export function getEngWorkspace(pipelineId: string): WorkspaceHandle | undefined {
  return activeWorkspaces.get(pipelineId);
}

/** Register an on-disk repo directory for local/demo coding runs (no clone). */
export function registerEngWorkspaceLocal(
  pipelineId: string,
  jiraKey: string,
  workspaceDir: string,
  sourceBranch = "main"
): WorkspaceHandle {
  const handle: WorkspaceHandle = {
    pipelineId,
    workspaceDir,
    branchName: resolveEngineeringBranchName(jiraKey),
    sourceBranch,
  };
  activeWorkspaces.set(pipelineId, handle);
  return handle;
}

export function destroyEngWorkspace(pipelineId: string): void {
  const handle = activeWorkspaces.get(pipelineId);
  if (!handle) return;
  activeWorkspaces.delete(pipelineId);
  if (existsSync(handle.workspaceDir)) {
    rmSync(handle.workspaceDir, { recursive: true, force: true });
    logger.debug(
      { pipelineId, workspaceDir: handle.workspaceDir },
      "engineering workspace destroyed"
    );
  }
}

// ─── File operations ─────────────────────────────────────────────────────────

const GREP_SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".next", "coverage"]);

/** Cross-platform check that resolvedTarget stays inside workspace root. */
function assertInsideWorkspaceRoot(root: string, target: string, label: string): void {
  const rel = relative(root, target);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Path traversal denied: ${label}`);
  }
}

function guardPath(workspaceDir: string, filePath: string): string {
  const root = resolve(workspaceDir);
  const normalized = normalizeRepoPath(filePath);
  const abs = resolve(root, ...normalized.split("/"));
  assertInsideWorkspaceRoot(root, abs, filePath);
  return abs;
}

function toWorkspaceRelativePath(workspaceDir: string, absPath: string): string {
  return relative(resolve(workspaceDir), absPath).split(sep).join("/");
}

function matchesFileGlob(filePath: string, fileGlob?: string): boolean {
  if (!fileGlob) return true;
  const normalized = filePath.replace(/\\/g, "/");
  if (fileGlob.startsWith("*.")) {
    return normalized.endsWith(fileGlob.slice(1));
  }
  const escaped = fileGlob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(normalized);
}

function collectWorkspaceFiles(workspaceDir: string, dirPath: string, out: string[]): void {
  const absDir = guardPath(workspaceDir, dirPath || ".");
  if (!existsSync(absDir)) return;

  for (const name of readdirSync(absDir)) {
    if (GREP_SKIP_DIRS.has(name)) continue;
    const abs = join(absDir, name);
    const rel = toWorkspaceRelativePath(workspaceDir, abs);
    if (statSync(abs).isDirectory()) {
      collectWorkspaceFiles(workspaceDir, rel, out);
    } else {
      out.push(rel);
    }
  }
}

export function workspaceReadFile(workspaceDir: string, filePath: string): string {
  const abs = guardPath(workspaceDir, filePath);
  return readFileSync(abs, "utf8");
}

export function workspaceWriteFile(
  workspaceDir: string,
  filePath: string,
  content: string
): void {
  const abs = guardPath(workspaceDir, filePath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, "utf8");
}

export function workspaceDeleteFile(workspaceDir: string, filePath: string): void {
  const abs = guardPath(workspaceDir, filePath);
  if (existsSync(abs)) rmSync(abs);
}

export function workspaceListDir(workspaceDir: string, dirPath: string): string[] {
  const abs = guardPath(workspaceDir, dirPath || ".");
  if (!existsSync(abs)) return [];
  return readdirSync(abs).map((name) => {
    const full = join(abs, name);
    return statSync(full).isDirectory() ? name + "/" : name;
  });
}

/**
 * Apply a string find-and-replace edit to an existing file.
 * Returns how many occurrences were replaced.
 */
export function workspaceApplyEdit(
  workspaceDir: string,
  filePath: string,
  oldString: string,
  newString: string
): { replaced: boolean; occurrences: number } {
  const abs = guardPath(workspaceDir, filePath);
  if (!existsSync(abs)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const original = readFileSync(abs, "utf8");
  const usesCrLf = original.includes("\r\n");
  const normOriginal = original.replace(/\r\n/g, "\n");
  const normOld = oldString.replace(/\r\n/g, "\n");
  const normNew = newString.replace(/\r\n/g, "\n");
  const occurrences = normOriginal.split(normOld).length - 1;
  if (occurrences === 0) return { replaced: false, occurrences: 0 };
  let updated = normOriginal.split(normOld).join(normNew);
  if (usesCrLf) {
    updated = updated.replace(/\n/g, "\r\n");
  }
  writeFileSync(abs, updated, "utf8");
  return { replaced: true, occurrences };
}

export function workspaceFileExists(workspaceDir: string, filePath: string): boolean {
  try {
    const abs = guardPath(workspaceDir, filePath);
    return existsSync(abs);
  } catch {
    return false;
  }
}

// ─── Git operations ───────────────────────────────────────────────────────────

export async function workspaceGitStatus(workspaceDir: string): Promise<string> {
  const { stdout } = await execAsync("git status --short", {
    cwd: workspaceDir,
    timeout: 15_000,
  });
  return stdout.trim();
}

export async function workspaceGitDiff(workspaceDir: string, filePath?: string): Promise<string> {
  const cmd = filePath ? `git diff HEAD -- ${filePath}` : "git diff HEAD";
  const { stdout } = await execAsync(cmd, { cwd: workspaceDir, timeout: 15_000 });
  return stdout.slice(0, 20_000);
}

export interface WorkspaceChangedFile {
  path: string;
  status: "modified" | "added" | "deleted" | "renamed";
}

export async function workspaceGetChangedFiles(
  workspaceDir: string
): Promise<WorkspaceChangedFile[]> {
  const { stdout } = await execAsync("git status --short --porcelain", {
    cwd: workspaceDir,
    timeout: 15_000,
  });
  if (!stdout.trim()) return [];

  return stdout
    .trim()
    .split("\n")
    .map((line) => {
      const code = line.slice(0, 2).trim();
      let rawPath = line.slice(3).trim();
      if (rawPath.includes(" -> ")) {
        rawPath = rawPath.split(" -> ").pop()?.trim() ?? rawPath;
      }
      rawPath = rawPath.replace(/^"|"$/g, "");
      const path = normalizeRepoPath(rawPath);
      let status: WorkspaceChangedFile["status"] = "modified";
      if (code === "A" || code === "??") status = "added";
      else if (code === "D") status = "deleted";
      else if (code === "R") status = "renamed";
      return { path, status };
    });
}

/**
 * Stage all changes, create a commit, push the per-ticket branch, and return
 * the new commit SHA. Returns null if there are no changes to commit.
 */
export async function workspaceCommitAndPush(
  workspaceDir: string,
  commitMessage: string
): Promise<{ sha: string; pushedBranch: string } | null> {
  const status = await workspaceGitStatus(workspaceDir);
  if (!status) {
    logger.info({ workspaceDir }, "nothing to commit — workspace is clean");
    return null;
  }

  // Stage everything
  await execAsync("git add -A", { cwd: workspaceDir, timeout: 30_000 });

  // Commit
  await execAsync(`git commit -m ${JSON.stringify(commitMessage)}`, {
    cwd: workspaceDir,
    timeout: 30_000,
  });

  // Get the current branch and commit SHA
  const [{ stdout: shaOut }, { stdout: branchOut }] = await Promise.all([
    execAsync("git rev-parse HEAD", { cwd: workspaceDir, timeout: 10_000 }),
    execAsync("git rev-parse --abbrev-ref HEAD", { cwd: workspaceDir, timeout: 10_000 }),
  ]);

  const pushedBranch = branchOut.trim();
  const sha = shaOut.trim();

  // Push (--set-upstream handles new branches)
  await execAsync(`git push --set-upstream origin ${pushedBranch}`, {
    cwd: workspaceDir,
    timeout: 60_000,
  });

  logger.info({ workspaceDir, pushedBranch, sha }, "workspace committed and pushed");
  return { sha, pushedBranch };
}

/** Run an allowlisted command inside the workspace. */
export const ALLOWED_COMMAND_PREFIXES = [
  "npm run ",
  "npm test",
  "npx tsc",
  "npx eslint",
  "npx prettier",
  "node ",
  "tsc ",
  "eslint ",
  "prettier ",
  "git status",
  "git diff",
  "git log --oneline",
];

export function isCommandAllowed(command: string): boolean {
  const trimmed = command.trim();
  return ALLOWED_COMMAND_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

export async function workspaceRunCommand(
  workspaceDir: string,
  command: string,
  subdir?: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  if (!isCommandAllowed(command)) {
    throw new Error(
      `Command not allowed: "${command}". Allowed prefixes: ${ALLOWED_COMMAND_PREFIXES.join(", ")}`
    );
  }
  const root = resolve(workspaceDir);
  const cwd = subdir ? resolve(root, subdir) : root;
  assertInsideWorkspaceRoot(root, cwd, subdir ?? ".");

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: 120_000,
      env: { ...process.env, CI: "true" },
    });
    return {
      stdout: stdout.slice(0, 8_000),
      stderr: stderr.slice(0, 4_000),
      exitCode: 0,
    };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: (e.stdout ?? "").slice(0, 8_000),
      stderr: (e.stderr ?? (err instanceof Error ? err.message : String(err))).slice(0, 4_000),
      exitCode: e.code ?? 1,
    };
  }
}

/** Fast literal grep over the workspace directory (portable — no shell grep). */
export async function workspaceGrep(
  workspaceDir: string,
  pattern: string,
  fileGlob?: string
): Promise<Array<{ file: string; line: number; text: string }>> {
  const files: string[] = [];
  collectWorkspaceFiles(workspaceDir, ".", files);

  const matches: Array<{ file: string; line: number; text: string }> = [];
  for (const file of files) {
    if (!matchesFileGlob(file, fileGlob)) continue;
    let content: string;
    try {
      content = workspaceReadFile(workspaceDir, file);
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    let fileMatches = 0;
    for (let i = 0; i < lines.length; i += 1) {
      if (!lines[i].includes(pattern)) continue;
      matches.push({ file, line: i + 1, text: lines[i] });
      fileMatches += 1;
      if (fileMatches >= 5 || matches.length >= 50) break;
    }
    if (matches.length >= 50) break;
  }
  return matches;
}
