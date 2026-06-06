import { exec } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { gitClient } from "../../integrations/gitProvider";
import { logger } from "../../utils/logger";

const execAsync = promisify(exec);

export const SANDBOX_BASE =
  process.env.SANDBOX_DIR ?? join(tmpdir(), "agentos-qa-sandbox");

export interface SandboxHandle {
  runId: string;
  sandboxDir: string;
}

export const sandboxManager = {
  create(runId: string): SandboxHandle {
    const sandboxDir = join(SANDBOX_BASE, runId);
    mkdirSync(sandboxDir, { recursive: true });
    return { runId, sandboxDir };
  },

  async cloneBranch(sandboxDir: string, branchName: string): Promise<void> {
    const repoUrl = await gitClient.cloneUrl();
    await execAsync(
      `git clone --depth 1 --branch ${branchName} ${repoUrl} .`,
      { cwd: sandboxDir, timeout: 120_000 }
    );
  },

  async installDependencies(sandboxDir: string): Promise<void> {
    if (existsSync(join(sandboxDir, "package.json"))) {
      await execAsync("npm install --silent", {
        cwd: sandboxDir,
        timeout: 180_000,
      });
    }
    if (existsSync(join(sandboxDir, "app", "package.json"))) {
      await execAsync("npm install --silent", {
        cwd: join(sandboxDir, "app"),
        timeout: 180_000,
      });
    }
    if (existsSync(join(sandboxDir, "server", "package.json"))) {
      await execAsync("npm install --silent", {
        cwd: join(sandboxDir, "server"),
        timeout: 180_000,
      });
    }
  },

  writeTestFiles(
    sandboxDir: string,
    files: Array<{ filePath: string; content: string }>
  ): void {
    for (const file of files) {
      const absolute = join(sandboxDir, file.filePath);
      mkdirSync(join(absolute, ".."), { recursive: true });
      writeFileSync(absolute, file.content, "utf8");
    }
  },

  destroy(sandboxDir: string): void {
    if (existsSync(sandboxDir)) {
      rmSync(sandboxDir, { recursive: true, force: true });
      logger.debug({ sandboxDir }, "qa sandbox cleaned up");
    }
  },
};
