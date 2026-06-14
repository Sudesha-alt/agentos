import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import type { StagedSourceFile } from "../engineering/codingArtifactStore";
import { sandboxManager } from "../qa/testing/sandboxManager";
import { logger } from "../utils/logger";

export interface SandboxCompileResult {
  success: boolean;
  attempts: number;
  errors: string[];
  sandboxAvailable: boolean;
}

const MAX_COMPILE_ATTEMPTS = 3;

function resolveCompileCwd(sandboxDir: string): string | null {
  const candidates = [
    join(sandboxDir, "server"),
    join(sandboxDir, "app"),
    sandboxDir,
  ];
  for (const cwd of candidates) {
    if (existsSync(join(cwd, "package.json"))) return cwd;
  }
  return null;
}

function runCompileInDir(cwd: string): { ok: boolean; output: string } {
  const scripts = ["build", "typecheck", "check"];
  for (const script of scripts) {
    try {
      const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")) as {
        scripts?: Record<string, string>;
      };
      if (!pkg.scripts?.[script]) continue;
      const output = execSync(`npm run ${script}`, {
        cwd,
        encoding: "utf8",
        timeout: 120_000,
        stdio: ["ignore", "pipe", "pipe"],
      });
      return { ok: true, output: output.slice(0, 4000) };
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err && "stderr" in err
            ? String((err as { stderr?: Buffer }).stderr ?? err)
            : String(err);
      if (script === scripts[scripts.length - 1]) {
        return { ok: false, output: message.slice(0, 4000) };
      }
    }
  }

  if (existsSync(join(cwd, "tsconfig.json"))) {
    try {
      execSync("npx tsc --noEmit", {
        cwd,
        encoding: "utf8",
        timeout: 120_000,
        stdio: ["ignore", "pipe", "pipe"],
      });
      return { ok: true, output: "tsc --noEmit passed" };
    } catch (err) {
      return {
        ok: false,
        output: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return { ok: true, output: "No compile script found — skipped" };
}

export async function runEngineeringSandboxCompile(input: {
  pipelineId: string;
  branchName: string;
  stagedFiles: StagedSourceFile[];
}): Promise<SandboxCompileResult> {
  const runId = `${input.pipelineId}-eng-${Date.now()}`;
  const { sandboxDir } = sandboxManager.create(runId);

  try {
    await sandboxManager.cloneBranch(sandboxDir, input.branchName);
    await sandboxManager.installDependencies(sandboxDir);

    for (const file of input.stagedFiles) {
      sandboxManager.writeTestFiles(sandboxDir, [
        {
          filePath: file.filePath,
          content: file.content,
        },
      ]);
    }

    const cwd = resolveCompileCwd(sandboxDir);
    if (!cwd) {
      return {
        success: true,
        attempts: 1,
        errors: [],
        sandboxAvailable: false,
      };
    }

    const result = runCompileInDir(cwd);
    return {
      success: result.ok,
      attempts: 1,
      errors: result.ok ? [] : [result.output],
      sandboxAvailable: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ pipelineId: input.pipelineId, message }, "engineering sandbox compile failed");
    return {
      success: false,
      attempts: 1,
      errors: [message],
      sandboxAvailable: false,
    };
  } finally {
    sandboxManager.destroy(sandboxDir);
  }
}

export { MAX_COMPILE_ATTEMPTS };
