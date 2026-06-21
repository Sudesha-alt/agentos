export interface AgentMetadata {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
}

export interface AgentOutput<TParsed = Record<string, unknown>> {
  raw: string;
  parsed: TParsed;
  metadata: AgentMetadata;
}

export interface PrdOutput {
  title: string;
  problemStatement: string;
  proposedSolution: string;
  userStories: string[];
  acceptanceCriteria: string[];
  outOfScope: string[];
  edgeCases: string[];
  dependencies: string[];
  successMetrics: string[];
  openQuestions: string[];
  confidenceScore: number;
  confidenceReason: string;
}

export interface ImplementationComponent {
  name: string;
  description: string;
  estimatedDays: number;
}

export interface ImplementationRisk {
  description: string;
  severity: "low" | "medium" | "high";
  mitigation: string;
}

export interface CriterionMapping {
  criterion: string;
  implementation: string;
}

export interface CodeChange {
  filePath: string;
  action: "create" | "modify";
  summary: string;
  linesChanged?: number;
}

export type ImplementationMode = "code" | "content";

export interface ImplementationOutput {
  summary: string;
  technicalApproach: string;
  components: ImplementationComponent[];
  apiChanges: string[];
  databaseChanges: string[];
  dependencies: string[];
  risks: ImplementationRisk[];
  totalEstimateDays: number;
  criteriaMapping: CriterionMapping[];
  blockers: string[];
  confidenceScore: number;
  confidenceReason: string;
  implementationMode?: ImplementationMode;
  targetFiles?: string[];
  codeChanges?: CodeChange[];
  codingSummary?: string;
}

export interface TestCase {
  id: string;
  title: string;
  type: "unit" | "integration" | "e2e" | "security" | "performance";
  linkedCriterion: string;
  preconditions: string[];
  steps: string[];
  expectedResult: string;
  priority: "critical" | "high" | "medium" | "low";
}

export interface CoverageReport {
  totalCriteria: number;
  coveredCriteria: number;
  coveragePercent: number;
  uncoveredCriteria: string[];
}

export interface QaOutput {
  testSummary: string;
  testCases: TestCase[];
  coverageReport: CoverageReport;
  riskAreas: string[];
  automationRecommendations: string[];
  confidenceScore: number;
  confidenceReason: string;
}
