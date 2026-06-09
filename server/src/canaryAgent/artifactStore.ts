import type { CanaryFindingDraft, CanaryHypothesis } from "./types";

export interface CanaryArtifacts {
  hypotheses: CanaryHypothesis[];
  findings: CanaryFindingDraft[];
  explorationNotes: string[];
}

const store = new Map<string, CanaryArtifacts>();

export function getCanaryArtifacts(runId: string): CanaryArtifacts {
  let artifacts = store.get(runId);
  if (!artifacts) {
    artifacts = { hypotheses: [], findings: [], explorationNotes: [] };
    store.set(runId, artifacts);
  }
  return artifacts;
}

export function setCanaryHypotheses(runId: string, hypotheses: CanaryHypothesis[]): void {
  const artifacts = getCanaryArtifacts(runId);
  artifacts.hypotheses = hypotheses;
}

export function clearCanaryArtifacts(runId: string): void {
  store.delete(runId);
}
