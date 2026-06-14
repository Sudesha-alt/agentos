import { randomUUID } from "crypto";
import type { PipelineArtifact, PipelineArtifactType, PipelineArtifactProducer } from "./types";

const byPipeline = new Map<string, PipelineArtifact[]>();

export function listPipelineArtifacts(pipelineId: string): PipelineArtifact[] {
  return [...(byPipeline.get(pipelineId) ?? [])].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );
}

export function getArtifactsByType(
  pipelineId: string,
  type: PipelineArtifactType
): PipelineArtifact[] {
  return listPipelineArtifacts(pipelineId).filter((a) => a.type === type);
}

export function upsertPipelineArtifact(input: {
  pipelineId: string;
  jiraKey: string;
  type: PipelineArtifactType;
  producer: PipelineArtifactProducer;
  title: string;
  payload: Record<string, unknown>;
}): PipelineArtifact {
  const existing = listPipelineArtifacts(input.pipelineId);
  const prior = existing.find((a) => a.type === input.type);
  const artifact: PipelineArtifact = {
    id: prior?.id ?? randomUUID(),
    pipelineId: input.pipelineId,
    jiraKey: input.jiraKey.toUpperCase(),
    type: input.type,
    producer: input.producer,
    title: input.title,
    payload: input.payload,
    createdAt: prior?.createdAt ?? new Date().toISOString(),
  };

  const next = prior
    ? existing.map((a) => (a.id === prior.id ? artifact : a))
    : [...existing, artifact];
  byPipeline.set(input.pipelineId, next);
  return artifact;
}

export function clearPipelineArtifacts(pipelineId: string): void {
  byPipeline.delete(pipelineId);
}
