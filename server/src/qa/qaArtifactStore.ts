import type { TestRunResult } from "./testing/testRunner";
import type { QaExecutionReport } from "./report/reportGenerator";

export interface StagedTestFile {
  filePath: string;
  content: string;
  branchName: string;
  commitMessage: string;
}

export interface QaPipelineArtifacts {
  stagedTestFiles: StagedTestFile[];
  lastTestRun?: TestRunResult;
  executionReport?: QaExecutionReport;
}

const store = new Map<string, QaPipelineArtifacts>();

export function getQaArtifacts(pipelineId: string): QaPipelineArtifacts {
  if (!store.has(pipelineId)) {
    store.set(pipelineId, { stagedTestFiles: [] });
  }
  return store.get(pipelineId)!;
}

export function clearQaArtifacts(pipelineId: string): void {
  store.delete(pipelineId);
}
