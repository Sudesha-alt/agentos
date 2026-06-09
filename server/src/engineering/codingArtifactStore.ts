export interface StagedSourceFile {
  filePath: string;
  content: string;
  branchName: string;
  action: "create" | "modify";
  summary: string;
}

export interface EngineeringCodingArtifacts {
  stagedFiles: StagedSourceFile[];
}

const store = new Map<string, EngineeringCodingArtifacts>();

export function getCodingArtifacts(pipelineId: string): EngineeringCodingArtifacts {
  if (!store.has(pipelineId)) {
    store.set(pipelineId, { stagedFiles: [] });
  }
  return store.get(pipelineId)!;
}

export function clearCodingArtifacts(pipelineId: string): void {
  store.delete(pipelineId);
}
