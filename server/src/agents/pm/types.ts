import type {
  CodebaseAnalysisOutput,
  HandoffPackageOutput,
  IntakeOutput,
  PostShipOutput,
  QuestionModeState,
  SolutioningOutput,
  SystemDesignOutput,
  TaskBreakdownItem,
  VirinStageId,
} from "../virin/types";
import { VIRIN_STAGE_ORDER } from "../virin/types";

export type PmAnalysisStatus =
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "AWAITING_INPUT"
  | "AWAITING_CONFIRMATION";

/** Virin stage IDs (product discovery agent) */
export type PmStageId = VirinStageId;

export const PM_STAGE_ORDER: PmStageId[] = VIRIN_STAGE_ORDER;

export type VirinRunMode = "interactive" | "auto";

export interface PmTicketInput {
  jiraKey: string;
  summary: string;
  description: string;
  issueType: string;
  reporter: string;
  labels: string[];
  components: string[];
  createdDate: string;
  priority: string;
}

/** @deprecated Legacy — synced from Virin outputs for pipeline compatibility */
export interface EnrichmentOutput {
  cleanSummary: string;
  realUserProblem: string;
  missingContext: string[];
  relatedTicketsSummary: string;
  reporterContext: string;
  okrAlignment: string;
  redFlags: string[];
}

/** @deprecated Legacy — synced from Virin intake */
export interface ClassificationOutput {
  type: string;
  subtype: string;
  severity: string;
  severityReasoning: string;
  affectedUserSegment: string;
  estimatedUsersAffected: string;
  revenueRisk: string;
  strategicAlignment: number;
  strategicAlignmentReason: string;
  isDuplicate: boolean;
  duplicateOf: string | null;
  classificationConfidence: number;
  requiresHumanEscalation: boolean;
  escalationReason: string | null;
}

export interface AffectedFileEntry {
  path: string;
  reason: string;
  role: string;
  confidence: number;
  riskLevel: string;
}

/** @deprecated Legacy — synced from Virin codebase analysis */
export interface CodebaseImpactOutput {
  affectedFiles: AffectedFileEntry[];
  recentChangeConnection: string;
  dependencyWarnings: string[];
  scopeAssessment: string;
  suggestedFirstFile: string;
}

export interface EffortBreakdown {
  investigation: string;
  implementation: string;
  testing: string;
  review: string;
}

export interface EffortEstimateOutput {
  tshirt: string;
  storyPoints: string;
  confidenceInEstimate: number;
  breakdown: EffortBreakdown;
  riskFactors: string[];
  assumptions: string[];
  recommendedApproach: string;
  estimateConfidenceNote: string;
}

export interface ImplementationStep {
  step: string;
  action: string;
  why: string;
  watchOut: string;
}

export interface ImplementationOutput {
  approachSummary: string;
  implementationSteps: ImplementationStep[];
  whereNotToTouch: string[];
  testingGuidance: string;
  alternativeApproach: string;
  openQuestionsForEngineer: string[];
}

export interface PrioritizationOutput {
  recommendation: string;
  recommendationReasoning: string;
  impactScore: string;
  costOfInaction: string;
  tradeoff: string;
  conditionsToRevisit: string;
  suggestedOwner: string;
  suggestedSprint: string;
  escalateToHuman: boolean;
  escalationReason: string | null;
}

export interface AcceptanceCriterion {
  given: string;
  when: string;
  then: string;
}

export interface EdgeCase {
  scenario: string;
  given: string;
  when: string;
  then: string;
}

export interface AcceptanceCriteriaOutput {
  userStory: string;
  happyPath: AcceptanceCriterion[];
  edgeCases: EdgeCase[];
  explicitlyOutOfScope: string[];
  regressionRisks: string[];
  definitionOfDone: string[];
}

export interface ArtifactsOutput {
  engineeringPing: string;
  stakeholderUpdate: string;
  pmOneLiner: string;
  sprintPlanningNote: string;
}

export interface RetrospectiveOutput {
  classificationAccuracy: string;
  classificationNote: string;
  severityAccuracy: string;
  severityNote: string;
  priorityAccuracy: string;
  priorityOverrideAnalysis: string;
  effortAccuracy: string;
  effortVariance: string;
  fileDetectionAccuracy: string;
  acQuality: string;
  rootCauseOfErrors: string[];
  learningSignals: string[];
  patternFlag: string;
}

export interface PmStageMeta {
  stage: PmStageId;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  startedAt: string;
  completedAt?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  error?: string;
}

export interface PmAnalysisRecord {
  id: string;
  jiraKey: string;
  status: PmAnalysisStatus;
  currentStage: PmStageId | null;
  ticketInput: PmTicketInput;
  context: Record<string, unknown>;
  /** Virin agent identity */
  agentName?: "Virin";
  neelMode?: VirinRunMode;
  neelIntake?: IntakeOutput;
  questionMode?: QuestionModeState;
  competitorAnalysis?: import("../virin/types").CompetitorAnalysisState;
  codebaseAnalysis?: CodebaseAnalysisOutput;
  systemDesign?: SystemDesignOutput;
  taskBreakdown?: TaskBreakdownItem[];
  solutioning?: SolutioningOutput;
  handoffPackage?: HandoffPackageOutput;
  postShip?: PostShipOutput;
  pendingQuestion?: string | null;
  pendingQuestionOptions?: string[];
  pendingQuestionStage?: PmStageId | null;
  pendingAnswer?: string | null;
  pendingFlag?: string | null;
  /** Legacy synced fields */
  enrichment?: EnrichmentOutput;
  classification?: ClassificationOutput;
  codebaseImpact?: CodebaseImpactOutput;
  effortEstimate?: EffortEstimateOutput;
  implementation?: ImplementationOutput;
  prioritization?: PrioritizationOutput;
  acceptanceCriteria?: AcceptanceCriteriaOutput;
  generatedPrd?: import("../../prd/prdGenerator").GeneratedPRD;
  artifacts?: ArtifactsOutput;
  retrospective?: RetrospectiveOutput;
  stageMeta: PmStageMeta[];
  error?: string;
  startedAt: string;
  completedAt?: string;
  updatedAt: string;
}

export interface RetrospectiveInput {
  actualType?: string;
  actualSeverity?: string;
  humanDecision?: string;
  overrideReason?: string;
  actualPoints?: string;
  actualFilesChanged?: string[];
  acCoverageRating?: number;
  stageDurations?: Record<string, string>;
  metricsInput?: string;
  launchNotes?: string;
}

export type {
  IntakeOutput,
  QuestionModeState,
  CodebaseAnalysisOutput,
  SolutioningOutput,
  HandoffPackageOutput,
  PostShipOutput,
  SystemDesignOutput,
  TaskBreakdownItem,
};
