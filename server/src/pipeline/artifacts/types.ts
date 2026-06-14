export type PipelineArtifactType =
  | "IMPLEMENTATION_PLAN"
  | "CODE_SUMMARY"
  | "TEST_PLAN"
  | "SYSTEM_DESIGN"
  | "TASK_BREAKDOWN";

export type PipelineArtifactProducer = "virin" | "engineering" | "qa" | "pipeline";

export interface PipelineArtifact {
  id: string;
  pipelineId: string;
  jiraKey: string;
  type: PipelineArtifactType;
  producer: PipelineArtifactProducer;
  title: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

/** Roles that subscribe to artifact types (MetaGPT-style interest map). */
export const ARTIFACT_SUBSCRIPTIONS: Record<
  "engineering" | "qa",
  PipelineArtifactType[]
> = {
  engineering: ["IMPLEMENTATION_PLAN", "SYSTEM_DESIGN", "TASK_BREAKDOWN"],
  qa: ["IMPLEMENTATION_PLAN", "CODE_SUMMARY", "TEST_PLAN"],
};

/** Eng/QA pipeline artifact types shown in Pipeline detail UI. */
export const ENG_QA_ARTIFACT_TYPES: PipelineArtifactType[] = [
  "IMPLEMENTATION_PLAN",
  "CODE_SUMMARY",
  "TEST_PLAN",
];
