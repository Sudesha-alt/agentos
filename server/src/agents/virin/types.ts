/** Virin — product discovery & PRD agent types */

export type VirinTicketType =
  | "bug"
  | "task"
  | "small_feature"
  | "large_feature"
  | "unclear";

export type VirinStageId =
  | "INTAKE"
  | "QUESTION_MODE"
  | "COMPETITOR_ANALYSIS"
  | "CODEBASE_ANALYSIS"
  | "SYSTEM_DESIGN"
  | "TASK_PLANNING"
  | "SOLUTIONING"
  | "PRD"
  | "HANDOFF"
  | "POST_SHIP"
  | "RETROSPECTIVE";

export const VIRIN_STAGE_ORDER: VirinStageId[] = [
  "INTAKE",
  "QUESTION_MODE",
  "COMPETITOR_ANALYSIS",
  "CODEBASE_ANALYSIS",
  "SYSTEM_DESIGN",
  "TASK_PLANNING",
  "SOLUTIONING",
  "PRD",
  "HANDOFF",
];

export type VirinAnalysisStatus =
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
  ticketType: VirinTicketType;
  reasoning: string;
  symptomVsRootCause: string;
  clarifyingQuestion?: string | null;
  clarifyingOptions?: string[];
}

export interface QuestionModeState {
  conversation: DiscoveryTurn[];
  discoverySummary: string;
  readyToProceed: boolean;
  pendingQuestion?: string | null;
  flagsRaised: string[];
}

export interface CodebaseAnalysisOutput {
  suggestedImplementationMode?: "code" | "content";
  relevantModules: Array<{ path: string; reason: string; role: string }>;
  reuseOpportunities: string[];
  alreadyExists?: string[];
  gapsToBuild?: string[];
  technicalDebt: string[];
  architectureConstraints: string[];
  rootCauseMismatch?: string | null;
  technicalRisks: string[];
  testableAcceptanceCriteria: string[];
  scopeAssessment: string;
  suggestedFirstFile: string;
  suggestedImplementationMode?: "code" | "content";
}

export interface SystemDesignOutput {
  fileList: string[];
  interfaces: Array<{ name: string; methods: string[] }>;
  dataStructures: Array<{ name: string; fields: string[] }>;
  sequenceDiagramMermaid?: string;
  summaryMarkdown?: string;
}

export interface TaskBreakdownItem {
  id: string;
  title: string;
  files: string[];
  dependsOn?: string[];
  description?: string;
}

export type BusinessFit = "strong" | "moderate" | "weak" | "misaligned";

export interface SolutioningOutput {
  problemStatement: string;
  recommendedApproach: string;
  explicitNonGoals: string[];
  openRisks: string[];
  summaryMarkdown: string;
  businessFit?: BusinessFit;
  revenueImpact?: string;
  alignmentNotes?: string;
  companyValidationSummary?: string;
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

export interface VirinNextQuestionResult {
  action: "ask" | "ready" | "flag";
  question?: string;
  options?: string[];
  flag?: string;
  reason?: string;
  discoverySummary?: string;
}

export type CompetitorAnalysisDecision = "pending" | "run" | "skipped";

export interface CompetitorApproachAnalysis {
  competitorName: string;
  competitorWebsite: string;
  howTheySolveIt: string;
  strengths: string[];
  gaps: string[];
  sources: string[];
}

export interface CompetitorAnalysisState {
  decision: CompetitorAnalysisDecision;
  featureSummary: string;
  analyses: CompetitorApproachAnalysis[];
  summaryMarkdown?: string;
  completedAt?: string;
}

export type VirinRunMode = "interactive" | "auto";
