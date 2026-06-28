import type { StagedSourceFile } from "./codingArtifactStore";
import { sandboxManager } from "../qa/testing/sandboxManager";
import { logger } from "../utils/logger";
import {
  resolveCompileCwd,
  runCompileInDir,
} from "./workspaceCompile";

export interface SandboxCompileResult {
  success: boolean;
  attempts: number;
  errors: string[];
  sandboxAvailable: boolean;
}

export const MAX_COMPILE_ATTEMPTS = 3;

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

    const result = runCompileInDir(cwd, "full");
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
