export type CanaryEnvironment = "staging" | "production" | "preview" | "feature_branch";
export type CanaryTrigger = "pipeline" | "manual" | "scheduled_light" | "scheduled_deep" | "post_merge" | "anomaly";
export type CanaryScope = "full" | "critical_paths" | "changed_files";

export interface ApplicationUnderstanding {
  targetUrl: string;
  endpointCount: number;
  endpoints: Array<{ method: string; path: string; source?: string }>;
  dataModelCount: number;
  dataModels: string[];
  recentChanges: Array<{ path: string; summary?: string }>;
  knownFailurePatterns: string[];
  testCoverageGaps: string[];
  highRiskAreas: string[];
  notes: string[];
}

export interface CanaryHypothesis {
  id: string;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  reasoning: string;
  evidence: string[];
  probeScenario: string;
  status: "pending" | "confirmed" | "disproved" | "skipped";
}

export interface CanaryFindingDraft {
  hypothesisId?: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  reproductionSteps?: string;
  evidence?: Record<string, unknown>;
  affectedCode?: string;
  suggestedFix?: string;
}

export interface CanaryOrientation {
  prdSummary?: string;
  implementationSummary?: string;
  qaSummary?: string;
  changedFiles?: string[];
}

export interface CanaryRunInput {
  pipelineId?: string;
  jiraKey?: string;
  ticketId?: string;
  trigger: CanaryTrigger;
  environment: CanaryEnvironment;
  scope?: CanaryScope;
  targetUrl?: string;
  orientation?: CanaryOrientation;
}

export interface CanaryRunResult {
  runId: string;
  status: "completed" | "failed";
  understanding: ApplicationUnderstanding;
  hypotheses: CanaryHypothesis[];
  findings: CanaryFindingDraft[];
  summary: string;
  error?: string;
}

export interface CanaryExplorationOutput {
  hypotheses: CanaryHypothesis[];
  findings: CanaryFindingDraft[];
  explorationNotes: string[];
}
