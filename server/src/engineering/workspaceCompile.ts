import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { workspaceRunCommand } from "./engineeringWorkspace";

/** Monorepo-aware: prefer server/, then app/, then workspace root. */
export function resolveCompileCwd(workspaceDir: string): string | null {
  const root = resolve(workspaceDir);
  const candidates = [join(root, "server"), join(root, "app"), root];
  for (const cwd of candidates) {
    if (existsSync(join(cwd, "package.json"))) return cwd;
  }
  return null;
}

/** Subdir argument for workspaceRunCommand (undefined = workspace root). */
export function resolveCompileSubdir(workspaceDir: string): string | undefined {
  const cwd = resolveCompileCwd(workspaceDir);
  if (!cwd) return undefined;
  const rel = relative(resolve(workspaceDir), cwd);
  if (!rel || rel === ".") return undefined;
  return rel.split("\\").join("/");
}

export function pickCompileCommand(
  cwd: string,
  priority: "safety" | "full" = "safety"
): string | null {
  const scriptOrder =
    priority === "full"
      ? ["build", "typecheck", "check", "lint"]
      : ["typecheck", "check", "lint", "build"];

  if (existsSync(join(cwd, "package.json"))) {
    try {
      const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")) as {
        scripts?: Record<string, string>;
      };
      for (const script of scriptOrder) {
        if (pkg.scripts?.[script]) return `npm run ${script}`;
      }
    } catch {
      /* fall through to tsc */
    }
  }

  if (existsSync(join(cwd, "tsconfig.json"))) {
    return "npx tsc --noEmit";
  }

  return null;
}

export interface WorkspaceSafetyCompileResult {
  skipped: boolean;
  reason?: string;
  command?: string;
  subdir?: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runWorkspaceSafetyCompile(
  workspaceDir: string
): Promise<WorkspaceSafetyCompileResult> {
  const cwd = resolveCompileCwd(workspaceDir);
  if (!cwd) {
    return {
      skipped: true,
      reason: "no package.json in workspace",
      exitCode: 0,
      stdout: "",
      stderr: "",
    };
  }

  const command = pickCompileCommand(cwd, "safety");
  if (!command) {
    return {
      skipped: true,
      reason: "no compile script or tsconfig",
      exitCode: 0,
      stdout: "",
      stderr: "",
    };
  }

  const subdir = resolveCompileSubdir(workspaceDir);
  const result = await workspaceRunCommand(workspaceDir, command, subdir);
  return {
    skipped: false,
    command,
    subdir,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

/** Run compile with execSync (used by legacy in-memory sandbox path). */
export function runCompileInDir(
  cwd: string,
  priority: "safety" | "full" = "full"
): { ok: boolean; output: string; command: string | null } {
  const command = pickCompileCommand(cwd, priority);
  if (!command) {
    return { ok: true, output: "No compile script found — skipped", command: null };
  }

  try {
    const output = execSync(command, {
      cwd,
      encoding: "utf8",
      timeout: 120_000,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CI: "true" },
    });
    return { ok: true, output: output.slice(0, 4000), command };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err && "stderr" in err
          ? String((err as { stderr?: Buffer }).stderr ?? err)
          : String(err);
    return { ok: false, output: message.slice(0, 4000), command };
  }
}
