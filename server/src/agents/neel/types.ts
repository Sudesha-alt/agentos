/** Neel — product discovery & PRD agent types */

export type NeelTicketType =
  | "bug"
  | "task"
  | "small_feature"
  | "large_feature"
  | "unclear";

export type NeelStageId =
  | "INTAKE"
  | "QUESTION_MODE"
  | "CODEBASE_ANALYSIS"
  | "SOLUTIONING"
  | "PRD"
  | "HANDOFF"
  | "POST_SHIP"
  | "RETROSPECTIVE";

export const NEEL_STAGE_ORDER: NeelStageId[] = [
  "INTAKE",
  "QUESTION_MODE",
  "CODEBASE_ANALYSIS",
  "SOLUTIONING",
  "PRD",
  "HANDOFF",
];

export type NeelAnalysisStatus =
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "AWAITING_INPUT"
  | "AWAITING_CONFIRMATION";

export interface DiscoveryTurn {
  question: string;
  answer: string;
  flag?: string | null;
  askedAt: string;
  answeredAt?: string;
}

export interface IntakeOutput {
  ticketType: NeelTicketType;
  reasoning: string;
  symptomVsRootCause: string;
  clarifyingQuestion?: string | null;
}

export interface QuestionModeState {
  conversation: DiscoveryTurn[];
  discoverySummary: string;
  readyToProceed: boolean;
  pendingQuestion?: string | null;
  flagsRaised: string[];
}

export interface CodebaseAnalysisOutput {
  relevantModules: Array<{ path: string; reason: string; role: string }>;
  reuseOpportunities: string[];
  technicalDebt: string[];
  architectureConstraints: string[];
  rootCauseMismatch?: string | null;
  technicalRisks: string[];
  testableAcceptanceCriteria: string[];
  scopeAssessment: string;
  suggestedFirstFile: string;
}

export interface SolutioningOutput {
  problemStatement: string;
  recommendedApproach: string;
  explicitNonGoals: string[];
  openRisks: string[];
  summaryMarkdown: string;
  humanConfirmed: boolean;
  humanFeedback?: string | null;
}

export interface EngineeringTicketBreakdown {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  technicalNotes: string[];
  dependsOn: string[];
}

export interface HandoffPackageOutput {
  engineeringTickets: EngineeringTicketBreakdown[];
  dependencyMapMarkdown: string;
  definitionOfDone: string[];
  teamsInvolved: string[];
}

export interface PostShipOutput {
  metricsReview: string;
  outcomesVsTargets: Array<{ metric: string; target: string; actual: string; met: boolean }>;
  surprises: string[];
  nextIterationChanges: string[];
  retrospectiveSummary: string;
}

export interface NeelNextQuestionResult {
  action: "ask" | "ready" | "flag";
  question?: string;
  flag?: string;
  reason?: string;
  discoverySummary?: string;
}
