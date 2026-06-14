import type { PmAnalysisRecord } from "../../agents/pm/types";
import type { TaskBreakdownItem } from "../../agents/virin/types";
import {
  getArtifactsByType,
  listPipelineArtifacts,
  upsertPipelineArtifact,
} from "./store";
import type {
  PipelineArtifact,
  PipelineArtifactProducer,
  PipelineArtifactType,
} from "./types";
import { ARTIFACT_SUBSCRIPTIONS } from "./types";

export { ARTIFACT_SUBSCRIPTIONS, ENG_QA_ARTIFACT_TYPES } from "./types";
export type { PipelineArtifact, PipelineArtifactType } from "./types";
export { listPipelineArtifacts, clearPipelineArtifacts } from "./store";

export function publishPipelineArtifact(input: {
  pipelineId: string;
  jiraKey: string;
  type: PipelineArtifactType;
  producer: PipelineArtifactProducer;
  title: string;
  payload: Record<string, unknown>;
}): PipelineArtifact {
  return upsertPipelineArtifact(input);
}

export function subscribePipelineArtifacts(
  pipelineId: string,
  role: keyof typeof ARTIFACT_SUBSCRIPTIONS
): PipelineArtifact[] {
  const types = ARTIFACT_SUBSCRIPTIONS[role];
  return listPipelineArtifacts(pipelineId).filter((a) => types.includes(a.type));
}

export function mirrorPmArtifactsToPipeline(input: {
  pipelineId: string;
  record: PmAnalysisRecord;
}): PipelineArtifact[] {
  const { pipelineId, record } = input;
  const published: PipelineArtifact[] = [];

  if (record.systemDesign) {
    published.push(
      publishPipelineArtifact({
        pipelineId,
        jiraKey: record.jiraKey,
        type: "SYSTEM_DESIGN",
        producer: "virin",
        title: "System design",
        payload: record.systemDesign as unknown as Record<string, unknown>,
      })
    );
  }

  if (record.taskBreakdown?.length) {
    published.push(
      publishPipelineArtifact({
        pipelineId,
        jiraKey: record.jiraKey,
        type: "TASK_BREAKDOWN",
        producer: "virin",
        title: "Task breakdown",
        payload: { tasks: record.taskBreakdown },
      })
    );
  }

  if (record.generatedPrd) {
    published.push(
      publishPipelineArtifact({
        pipelineId,
        jiraKey: record.jiraKey,
        type: "IMPLEMENTATION_PLAN",
        producer: "virin",
        title: record.generatedPrd.title ?? "PRD",
        payload: {
          source: "pm_prd",
          prd: record.generatedPrd,
          handoff: record.handoffPackage ?? null,
        },
      })
    );
  }

  return published;
}

export function mirrorPmContextArtifacts(input: {
  pipelineId: string;
  pmContext: import("../../agents/pm/pmPipelineContext").PmPipelineContext;
}): PipelineArtifact[] {
  const { pipelineId, pmContext } = input;
  const doc = pmContext.enrichedPrdDocument;
  const published: PipelineArtifact[] = [];

  const design = doc.pmSystemDesign as Record<string, unknown> | null | undefined;
  if (design && Object.keys(design).length > 0) {
    published.push(
      publishPipelineArtifact({
        pipelineId,
        jiraKey: pmContext.jiraKey,
        type: "SYSTEM_DESIGN",
        producer: "virin",
        title: "System design",
        payload: design,
      })
    );
  }

  const tasks = doc.pmTaskBreakdown as TaskBreakdownItem[] | null | undefined;
  if (tasks?.length) {
    published.push(
      publishPipelineArtifact({
        pipelineId,
        jiraKey: pmContext.jiraKey,
        type: "TASK_BREAKDOWN",
        producer: "virin",
        title: "Task breakdown",
        payload: { tasks },
      })
    );
  }

  if (pmContext.generatedPrd) {
    published.push(
      publishPipelineArtifact({
        pipelineId,
        jiraKey: pmContext.jiraKey,
        type: "IMPLEMENTATION_PLAN",
        producer: "virin",
        title: pmContext.generatedPrd.title ?? "PRD",
        payload: {
          source: "pm_prd",
          prd: pmContext.generatedPrd,
        },
      })
    );
  }

  return published;
}

export function getLatestArtifact(
  pipelineId: string,
  type: PipelineArtifactType
): PipelineArtifact | null {
  const items = getArtifactsByType(pipelineId, type);
  return items.length ? items[items.length - 1]! : null;
}

export function buildProductPackageExport(record: PmAnalysisRecord) {
  return {
    jiraKey: record.jiraKey,
    exportedAt: new Date().toISOString(),
    agent: record.agentName ?? "Virin",
    prd: record.generatedPrd ?? null,
    systemDesign: record.systemDesign ?? null,
    taskBreakdown: record.taskBreakdown ?? null,
    handoffPackage: record.handoffPackage ?? null,
    discoverySummary: record.questionMode?.discoverySummary ?? null,
    solutioning: record.solutioning ?? null,
  };
}
