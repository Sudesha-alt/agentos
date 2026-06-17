// In-memory mock backend so the product UI is fully usable without spinning
// up Postgres / Redis. The shape mirrors the real Express routes 1:1.

import { computeEstimatedRoi } from "../../shared/roi/estimatedRoi";

const MOCK_ORG_SLUG = "agentos";
function mockOrgPath(...segments) {
  const tail = segments.filter(Boolean).join("/");
  return tail ? `/${MOCK_ORG_SLUG}/${tail}` : `/${MOCK_ORG_SLUG}`;
}

let used = false;
function markUsed() {
  used = true;
}

const now = Date.now();
const minutes = (n) => new Date(now - n * 60 * 1000).toISOString();

const MOCK_PIPELINES = [
  {
    id: "pl_01J7H2",
    ticketId: "tk_01J7H2",
    currentStage: "QA_AGENT",
    status: "RUNNING",
    startedAt: minutes(2),
    completedAt: null,
    ticket: {
      jiraKey: "PROD-1863",
      normalizedData: { summary: "QA Agent running checkout regression" },
    },
  },
  {
    id: "pl_01J7A1",
    ticketId: "tk_01J7A1",
    currentStage: "ENGINEERING_AGENT",
    status: "RUNNING",
    startedAt: minutes(4),
    completedAt: null,
    ticket: {
      jiraKey: "PROD-1871",
      normalizedData: { summary: "Engineering Agent writing multi-currency service" },
    },
  },
  {
    id: "pl_01J6XP",
    ticketId: "tk_01J6XP",
    currentStage: "PRD_VALIDATION",
    status: "PAUSED",
    startedAt: minutes(23),
    completedAt: null,
    ticket: {
      jiraKey: "PROD-1842",
      normalizedData: { summary: "Multi-currency checkout" },
    },
  },
  {
    id: "pl_01J6EN",
    ticketId: "tk_01J6EN",
    currentStage: "IMPLEMENTATION_VALIDATION",
    status: "PAUSED",
    startedAt: minutes(8),
    completedAt: null,
    ticket: {
      jiraKey: "PROD-1851",
      normalizedData: { summary: "SSO integration for enterprise" },
    },
  },
  {
    id: "pl_01J6RUN1",
    ticketId: "tk_01J6RUN1",
    currentStage: "PRODUCT_AGENT",
    status: "RUNNING",
    startedAt: minutes(12),
    completedAt: null,
    ticket: {
      jiraKey: "PROD-1839",
      normalizedData: { summary: "Pipeline started — PRD generation" },
    },
  },
  {
    id: "pl_01J6RUN2",
    ticketId: "tk_01J6RUN2",
    currentStage: "ENGINEERING_AGENT",
    status: "RUNNING",
    startedAt: minutes(6),
    completedAt: null,
    ticket: {
      jiraKey: "PROD-1844",
      normalizedData: { summary: "PRD generation complete — engineering queued" },
    },
  },
  {
    id: "pl_01J6L1",
    ticketId: "tk_01J6L1",
    currentStage: "OUTPUT",
    status: "COMPLETED",
    startedAt: minutes(42),
    completedAt: minutes(38),
    ticket: {
      jiraKey: "PROD-1842",
      normalizedData: { summary: "Multi-currency checkout" },
    },
  },
  {
    id: "pl_01J6CK",
    ticketId: "tk_01J6CK",
    currentStage: "ENGINEERING_AGENT",
    status: "FAILED",
    startedAt: minutes(89),
    completedAt: minutes(82),
    ticket: {
      jiraKey: "PLT-1252",
      normalizedData: { summary: "SAML SSO for Enterprise plan" },
    },
  },
  {
    id: "pl_01J5W3",
    ticketId: "tk_01J5W3",
    currentStage: "OUTPUT",
    status: "COMPLETED",
    startedAt: minutes(140),
    completedAt: minutes(132),
    ticket: {
      jiraKey: "PLT-1244",
      normalizedData: { summary: "Per-tenant rate limit dashboard" },
    },
  },
  {
    id: "pl_01J5K7",
    ticketId: "tk_01J5K7",
    currentStage: "OUTPUT",
    status: "COMPLETED",
    startedAt: minutes(220),
    completedAt: minutes(212),
    ticket: {
      jiraKey: "PLT-1239",
      normalizedData: { summary: "Auto-tag tickets by component" },
    },
  },
];

const MOCK_TICKET_ANALYSIS = {
  coreIntent:
    "Enable enterprise admins to export immutable pipeline audit trails for compliance attestation.",
  atomicRequirements: [
    {
      id: "REQ-001",
      description: "Admin can request export for up to 90 days of workspace activity",
      type: "functional",
      source: "explicit",
      clarity: "clear",
    },
    {
      id: "REQ-002",
      description: "Export bundle includes SHA-256 integrity verification",
      type: "non-functional",
      source: "implicit",
      clarity: "clear",
    },
    {
      id: "REQ-003",
      description: "Non-admin roles receive 403 on export API",
      type: "functional",
      source: "implicit",
      clarity: "ambiguous",
    },
  ],
  ambiguities: [
    {
      description: "PII redaction policy not specified",
      impact: "high",
      question: "Should exports redact user emails by default?",
    },
  ],
  userPersonas: [
    {
      persona: "Workspace admin",
      need: "SOC2-ready audit export",
      currentPain: "Must screen-scrape the dashboard",
    },
  ],
  systemsAffected: ["API", "Object storage", "Notification service", "Postgres"],
  roughComplexity: "medium",
  workType: "new-feature",
  understandingConfidence: 0.78,
};

const MOCK_HISTORICAL = {
  successPatterns: [
    {
      pattern: "Async job + signed download URL for large exports",
      source: "PLT-1198",
      applicability: "direct",
    },
  ],
  knownFailures: [
    {
      failure: "Multipart upload retries caused hash drift",
      source: "PLT-1204",
      preventionSuggestion: "Compute hash incrementally during stream",
    },
  ],
  impliedRequirements: [
    {
      requirement: "Rate limit export requests per workspace",
      source: "PLT-1198",
      confidence: 0.82,
    },
  ],
  technicalPatterns: [
    {
      pattern: "BullMQ worker streams Postgres in chunks",
      context: "Prior export features",
      relevance: "high",
    },
  ],
  historicalQAIssues: [
    { issue: "Missing 403 test for non-admin", frequency: "often" },
  ],
  reuseOpportunities: [
    {
      component: "signed-url-service",
      description: "Existing S3 presign helper",
      source: "PLT-1198",
    },
  ],
  historicalCoverage: "moderate",
  intelligenceConfidence: 0.74,
};

const MOCK_GAPS = {
  knownKnowns: [
    { item: "Export scoped to one workspace", confidence: 0.95, source: "ticket" },
  ],
  knownUnknowns: [
    {
      gap: "Default PII redaction behaviour",
      category: "scope-boundary",
      resolutionRequired: true,
      suggestedResolution: "PM decision on redaction toggle",
      defaultAssumption: "Redact email fields by default",
    },
  ],
  endpointGaps: [
    {
      description: "Create async export job",
      existingEndpoint: null,
      newEndpointNeeded: "POST /api/v1/workspaces/:id/exports",
      httpMethod: "POST",
      estimatedComplexity: "moderate",
    },
  ],
  dataGaps: [
    {
      description: "Track export job lifecycle",
      newFieldsNeeded: ["status: enum", "hash: string"],
      newTablesNeeded: ["export_jobs"],
      existingTablesAffected: ["pipelines", "audit_logs"],
    },
  ],
  accessGaps: [
    {
      description: "Only workspace_admin may enqueue exports",
      rolesInvolved: ["workspace_admin", "member"],
      permissionModel: "RBAC check on POST /exports",
    },
  ],
  nfrGaps: [
    {
      type: "performance",
      gap: "No p95 SLA for export completion",
      defaultStandard: "p95 < 8 minutes for 90-day range",
    },
  ],
  readinessForPRD: "ready-with-assumptions",
  blockingGaps: 1,
  totalGaps: 6,
};

const MOCK_COMPLEXITY = {
  overallScore: 6,
  dimensions: {
    technicalComplexity: 6,
    integrationComplexity: 7,
    dataComplexity: 5,
    uxComplexity: 4,
    testingComplexity: 6,
  },
  effortEstimate: { optimistic: 4, realistic: 6, pessimistic: 10, unit: "hours" },
  complexityDrivers: [
    {
      driver: "Streaming large datasets to object storage",
      impact: "high",
      mitigation: "Chunked reads with backpressure",
    },
  ],
  estimateRisks: [
    { risk: "PII policy change mid-pipeline", probability: "medium", impactHours: 2 },
  ],
  shouldBreakDown: false,
  breakdownSuggestion: null,
  priorityAssessment: {
    businessValue: 8,
    technicalDebt: 6,
    userImpact: 7,
    recommendedPriority: "high",
    priorityReasoning: "Enterprise compliance blocker",
  },
};

const MOCK_GENERATED_PRD = {
  title: "Workspace-level audit log export",
  version: "v1.0",
  status: "Draft",
  jiraKey: "PLT-1271",
  createdAt: minutes(13.7),
  priority: "High",
  effortEstimate: "M · ~6h agent pipeline (realistic)",
  problemStatement:
    "Enterprise admins cannot extract immutable audit trails of pipeline activity for SOC2 attestation without screen-scraping the dashboard.",
  proposedSolution:
    "Add an asynchronous export job that produces a signed CSV/JSON bundle scoped to one workspace, with SHA-256 integrity hash and a 7-day download window.",
  successDefinition:
    "Admin receives tamper-evident export within SLA; download link expires after 7 days.",
  userPersonas: MOCK_TICKET_ANALYSIS.userPersonas,
  userStories: [
    {
      id: "US-001",
      story:
        "As a workspace admin I want to export 90 days of pipeline activity so that I can attach it to my SOC2 audit",
      acceptanceCriteria: [
        "Given an admin with workspace_admin role When they POST an export for a valid date range Then a job is enqueued and confirmation is sent within 60 seconds",
        "Given a completed export When the admin downloads the bundle Then the SHA-256 header matches the file body",
        "Given a non-admin When they call POST /exports Then the API returns 403 WS_EXPORT_FORBIDDEN",
      ],
      priority: "must-have",
    },
  ],
  technicalRequirements: {
    endpoints: [
      {
        method: "POST",
        path: "/api/v1/workspaces/:workspaceId/exports",
        description: "Enqueue export job",
        requestBody: "{ from: ISO, to: ISO }",
        responseShape: "{ jobId: string, status: 'queued' }",
        authRequired: true,
        notes: "workspace_admin only",
      },
    ],
    dataModel: [
      {
        table: "export_jobs",
        changes: "create",
        fields: ["id: uuid", "workspace_id: uuid", "status: enum", "content_hash: string"],
      },
    ],
    systemsAffected: MOCK_TICKET_ANALYSIS.systemsAffected,
    technicalAssumptions: ["S3 bucket per workspace", "Emails redacted by default"],
  },
  nonFunctionalRequirements: [
    {
      type: "performance",
      requirement: "p95 export completes in under 8 minutes for 90-day range",
      measurable: "Load test with 500k audit rows",
    },
  ],
  assumptions: ["PII redacted by default until PM confirms otherwise"],
  outOfScope: ["Scheduled recurring exports", "PDF rendering"],
  openQuestions: [
    {
      question: "Should we redact PII fields by default?",
      impact: "Schema and QA coverage",
      defaultAssumption: "Redact email fields",
      owner: "PM",
    },
  ],
  risks: [
    {
      risk: "Large workspaces exceed multipart limits",
      probability: "medium",
      impact: "Export failure or timeout",
      mitigation: "Shard into 4GB parts",
    },
  ],
  successMetrics: [
    {
      metric: "Export completion time",
      baseline: "N/A (new)",
      target: "p95 < 8 min",
      measurementMethod: "Worker duration histogram",
    },
  ],
  complexitySummary: {
    score: 6,
    effortOptimistic: "4h",
    effortRealistic: "6h",
    effortPessimistic: "10h",
    keyComplexityDrivers: ["Streaming to S3", "RBAC on new endpoints"],
  },
  prdConfidence: 0.62,
  confidenceNotes:
    "Open question about PII redaction must be answered before engineering finalises schema.",
};

const MOCK_PRD = {
  title: "Workspace-level audit log export",
  problemStatement:
    "Enterprise admins cannot extract immutable audit trails of pipeline activity for SOC2 attestation without screen-scraping the dashboard.",
  proposedSolution:
    "Add an asynchronous export job that produces a signed CSV / JSON bundle of pipeline activity scoped to one workspace, with SHA-256 integrity hash and a 7-day download window.",
  userStories: [
    "As a workspace admin, I want to export 90 days of pipeline activity so that I can attach it to my SOC2 audit.",
    "As a security engineer, I want exports to be tamper-evident so I can verify them in our review tooling.",
  ],
  acceptanceCriteria: [
    "Given an admin with role workspace_admin, when they request an export for a date range up to 90 days, then a background job is enqueued and they receive a confirmation email within 60 seconds.",
    "Given a completed export, when the user downloads the bundle, then the response includes a SHA-256 hash header that matches the file body.",
    "Given an export job, when the workspace is suspended or deleted, then the job is cancelled and no download link is issued.",
    "Given an export request from a non-admin, when the API is called, then a 403 is returned with code WS_EXPORT_FORBIDDEN.",
  ],
  outOfScope: [
    "Scheduled / recurring exports",
    "PDF rendering of the export",
  ],
  edgeCases: [
    "Workspace deletion mid-export",
    "Export larger than 500MB must be chunked",
    "Time zone in date range parameter",
  ],
  dependencies: ["Object storage bucket per-workspace", "Notification service for confirmation email"],
  successMetrics: [
    "p95 export job completes in < 8 minutes for a 90-day range",
    ">= 99% of issued download links are accessed before expiry",
  ],
  openQuestions: [
    "Should we redact PII fields by default or surface a toggle?",
  ],
  confidenceScore: 0.62,
  confidenceReason:
    "Open question about PII redaction must be answered before engineering can finalise schema. Recommend human review.",
};

const MOCK_SCORES = {
  understandingScore: 0.72,
  prdQualityScore: 0.62,
  historicalSignalScore: 0.68,
  complexityScore: 5.8,
  passesGate: false,
  gateFailureReasons: [
    "1 blocking gap(s) must be resolved",
    "PRD quality 62% below 70% gate threshold",
  ],
  recommendation: "clarify",
  bands: {
    understanding: { point: 0.72, uncertainty: 0.06, low: 0.66, high: 0.78 },
    prdQuality: { point: 0.62, uncertainty: 0.06, low: 0.56, high: 0.68 },
    historicalSignal: { point: 0.68, uncertainty: 0.05, low: 0.63, high: 0.73 },
  },
  breakdown: {
    readiness: "ready-with-assumptions",
    blockingGaps: 1,
    totalGaps: 6,
    recommendation: "clarify",
  },
};

const MOCK_DISCOVERY_OUTPUT = {
  prd: MOCK_PRD,
  scores: MOCK_SCORES,
  discovery: {
    ticketAnalysis: MOCK_TICKET_ANALYSIS,
    historicalIntelligence: MOCK_HISTORICAL,
    gapAnalysis: MOCK_GAPS,
    complexityAssessment: MOCK_COMPLEXITY,
    generatedPrd: MOCK_GENERATED_PRD,
  },
};

const MOCK_IMPLEMENTATION = {
  summary:
    "Two new services and a worker job. Stateless export-orchestrator coordinates a background job that streams pipeline rows into object storage in NDJSON, computes SHA-256 incrementally, and signs a download URL.",
  technicalApproach:
    "Add an /exports endpoint accepting workspace + date range. Enqueue a BullMQ job. The worker streams from Postgres in 5k-row chunks, writes to S3 with multipart upload, finalises by recording the manifest.",
  components: [
    { name: "export-orchestrator", description: "REST handler + job dispatch", estimatedDays: 2.5 },
    { name: "export-worker", description: "BullMQ worker, streaming + hashing", estimatedDays: 4 },
    { name: "manifest-store", description: "Postgres tables + signed URL signer", estimatedDays: 1.5 },
  ],
  apiChanges: ["POST /exports", "GET /exports/:id", "GET /exports/:id/download"],
  databaseChanges: [
    "create table export_jobs",
    "create index on export_jobs(workspace_id, status)",
  ],
  dependencies: ["AWS S3 (signed URLs)", "Existing notification service"],
  risks: [
    {
      description: "Large workspaces could exceed S3 multipart limits",
      severity: "medium",
      mitigation: "Cap per-file size at 4GB; auto-shard into multiple parts",
    },
  ],
  totalEstimateDays: 9,
  criteriaMapping: [
    {
      criterion:
        "Given an admin with role workspace_admin, when they request an export for a date range up to 90 days, then a background job is enqueued and they receive a confirmation email within 60 seconds.",
      implementation: "POST /exports enqueues BullMQ job; notification service triggers on accepted state",
    },
    {
      criterion:
        "Given a completed export, when the user downloads the bundle, then the response includes a SHA-256 hash header that matches the file body.",
      implementation:
        "Worker computes hash incrementally during streaming; download proxy attaches X-Content-SHA256 header",
    },
    {
      criterion:
        "Given an export job, when the workspace is suspended or deleted, then the job is cancelled and no download link is issued.",
      implementation:
        "Worker re-checks workspace state before finalising; orchestrator subscribes to workspace lifecycle events",
    },
    {
      criterion:
        "Given an export request from a non-admin, when the API is called, then a 403 is returned with code WS_EXPORT_FORBIDDEN.",
      implementation: "Auth middleware enforces workspace_admin scope; returns typed error",
    },
  ],
  blockers: [],
  confidenceScore: 0.84,
  confidenceReason:
    "Plan maps to every acceptance criterion, dependencies are owned in-house, single moderate risk has mitigation.",
  codeEdits: [
    {
      filePath: "server/src/pipeline/orchestrator.ts",
      summary: "Inject enriched PRD and codebase snapshot into Engineering agent input.",
      diff: "@@ -236,7 +236,10 @@\n- private async runEngineeringAgent(pipelineId, jiraKey, prd)\n+ private async runEngineeringAgent(\n+   pipelineId,\n+   jiraKey,\n+   prd,\n+   enrichedPrdDocument\n+ )\n@@\n- const input = { context, prd, instruction }\n+ const input = { context, enrichedPrdDocument, codebaseIntelligence, prd, instruction }",
      before:
        "const input = {\n  context,\n  prd,\n  instruction: \"Produce an implementation plan mapped to every acceptance criterion.\",\n};",
      after:
        "const input = {\n  context,\n  enrichedPrdDocument,\n  codebaseIntelligence,\n  prd,\n  instruction: \"Produce an implementation plan mapped to every acceptance criterion.\",\n};",
    },
  ],
};

const MOCK_QA = {
  testSummary:
    "Mix of integration tests against the export orchestrator and worker, plus contract tests on the signed URL and hash header. Negative paths cover RBAC and workspace lifecycle.",
  testCases: [
    {
      id: "TC-001",
      title: "Admin requests export — job enqueued and email sent",
      type: "integration",
      linkedCriterion:
        "Given an admin with role workspace_admin, when they request an export for a date range up to 90 days, then a background job is enqueued and they receive a confirmation email within 60 seconds.",
      preconditions: ["Admin authenticated", "Notification service healthy"],
      steps: [
        "POST /exports with workspace_id and 90-day range",
        "Assert 202 response with jobId",
        "Wait 60s and assert email in capture inbox",
      ],
      expectedResult: "Job is enqueued and email arrives within 60s",
      priority: "critical",
    },
    {
      id: "TC-002",
      title: "Download response includes matching SHA-256 header",
      type: "integration",
      linkedCriterion:
        "Given a completed export, when the user downloads the bundle, then the response includes a SHA-256 hash header that matches the file body.",
      preconditions: ["Completed export exists"],
      steps: [
        "GET /exports/:id/download",
        "Compute SHA-256 of response body",
        "Compare to X-Content-SHA256 header",
      ],
      expectedResult: "Header matches body hash exactly",
      priority: "critical",
    },
    {
      id: "TC-003",
      title: "Workspace deletion mid-export cancels job",
      type: "integration",
      linkedCriterion:
        "Given an export job, when the workspace is suspended or deleted, then the job is cancelled and no download link is issued.",
      preconditions: ["Job in RUNNING state"],
      steps: [
        "Delete workspace via admin API",
        "Wait for next worker tick",
        "GET /exports/:id and assert status=CANCELLED",
      ],
      expectedResult: "Job is cancelled, no signed URL is generated",
      priority: "high",
    },
    {
      id: "TC-004",
      title: "Non-admin receives 403 with typed error code",
      type: "integration",
      linkedCriterion:
        "Given an export request from a non-admin, when the API is called, then a 403 is returned with code WS_EXPORT_FORBIDDEN.",
      preconditions: ["Member-role user authenticated"],
      steps: ["POST /exports as non-admin", "Assert 403 response", "Assert error.code === 'WS_EXPORT_FORBIDDEN'"],
      expectedResult: "403 with code WS_EXPORT_FORBIDDEN",
      priority: "high",
    },
  ],
  coverageReport: {
    totalCriteria: 4,
    coveredCriteria: 4,
    coveragePercent: 100,
    uncoveredCriteria: [],
  },
  riskAreas: [
    "Long-running exports exceeding worker visibility timeout",
    "Hash drift under partial S3 upload retries",
  ],
  automationRecommendations: ["TC-001", "TC-002", "TC-004"],
  confidenceScore: 0.88,
  confidenceReason: "All criteria covered, negative paths and critical concurrency cases included.",
};

const MOCK_AUDIT = [
  { event: "PIPELINE_STARTED", metadata: { jiraKey: "PLT-1271" }, timestamp: minutes(14) },
  { event: "TICKET_EMBEDDED", metadata: { jiraKey: "PLT-1271" }, timestamp: minutes(13.95) },
  { event: "CONTEXT_RETRIEVED", metadata: { chunksFound: 4, topSimilarity: 0.81 }, timestamp: minutes(13.9) },
  {
    event: "TICKET_ANALYSED",
    metadata: { requirementsFound: 3, ambiguities: 1, confidence: 0.78 },
    timestamp: minutes(13.85),
  },
  {
    event: "INTELLIGENCE_EXTRACTED",
    metadata: { patterns: 1, failures: 1, implied: 1 },
    timestamp: minutes(13.8),
  },
  {
    event: "GAPS_ANALYSED",
    metadata: { totalGaps: 6, blockingGaps: 1, readiness: "ready-with-assumptions" },
    timestamp: minutes(13.75),
  },
  {
    event: "COMPLEXITY_SCORED",
    metadata: { score: 6, realisticHours: 6, priority: "high" },
    timestamp: minutes(13.7),
  },
  {
    event: "PRD_GENERATED",
    metadata: { userStories: 1, endpoints: 1 },
    timestamp: minutes(13.65),
  },
  {
    event: "SCORES_COMPUTED",
    metadata: {
      understandingScore: 0.78,
      prdQualityScore: 0.62,
      historicalSignalScore: 0.74,
      complexityScore: 6,
    },
    timestamp: minutes(13.62),
  },
  {
    event: "DISCOVERY_COMPLETE",
    metadata: { durationMs: 45200, totalCost: 0.0327 },
    timestamp: minutes(13.6),
  },
  {
    event: "CODE_EDIT_APPLIED",
    metadata: {
      stage: "ENGINEERING_AGENT",
      filePath: "server/src/pipeline/orchestrator.ts",
      summary: "Engineering input now includes enriched PRD document and codebase intelligence snapshot.",
      diff: "@@\n- const input = { context, prd, instruction }\n+ const input = { context, enrichedPrdDocument, codebaseIntelligence, prd, instruction }",
    },
    timestamp: minutes(13.55),
  },
  { event: "STAGE_ADVANCED", metadata: { from: "PRODUCT_AGENT", to: "PRD_VALIDATION" }, timestamp: minutes(13.5) },
  {
    event: "AWAITING_HUMAN",
    metadata: { stage: "PRD_VALIDATION", reason: "PRD confidence 0.62 below 0.7 threshold — human clarification required." },
    timestamp: minutes(13.4),
  },
];

function fakeStage(stage, status, output, validationResult, costUsd, confidenceScore) {
  return {
    id: `sl_${stage}`,
    stage,
    status,
    input: {},
    output: output ?? null,
    validationResult: validationResult ?? null,
    confidenceScore: confidenceScore ?? null,
    tokenCount: output ? 3200 : null,
    costUsd: costUsd ?? null,
    startedAt: new Date(now - 1000 * 60 * 14).toISOString(),
    completedAt: status === "RUNNING" ? null : new Date(now - 1000 * 60 * 13.4).toISOString(),
    error: null,
  };
}

const MOCK_VALIDATIONS = {
  PRD_VALIDATION: {
    passed: false,
    score: 0.55,
    amberFlags: [
      "Open questions present but confidence is high. Verify reviewer expectation.",
    ],
    issues: [
      {
        code: "LOW_CONFIDENCE",
        severity: "error",
        message: "PRD confidence 0.62 below 0.7 threshold — human clarification required.",
      },
    ],
    checkedAt: minutes(13.4),
  },
};

function fullPipelineDetail(id) {
  const list = MOCK_PIPELINES.find((p) => p.id === id) ?? MOCK_PIPELINES[1];
  return {
    ...list,
    stages: [
      fakeStage("INGESTION", "COMPLETED", { indexed: true }),
      fakeStage(
        "PRODUCT_AGENT",
        "COMPLETED",
        MOCK_DISCOVERY_OUTPUT,
        null,
        0.0327,
        MOCK_PRD.confidenceScore
      ),
      fakeStage(
        "PRD_VALIDATION",
        list.status === "PAUSED" ? "AWAITING_HUMAN" : "COMPLETED",
        MOCK_VALIDATIONS.PRD_VALIDATION,
        MOCK_VALIDATIONS.PRD_VALIDATION
      ),
      fakeStage(
        "ENGINEERING_AGENT",
        list.status === "PAUSED" ? "PENDING" : "COMPLETED",
        list.status === "PAUSED" ? null : MOCK_IMPLEMENTATION,
        null,
        list.status === "PAUSED" ? null : 0.0541,
        list.status === "PAUSED" ? null : MOCK_IMPLEMENTATION.confidenceScore
      ),
      fakeStage(
        "IMPLEMENTATION_VALIDATION",
        list.status === "PAUSED" ? "PENDING" : "COMPLETED"
      ),
      fakeStage(
        "QA_AGENT",
        list.status === "PAUSED" ? "PENDING" : "COMPLETED",
        list.status === "PAUSED" ? null : MOCK_QA,
        null,
        list.status === "PAUSED" ? null : 0.0612,
        list.status === "PAUSED" ? null : MOCK_QA.confidenceScore
      ),
      fakeStage("QA_VALIDATION", list.status === "PAUSED" ? "PENDING" : "COMPLETED"),
      fakeStage("OUTPUT", list.status === "COMPLETED" ? "COMPLETED" : "PENDING"),
    ],
    overrides: [],
    auditLogs: MOCK_AUDIT,
  };
}

const MOCK_ENGINEERING_RUNS = {
  pl_01J6L1: {
    pipelineId: "pl_01J6L1",
    jiraKey: "PROD-1842",
    summary: "Multi-currency checkout",
    status: "COMPLETED",
    branch: "feature/prod-1842-multi-currency",
    prNumber: 847,
    prDraft: true,
    durationMinutes: 18,
    costUsd: 4.2,
    toolCallCount: 22,
    filesCreated: 4,
    filesModified: 2,
    testsGenerated: 47,
    criteriaMapped: 12,
    criteriaTotal: 12,
    implementationPlan: {
      technicalSummary:
        "A currency conversion layer was added to the checkout flow using the ECB exchange rate API. The service is stateless and exchange rates are cached in Redis with a 1-hour TTL.",
      criteria: [
        {
          id: "AC-1",
          text: "Given a user in Germany when they view checkout then prices display in EUR",
          implementation: "CurrencyService.convertPrice()",
          test: "currency.service.test.ts:L42",
        },
        {
          id: "AC-2",
          text: "Given EUR selected when exchange rate API is unavailable then USD is shown with a notification",
          implementation: "CurrencyService.fallbackToDefault()",
          test: "currency.service.test.ts:L89",
        },
      ],
      risks: [
        {
          level: "HIGH",
          text: "Exchange rate API has no SLA — fallback to cached rates; cold cache falls back to USD.",
        },
      ],
      filesCreated: [
        { path: "src/services/currency.service.ts", kind: "service" },
        { path: "src/utils/exchange-rate.helper.ts", kind: "util" },
        { path: "src/migrations/20260115_currency.ts", kind: "migration" },
        { path: "src/tests/currency.service.test.ts", kind: "test" },
      ],
      filesModified: [
        { path: "src/routes/checkout.routes.ts", kind: "route" },
        { path: "src/services/checkout.service.ts", kind: "service" },
      ],
    },
    files: [
      {
        path: "src/services/currency.service.ts",
        change: "created",
        kind: "service",
        humanModified: false,
        summary:
          "Core conversion service — reads Redis cache, calls ECB API, exposes convertPrice and fallback helpers.",
        content: `export class CurrencyService {\n  async convertPrice(amount: number, from: string, to: string) {\n    // ...\n  }\n  fallbackToDefault() {\n    // ...\n  }\n}`,
        criteriaIds: ["AC-1", "AC-2"],
      },
      {
        path: "src/utils/exchange-rate.helper.ts",
        change: "created",
        kind: "util",
        humanModified: false,
        summary: "HTTP client and cache helpers for ECB rates.",
        content: `export async function fetchEcbRates() {\n  // ...\n}`,
        criteriaIds: [],
      },
      {
        path: "src/routes/checkout.routes.ts",
        change: "modified",
        kind: "route",
        humanModified: true,
        summary: "Wires currency display into checkout GET handler.",
        content: `// modified checkout route\nrouter.get('/checkout', ...);`,
        criteriaIds: ["AC-1"],
        diff: "+ import { CurrencyService }\n+ await currency.convertPrice(...)",
      },
    ],
    toolCalls: [
      { id: 1, name: "explore_codebase_structure", durationSec: 0.8 },
      { id: 2, name: "search_historical_implementations", durationSec: 1.2 },
      { id: 3, name: "read_multiple_files (8)", durationSec: 2.1 },
      { id: 4, name: "read_file: schema.prisma", durationSec: 0.4 },
      { id: 5, name: "search_codebase: auth...", durationSec: 0.9 },
      { id: 6, name: "read_file: auth.middleware", durationSec: 0.3 },
      { id: 7, name: "create_implementation_plan", durationSec: 0.2 },
      { id: 8, name: "write_file: currency.service.ts", durationSec: 3.2 },
      { id: 9, name: "write_file: exchange-rate.helper.ts", durationSec: 1.8 },
      { id: 22, name: "create_pull_request", durationSec: 1.1 },
    ],
    pr: {
      title: "feat(checkout): multi-currency display with ECB rates",
      description: "Implements PROD-1842 — currency conversion at checkout with Redis cache and fallback.",
      labels: ["agent-generated", "checkout"],
      draft: true,
      url: "https://github.com/example/repo/pull/847",
      reviewers: [],
    },
    history: [
      {
        jiraKey: "PROD-1820",
        summary: "Checkout tax display",
        qaFindings: "Missing edge case for zero-decimal currencies",
        humanChanges: "Updated rounding in checkout.service.ts",
      },
    ],
    liveSteps: null,
  },
  pl_01J7A1: {
    pipelineId: "pl_01J7A1",
    jiraKey: "PROD-1871",
    summary: "Engineering Agent writing multi-currency service",
    status: "RUNNING",
    branch: "feature/prod-1871-currency",
    prNumber: null,
    prDraft: true,
    durationMinutes: 4,
    costUsd: 1.2,
    toolCallCount: 8,
    filesCreated: 1,
    filesModified: 0,
    testsGenerated: 0,
    criteriaMapped: 8,
    criteriaTotal: 12,
    implementationPlan: null,
    files: [],
    toolCalls: [],
    pr: null,
    history: [],
    liveSteps: [
      { id: "s1", label: "Exploring codebase structure…", status: "complete" },
      { id: "s2", label: "Searching historical implementations", status: "complete" },
      { id: "s3", label: "Reading relevant files…", status: "complete" },
      { id: "s4", label: "Creating implementation plan…", status: "complete" },
      {
        id: "s5",
        label: "Writing currency.service.ts…",
        status: "in_progress",
        detail: "Writing file — 847 tokens generated",
      },
      { id: "s6", label: "Writing exchange-rate.helper.ts…", status: "pending" },
      { id: "s7", label: "Writing tests…", status: "pending" },
      { id: "s8", label: "Running implementation check…", status: "pending" },
      { id: "s9", label: "Creating pull request…", status: "pending" },
    ],
  },
};

const MOCK_METRICS = {
  metrics: [
    { id: "in_pipeline", label: "In pipeline today", value: "3", delta: "+1 vs yesterday", deltaPositive: true },
    { id: "completed_week", label: "Completed this week", value: "12", delta: "+4 vs last week", deltaPositive: true },
    { id: "cycle_reduction", label: "Cycle time reduction", value: "38%", delta: "vs manual baseline", deltaPositive: true },
    { id: "cost_today", label: "Cost today", value: "$18.40", delta: "-9% vs avg", deltaPositive: true },
    { id: "interventions", label: "Human interventions", value: "2", delta: "1 PRD · 1 Eng", deltaPositive: false },
  ],
};

const MOCK_WEEKLY_TREND = {
  points: Array.from({ length: 14 }, (_, i) => ({
    label: i === 13 ? "Today" : `Day ${i + 1}`,
    featuresCompleted: 2 + Math.round(i * 0.35 + Math.sin(i / 2) * 1.2),
    humanInterventions: Math.max(0, 4 - Math.round(i * 0.22)),
  })),
  summary: {
    featuresCompleted: "47 features completed this month",
    avgCycleHours: "4.2",
    avgCostPerFeature: "4.20",
  },
};

const MOCK_AGENT_HEALTH = {
  agents: [
    {
      id: "virin",
      name: "Virin (-PM)",
      primaryMetric: "Avg confidence",
      primaryValue: "84%",
      secondaryMetric: "22 PRDs today",
      lastRunAt: minutes(4),
      status: "Healthy",
    },
    {
      id: "ananta",
      name: "Ananta (-Engg)",
      primaryMetric: "Avg criteria hit",
      primaryValue: "97%",
      secondaryMetric: "18 PRs created",
      lastRunAt: minutes(12),
      status: "Healthy",
    },
    {
      id: "neel",
      name: "Neel (-QA)",
      primaryMetric: "Pass rate",
      primaryValue: "83%",
      secondaryMetric: "47 tests run",
      lastRunAt: minutes(2),
      status: "Healthy",
    },
  ],
};

const MOCK_ACTIVITY = {
  events: [
    {
      id: "ev1",
      pipelineId: "pl_01J7H2",
      jiraKey: "PROD-1863",
      tone: "progress",
      live: true,
      message: "QA Agent running tests…",
      timestamp: minutes(2),
    },
    {
      id: "ev2",
      pipelineId: "pl_01J7A1",
      jiraKey: "PROD-1871",
      tone: "progress",
      live: true,
      message: "Engineering Agent writing code",
      timestamp: minutes(4),
    },
    {
      id: "ev3",
      pipelineId: "pl_01J6RUN2",
      jiraKey: "PROD-1844",
      tone: "complete",
      live: false,
      message: "PRD generation complete ✓",
      timestamp: minutes(8),
    },
    {
      id: "ev4",
      pipelineId: "pl_01J6RUN1",
      jiraKey: "PROD-1839",
      tone: "progress",
      live: false,
      message: "Pipeline started",
      timestamp: minutes(12),
    },
  ],
};

const MOCK_CYCLE_TREND = {
  points: Array.from({ length: 30 }, (_, i) => ({
    day: `Day ${30 - i}`,
    hours: 48 - i * 0.9 - Math.sin(i / 3) * 2,
  })),
};

const MOCK_QA_COVERAGE = {
  files: [
    { path: "server/src/pipeline/orchestrator.ts", coverage: 72, lines: 420, branches: 68 },
    { path: "server/src/agents/productAgent.ts", coverage: 88, lines: 180, branches: 82 },
    { path: "app/src/widgets/pipeline-explorer/PipelineCard.jsx", coverage: 45, lines: 96, branches: 40 },
    { path: "server/src/qa/testing/testRunner.ts", coverage: 91, lines: 210, branches: 85 },
  ],
};

const MOCK_QA_HEATMAP = {
  features: ["PLT-1287", "PLT-1271", "PLT-1264", "PLT-1252"],
  criteria: ["Auth boundary", "Happy path", "Error handling", "Performance"],
  cells: [
    ["pass", "pass", "warn", "na"],
    ["warn", "pass", "fail", "na"],
    ["pass", "pass", "pass", "pass"],
    ["fail", "warn", "fail", "na"],
  ],
};

const MOCK_QA_FAILURES = {
  columns: [
    { id: "critical", label: "Critical", items: [{ id: "f1", testName: "POST /exports returns 403 for member", criterion: "Non-admin receives 403", error: "Expected 403 got 200", remediation: "Add RBAC guard on route" }] },
    { id: "high", label: "High", items: [{ id: "f2", testName: "Export hash matches bundle", criterion: "SHA-256 integrity", error: "Hash mismatch", remediation: "Stream hash during upload" }] },
    { id: "medium", label: "Medium", items: [] },
    { id: "low", label: "Low", items: [{ id: "f3", testName: "Rate limit headers present", criterion: "Rate limit export", error: "Missing X-RateLimit-Remaining", remediation: "Apply existing limiter middleware" }] },
  ],
};

const MOCK_CANARY_RUNS = [
  {
    id: "canary_01J8A1",
    pipelineId: "pl_01J7H2",
    jiraKey: "PLT-1287",
    trigger: "pipeline",
    environment: "staging",
    scope: "changed_files",
    targetUrl: "http://localhost:4000",
    status: "COMPLETED",
    phase: "synthesis",
    summary: "One high-severity auth boundary issue confirmed on export API.",
    error: null,
    startedAt: minutes(8),
    completedAt: minutes(6),
    findingCount: 2,
    findings: [
      {
        id: "cf_01",
        hypothesisId: "H-002",
        severity: "high",
        category: "auth",
        title: "Member role can trigger admin export",
        description: "POST /api/exports returns 200 for workspace member token.",
        reproductionSteps: "1. Auth as member\n2. POST /api/exports\n3. Observe 200",
        affectedCode: "server/src/api/routes/exports.ts",
        suggestedFix: "Apply admin-only guard middleware",
        evidence: { status: 200 },
        createdAt: minutes(6),
      },
      {
        id: "cf_02",
        hypothesisId: "H-005",
        severity: "medium",
        category: "performance",
        title: "Export list p95 latency exceeds 2s",
        description: "GET /api/exports p95 measured at 2.4s under warm cache.",
        reproductionSteps: "Run measure_performance on GET /api/exports x10",
        affectedCode: null,
        suggestedFix: "Add pagination default limit",
        evidence: { p95Ms: 2400 },
        createdAt: minutes(6),
      },
    ],
  },
  {
    id: "canary_01J7Z9",
    pipelineId: null,
    jiraKey: null,
    trigger: "scheduled_light",
    environment: "staging",
    scope: "critical_paths",
    targetUrl: "http://localhost:4000",
    status: "COMPLETED",
    phase: "synthesis",
    summary: "Critical paths healthy — no confirmed findings.",
    error: null,
    startedAt: minutes(130),
    completedAt: minutes(128),
    findingCount: 0,
    findings: [],
  },
  {
    id: "canary_01J7Y2",
    pipelineId: null,
    jiraKey: null,
    trigger: "manual",
    environment: "production",
    scope: "full",
    targetUrl: "https://api.example.com",
    status: "FAILED",
    phase: "exploration",
    summary: null,
    error: "fetch failed: ECONNREFUSED",
    startedAt: minutes(300),
    completedAt: minutes(299),
    findingCount: 0,
    findings: [],
  },
];

const MOCK_CODEBASE_FILES = {
  "server/src/pipeline/orchestrator.ts": {
    filePath: "server/src/pipeline/orchestrator.ts",
    language: "typescript",
    size: 380,
    summary: "Coordinates multi-agent pipeline stages and validation gates.",
    exports: [{ name: "PipelineOrchestrator", type: "class" }],
    imports: [
      { from: "./stages", items: ["runProductStage", "runEngineeringStage"] },
      { from: "../agents/productAgent", items: ["ProductAgent"] },
    ],
    patterns: ["service-layer"],
    lastCommitSha: "abc123",
    lastCommitMsg: "Wire QA agentic loop",
    lastCommitAt: minutes(20),
    lastAuthor: "agent",
    indexedAt: minutes(45),
  },
  "server/src/codebaseIntelligence/indexer.ts": {
    filePath: "server/src/codebaseIntelligence/indexer.ts",
    language: "typescript",
    size: 410,
    summary: "Indexes repository files and writes embeddings to Supabase.",
    exports: [{ name: "indexRepository", type: "function" }],
    imports: [
      { from: "../db/client", items: ["prisma"] },
      { from: "./queryService", items: ["codebaseQueryService"] },
    ],
    patterns: ["service-layer", "database-query"],
    lastCommitSha: "def456",
    lastCommitMsg: "Add codebase intelligence snapshot",
    lastCommitAt: minutes(45),
    lastAuthor: "agent",
    indexedAt: minutes(40),
  },
  "server/src/codebaseIntelligence/layoutComputer.ts": {
    filePath: "server/src/codebaseIntelligence/layoutComputer.ts",
    language: "typescript",
    size: 320,
    summary: "Precomputed treemap layout for visualization API.",
    exports: [{ name: "computeVisualizationLayout", type: "function" }],
    imports: [{ from: "d3-hierarchy", items: ["hierarchy", "treemap"] }],
    patterns: ["utility"],
    lastCommitSha: "ghi789",
    lastCommitMsg: "Add voronoi district map",
    lastCommitAt: minutes(60),
    lastAuthor: "human",
    indexedAt: minutes(55),
  },
  "server/src/api/routes/codebase.ts": {
    filePath: "server/src/api/routes/codebase.ts",
    language: "typescript",
    size: 95,
    summary: "Codebase intelligence REST routes.",
    exports: [{ name: "default", type: "router" }],
    imports: [
      { from: "../../codebaseIntelligence/queryService", items: ["codebaseQueryService"] },
      { from: "../../codebaseIntelligence/directoryService", items: ["getDirectoryListing"] },
    ],
    patterns: ["api-route"],
    lastCommitSha: "jkl012",
    lastCommitMsg: "Add directory and file intelligence endpoints",
    lastCommitAt: minutes(5),
    lastAuthor: "human",
    indexedAt: minutes(3),
  },
  "app/src/features/codebase-viz/CodebaseVisualization.jsx": {
    filePath: "app/src/features/codebase-viz/CodebaseVisualization.jsx",
    language: "javascript",
    size: 280,
    summary: "Primary district map UI shell.",
    exports: [{ name: "default", type: "component" }],
    imports: [
      { from: "../../entities/codebase", items: ["useCodebaseVisualization"] },
      { from: "./TreemapCanvas", items: ["default"] },
    ],
    patterns: ["ui-component"],
    lastCommitSha: "mno345",
    lastCommitMsg: "Lazy-load visualization bundle",
    lastCommitAt: minutes(30),
    lastAuthor: "agent",
    indexedAt: minutes(28),
  },
  "app/src/entities/codebase/index.js": {
    filePath: "app/src/entities/codebase/index.js",
    language: "javascript",
    size: 120,
    summary: "Client adapters for codebase APIs.",
    exports: [{ name: "codebaseAdapter", type: "object" }],
    imports: [{ from: "../../shared/lib/fetchJson", items: ["fetchJson"] }],
    patterns: ["utility"],
    lastCommitSha: "pqr678",
    lastCommitMsg: "Add directory and file hooks",
    lastCommitAt: minutes(2),
    lastAuthor: "human",
    indexedAt: minutes(1),
  },
};

function buildMockDirectoryListing(dirPath = "") {
  const normalized = dirPath.trim().replace(/\/+$/, "");
  const prefix = normalized ? `${normalized}/` : "";
  const allPaths = Object.keys(MOCK_CODEBASE_FILES);

  const dirCounts = new Map();
  const dirNames = new Map();
  const files = [];

  for (const filePath of allPaths) {
    const relative = normalized ? filePath.slice(prefix.length) : filePath;
    if (!relative || (normalized && !filePath.startsWith(prefix))) continue;

    const slash = relative.indexOf("/");
    if (slash === -1) {
      const record = MOCK_CODEBASE_FILES[filePath];
      files.push({
        name: relative,
        path: filePath,
        language: record.language,
        size: record.size,
        hasSummary: Boolean(record.summary),
      });
    } else {
      const name = relative.slice(0, slash);
      const childPath = normalized ? `${normalized}/${name}` : name;
      dirNames.set(name, childPath);
      dirCounts.set(name, (dirCounts.get(name) ?? 0) + 1);
    }
  }

  const directories = [...dirNames.entries()]
    .map(([name, path]) => ({
      name,
      path,
      fileCount: dirCounts.get(name) ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  files.sort((a, b) => a.name.localeCompare(b.name));

  return { path: normalized, directories, files };
}

function buildMockFileConnections(filePath) {
  const record = MOCK_CODEBASE_FILES[filePath];
  const allPaths = new Set(Object.keys(MOCK_CODEBASE_FILES));

  const outgoing = [];
  if (record) {
    for (const imp of record.imports ?? []) {
      const base = filePath.split("/").slice(0, -1);
      const candidate = [...base, imp.from.replace(/^\.\//, "")].join("/");
      const resolved = allPaths.has(imp.from)
        ? imp.from
        : allPaths.has(candidate)
          ? candidate
          : null;
      if (resolved) outgoing.push({ path: resolved, items: imp.items });
    }
  }

  const incoming = [];
  for (const [otherPath, other] of Object.entries(MOCK_CODEBASE_FILES)) {
    if (otherPath === filePath) continue;
    for (const imp of other.imports ?? []) {
      const base = otherPath.split("/").slice(0, -1);
      const candidate = [...base, imp.from.replace(/^\.\//, "")].join("/");
      const resolved = allPaths.has(imp.from)
        ? imp.from
        : allPaths.has(candidate)
          ? candidate
          : null;
      if (resolved === filePath) incoming.push({ path: otherPath, items: imp.items });
    }
  }

  return { path: filePath, outgoing, incoming };
}

const MOCK_CODEBASE_STRUCTURE = {
  nodes: [
    { id: "server", label: "server/", size: 420, activity: "indexed", coverage: 72 },
    { id: "app", label: "app/", size: 280, activity: "recent-human", coverage: 58 },
    { id: "orchestrator", label: "pipeline/orchestrator.ts", size: 48, activity: "agent-modified", coverage: 72, parent: "server" },
    { id: "qaAgent", label: "qaAgent/index.ts", size: 32, activity: "recent-index", coverage: 91, parent: "server" },
  ],
};

const MOCK_CODEBASE_BRANCHES = {
  branches: [
    { name: "cursor/discovery-rag-tools", origin: "agent", jiraKey: "PLT-1271", prStatus: "open", agentCommits: 8, humanCommits: 2, humanAfterAgent: true },
    { name: "main", origin: "human", jiraKey: null, prStatus: null, agentCommits: 0, humanCommits: 24, humanAfterAgent: false },
  ],
};

const MOCK_GIT_API_BASE = "https://api.agentos.mock";

const MOCK_GIT_REPOS = [
  {
    id: 1,
    fullName: "acme-corp/agentos",
    owner: "acme-corp",
    name: "agentos",
    defaultBranch: "main",
    private: false,
  },
  {
    id: 2,
    fullName: "acme-corp/platform-api",
    owner: "acme-corp",
    name: "platform-api",
    defaultBranch: "main",
    private: true,
  },
];

let mockGitState = {
  connected: true,
  git: {
    provider: "github",
    workspace: "acme",
    repoSlug: "agentos",
    username: null,
    hasToken: true,
    tokenHint: "ghp_…",
    webhookSecret: "",
    defaultBranch: "main",
    configured: true,
    authMethod: "github_app",
    installationId: "mock-install-1",
    source: "database",
  },
};

function buildMockGitIntegrationSetup() {
  const webhookUrl = `${MOCK_GIT_API_BASE}/webhooks/github`;
  const git = { ...mockGitState.git };
  const connected = Boolean(mockGitState.connected);
  const needsRepoSelection = Boolean(
    git.authMethod === "github_app" &&
      git.installationId &&
      (!git.workspace || !git.repoSlug)
  );
  const installationDetected = Boolean(git.installationId);
  return {
    publicApiBase: MOCK_GIT_API_BASE,
    git,
    connected,
    needsRepoSelection,
    installationDetected,
    accountLogin: git.workspace || null,
    availableRepositories: needsRepoSelection ? MOCK_GIT_REPOS : [],
    databaseConfigured: true,
    githubApp: {
      configured: true,
      appSlug: "agentos-dev",
      permissions: [
        "Contents (read & write)",
        "Pull requests (read & write)",
        "Metadata (read)",
        "Webhooks (read & write)",
        "Actions (read)",
      ],
      events: ["push", "pull_request"],
      capabilities: [
        "Codebase index & visualization",
        "Semantic search & Ask",
        "Branch push & pull requests",
        "QA sandbox clone",
      ],
      installUrl: "https://github.com/apps/agentos-dev/installations/new",
      setupUrl: mockOrgPath("settings", "integrations", "github"),
      webhookUrl,
    },
    webhooks: {
      github: {
        url: webhookUrl,
        events: ["push", "pull_request"],
        secretEnv: "GITHUB_APP_WEBHOOK_SECRET",
        managedByApp: true,
      },
      bitbucket: {
        url: `${MOCK_GIT_API_BASE}/webhooks/bitbucket`,
        events: ["repo:push"],
        secretEnv: "BITBUCKET_WEBHOOK_SECRET",
      },
    },
    providers: [
      {
        id: "github",
        label: "GitHub",
        connectMode: "github_app",
        workspaceLabel: "Owner (org or user)",
        repoLabel: "Repository name",
        tokenLabel: "Personal access token (repo scope)",
        needsUsername: false,
      },
      {
        id: "bitbucket",
        label: "Bitbucket",
        connectMode: "pat",
        workspaceLabel: "Workspace slug",
        repoLabel: "Repository slug",
        tokenLabel: "App password (repository read)",
        needsUsername: true,
      },
    ],
  };
}

const MOCK_COSTS = {
  summary: {
    monthSpend: 142.67,
    avgPerFeature: 11.89,
    costPerToken: 0.000018,
  },
  daily: [
    { day: "Mon", product: 1.2, engineering: 2.1, qa: 0.9 },
    { day: "Tue", product: 0.8, engineering: 1.8, qa: 1.1 },
    { day: "Wed", product: 1.5, engineering: 2.4, qa: 0.7 },
    { day: "Thu", product: 1.1, engineering: 1.9, qa: 1.3 },
    { day: "Fri", product: 0.9, engineering: 2.2, qa: 1.0 },
  ],
  byFeature: [
    { jiraKey: "PLT-1287", title: "Usage billing controls", tokens: 84200, cost: 14.2, hoursSaved: 18, roi: 19.1 },
    { jiraKey: "PLT-1271", title: "Audit log export", tokens: 62100, cost: 10.8, hoursSaved: 14, roi: 15.6 },
    { jiraKey: "PLT-1264", title: "Slack gate notifications", tokens: 38400, cost: 6.1, hoursSaved: 9, roi: 22.3 },
  ],
};

export const mockApi = {
  wasUsed: () => used,
  async metricsSummary() {
    markUsed();
    await delay(80);
    return MOCK_METRICS;
  },
  async activityEvents() {
    markUsed();
    await delay(80);
    return MOCK_ACTIVITY;
  },
  async cycleTrend() {
    markUsed();
    await delay(80);
    return MOCK_CYCLE_TREND;
  },
  async weeklyTrend() {
    markUsed();
    await delay(80);
    return MOCK_WEEKLY_TREND;
  },
  async agentHealth() {
    markUsed();
    await delay(80);
    return MOCK_AGENT_HEALTH;
  },
  async dashboardStatus(counts = {}) {
    markUsed();
    await delay(60);
    const running = counts.running ?? 4;
    const review = counts.review ?? 2;
    const completedToday = counts.completedToday ?? 12;
    return {
      metrics: [
        {
          id: "running",
          label: "Running",
          value: String(running),
          tone: "running",
          href: `${mockOrgPath("pipelines")}?tab=active`,
        },
        {
          id: "review",
          label: "Need review",
          value: String(review),
          tone: "review",
          href: `${mockOrgPath("pipelines")}?tab=review`,
        },
        {
          id: "completed",
          label: "Completed",
          value: String(completedToday),
          tone: "success",
          href: `${mockOrgPath("pipelines")}?tab=history`,
        },
        {
          id: "cost",
          label: "Cost today",
          value: "$18.40",
          tone: "neutral",
          href: mockOrgPath("costs"),
        },
        {
          id: "pass_rate",
          label: "Pass rate",
          value: "94%",
          tone: "success",
          href: mockOrgPath("qa"),
        },
      ],
    };
  },
  async qaCoverage() {
    markUsed();
    await delay(100);
    return MOCK_QA_COVERAGE;
  },
  async qaHeatmap() {
    markUsed();
    await delay(100);
    return MOCK_QA_HEATMAP;
  },
  async qaFailures() {
    markUsed();
    await delay(100);
    return MOCK_QA_FAILURES;
  },
  async qaReports() {
    markUsed();
    await delay(100);
    const now = Date.now();
    return {
      reports: [
        {
          ticketId: "PLT-1287",
          passRate: 94,
          recommendation: "approve_with_conditions",
          completedAt: new Date(now - 3600_000).toISOString(),
        },
        {
          ticketId: "PLT-1271",
          passRate: 72,
          recommendation: "request_changes",
          completedAt: new Date(now - 7200_000).toISOString(),
        },
      ],
    };
  },
  async qaReport(ticketId) {
    markUsed();
    await delay(120);
    return {
      ticketId,
      passRate: ticketId === "PLT-1271" ? 72 : 94,
      recommendation: ticketId === "PLT-1271" ? "request_changes" : "approve_with_conditions",
      summary: MOCK_QA.testSummary,
      coverage: MOCK_QA.coverageReport,
      failures: MOCK_QA_FAILURES.columns.flatMap((c) => c.items),
    };
  },
  async canaryRuns() {
    markUsed();
    await delay(100);
    return { items: MOCK_CANARY_RUNS };
  },
  async canaryRun(id) {
    markUsed();
    await delay(80);
    const run = MOCK_CANARY_RUNS.find((r) => r.id === id);
    if (!run) throw new Error("not_found");
    return run;
  },
  async canaryTrigger() {
    markUsed();
    await delay(120);
    return { status: "started", runId: "canary_mock_new" };
  },
  async canaryNightlySummary() {
    markUsed();
    await delay(80);
    return {
      runCount: 4,
      findingCount: 2,
      critical: 0,
      high: 1,
    };
  },
  async codebaseStructure() {
    markUsed();
    await delay(100);
    return MOCK_CODEBASE_STRUCTURE;
  },
  async codebaseBranches() {
    markUsed();
    await delay(100);
    return MOCK_CODEBASE_BRANCHES;
  },
  async codebaseCommits() {
    markUsed();
    await delay(100);
    return {
      commits: [
        { id: "c1", author: "agent", message: "Wire QA agentic loop", files: 12, at: minutes(20) },
        { id: "c2", author: "human", message: "Fix test runner paths on Windows", files: 2, at: minutes(18) },
        { id: "c3", author: "agent", message: "Add codebase intelligence snapshot", files: 8, at: minutes(45) },
      ],
    };
  },
  async codebaseSearch(query, branch = "main") {
    markUsed();
    await delay(140);
    const q = query.toLowerCase();
    const files = [
      { path: "server/src/pipeline/orchestrator.ts", score: 0.89, snippet: "runQaAgentic pipeline stage" },
      { path: "server/src/qaAgent/index.ts", score: 0.84, snippet: "four-phase QA workflow" },
      { path: "server/src/codebaseIntelligence/layoutComputer.ts", score: 0.81, snippet: "treemap layout for visualization" },
      { path: "app/src/features/codebase-viz/TreemapCanvas.jsx", score: 0.78, snippet: "canvas rendering for district map" },
    ].filter(
      (f) =>
        !q ||
        f.path.toLowerCase().includes(q) ||
        f.snippet.toLowerCase().includes(q) ||
        q.length < 3
    );

    const patterns = [];
    if (/\bauth\b|\bjwt\b|authentication/.test(q)) {
      patterns.push({
        pattern: "auth",
        files: [
          { path: "server/src/api/routes/auth.ts", summary: "Auth API routes" },
          { path: "app/src/shared/providers/AuthProvider.jsx", summary: "Frontend auth context" },
        ],
      });
    }
    if (/\bapi\b|\broute\b|endpoint/.test(q)) {
      patterns.push({
        pattern: "api-route",
        files: [
          { path: "server/src/api/routes/codebase.ts", summary: "Codebase intelligence REST routes" },
          { path: "server/src/api/routes/pipeline.ts", summary: "Pipeline REST routes" },
        ],
      });
    }
    if (/\bdatabase\b|\bquery\b|prisma/.test(q)) {
      patterns.push({
        pattern: "database-query",
        files: [
          { path: "server/src/codebaseIntelligence/indexer.ts", summary: "Indexes files and writes embeddings" },
        ],
      });
    }

    return { query, branch, files, patterns, results: files };
  },
  async codebaseVisualization(branch = "main") {
    markUsed();
    await delay(160);
    return buildMockVisualization(branch);
  },
  async codebaseFileInterior(_branch, filePath) {
    markUsed();
    await delay(100);
    return {
      filePath,
      summary: "Mock file interior — function blocks inside this module.",
      blocks: [
        { id: "fn1", name: "render", kind: "function", x: 8, y: 8, w: 940, h: 80, lineCount: 40 },
        { id: "fn2", name: "hitTest", kind: "function", x: 8, y: 96, w: 940, h: 60, lineCount: 28 },
        { id: "fn3", name: "paint", kind: "function", x: 8, y: 168, w: 940, h: 120, lineCount: 55 },
      ],
    };
  },
  async codebaseDirectory(dirPath = "", branch = "main") {
    markUsed();
    await delay(80);
    const listing = buildMockDirectoryListing(dirPath);
    return { ...listing, branch };
  },
  async codebaseFileIntelligence(filePath) {
    markUsed();
    await delay(90);
    const file = MOCK_CODEBASE_FILES[filePath] ?? null;
    return { file };
  },
  async codebaseFileConnections(filePath, branch = "main") {
    markUsed();
    await delay(70);
    const connections = buildMockFileConnections(filePath);
    return { ...connections, branch };
  },
  async codebaseTour(branch = "main") {
    markUsed();
    await delay(120);
    return buildMockTour(branch);
  },
  async generateCodebaseTour(branch = "main") {
    markUsed();
    await delay(400);
    return buildMockTour(branch, "openai");
  },
  async codebaseHealth(branch = "main") {
    markUsed();
    await delay(90);
    return {
      branchName: branch,
      totals: {
        files: 142,
        avgCoverage: 62.4,
        zeroCoveragePct: 18.3,
        avgComplexity: 5.8,
        highComplexityCount: 11,
        modifiedLast7Days: { total: 24, agent: 9, human: 15 },
        technicalDebtScore: 34,
      },
      coverageHistogram: [
        { bucket: "0-10%", count: 8 },
        { bucket: "10-20%", count: 6 },
        { bucket: "40-50%", count: 22 },
        { bucket: "50-60%", count: 38 },
        { bucket: "60-70%", count: 28 },
        { bucket: "90-100%", count: 18 },
      ],
      complexityHotspots: [
        { path: "server/src/pipeline/orchestrator.ts", complexity: 9, coverage: 72 },
        { path: "server/src/codebaseIntelligence/indexer.ts", complexity: 8, coverage: 58 },
      ],
    };
  },
  async codebaseHealthTimeline(branch = "main", days = 30) {
    markUsed();
    await delay(80);
    void branch;
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      const agent = i % 5 === 0 ? 4 : i % 3 === 0 ? 2 : 0;
      const human = i % 2 === 0 ? 6 : 3;
      out.push({ date: d, totalFiles: agent + human, agentFiles: agent, humanFiles: human });
    }
    return { days: out };
  },
  async codebaseKnowledge(branch = "main") {
    markUsed();
    await delay(100);
    return buildMockKnowledge(branch);
  },
  async generateCodebaseKnowledge(branch = "main") {
    markUsed();
    await delay(450);
    return buildMockKnowledge(branch, "openai");
  },
  async codebaseImpact({ filePaths = [], changeDescription = "", branchName = "main" }) {
    markUsed();
    await delay(220);
    const targets = filePaths.length ? filePaths : ["server/src/payment/service.ts"];
    return {
      branchName,
      changeDescription: changeDescription || "Mock change",
      targets,
      directImpact: [
        { path: "server/src/api/routes/payment.ts", via: targets[0], probability: "certain" },
        { path: "server/src/pipeline/orchestrator.ts", via: targets[0], probability: "certain" },
      ],
      indirectImpact: [
        { path: "app/src/entities/payment/index.js", via: "server/src/api/routes/payment.ts", probability: "likely" },
      ],
      testImpact: [
        { path: "server/src/payment/service.test.ts", reason: "Test file likely covers the changed module" },
      ],
      risk: {
        level: "medium",
        reasoning: "Two direct API dependents and one indirect client adapter may need updates.",
      },
      mapHighlights: {
        changed: targets,
        direct: ["server/src/api/routes/payment.ts", "server/src/pipeline/orchestrator.ts"],
        indirect: ["app/src/entities/payment/index.js"],
        tests: ["server/src/payment/service.test.ts"],
      },
    };
  },
  async codebaseInsights(branch = "main") {
    markUsed();
    await delay(60);
    return {
      repo: { owner: "acme", name: "agentos", branch },
      totals: { files: 142, withSummary: 128 },
      languages: [
        { language: "typescript", count: 86 },
        { language: "javascript", count: 34 },
        { language: "sql", count: 12 },
      ],
      patterns: [
        { pattern: "api-route", count: 18 },
        { pattern: "database-query", count: 14 },
        { pattern: "auth", count: 9 },
      ],
      topDirectories: [
        { path: "server", fileCount: 72 },
        { path: "app", fileCount: 48 },
        { path: "prisma", fileCount: 8 },
      ],
      highlights: [
        {
          path: "server/src/pipeline/orchestrator.ts",
          language: "typescript",
          summary: "Coordinates multi-agent pipeline stages and validation gates.",
          patterns: ["api-route"],
          size: 420,
        },
        {
          path: "server/src/codebaseIntelligence/indexer.ts",
          language: "typescript",
          summary: "Indexes repository files and writes embeddings to Supabase.",
          patterns: ["database-query"],
          size: 380,
        },
      ],
    };
  },
  async codebaseLayerStatus() {
    markUsed();
    await delay(80);
    return {
      connected: true,
      repo: {
        owner: "acme",
        name: "agentos",
        fullName: "acme/agentos",
        defaultBranch: "main",
      },
      ready: true,
      index: {
        status: "completed",
        runId: "mock-run-1",
        filesTotal: 142,
        filesProcessed: 142,
        filesIndexed: 128,
        percent: 100,
        lastCompletedAt: new Date(Date.now() - 3600_000).toISOString(),
        lastIndexedAt: new Date(Date.now() - 1800_000).toISOString(),
        error: null,
      },
      counts: { filesIndexed: 142, embeddings: 890 },
      graph: { ready: true, computedAt: new Date(Date.now() - 900_000).toISOString(), nodeCount: 142 },
      configuration: {
        openaiConfigured: true,
        llmProvider: "openai",
        fileIntelligenceAvailable: true,
      },
      blockers: [],
    };
  },
  async triggerFullCodebaseIndex(branch = "main") {
    markUsed();
    await delay(120);
    return {
      ok: true,
      branchName: branch,
      repo: "acme/agentos",
      runId: "mock-run-reindex",
      queued: false,
      message: "Full index started in-process (mock mode).",
    };
  },
  async codebaseAsk(question, branch = "main") {
    markUsed();
    await delay(200);
    const q = question.toLowerCase();
    let highlightPaths = [
      "server/src/pipeline/orchestrator.ts",
      "server/src/qaAgent/index.ts",
    ];
    let answer =
      "The pipeline orchestrator coordinates stage transitions; QA runs in a four-phase agentic loop. See [server/src/pipeline/orchestrator.ts] and [server/src/qaAgent/index.ts].";

    if (q.includes("auth")) {
      highlightPaths = [
        "server/src/api/routes/auth.ts",
        "app/src/shared/providers/AuthProvider.jsx",
      ];
      answer =
        "Authentication spans [server/src/api/routes/auth.ts] and the frontend [app/src/shared/providers/AuthProvider.jsx].";
    }

    return {
      answer,
      highlightPaths,
      branch,
      relatedSnippets: highlightPaths.map((path, i) => ({
        path,
        snippet: `Mock snippet for ${path}`,
        score: 0.9 - i * 0.05,
      })),
    };
  },
  async costsSummary() {
    markUsed();
    await delay(80);
    return MOCK_COSTS.summary;
  },
  async costsDaily() {
    markUsed();
    await delay(80);
    return { days: MOCK_COSTS.daily };
  },
  async costsByFeature({ hourlyRate = 150 } = {}) {
    markUsed();
    await delay(80);
    const features = MOCK_COSTS.byFeature.map((row) => {
      const laborValue = row.hoursSaved * hourlyRate;
      return {
        ...row,
        roi: Math.round((laborValue / Math.max(row.cost, 0.01)) * 10) / 10,
      };
    });
    return { features };
  },
  async costsRoi(params = {}) {
    markUsed();
    await delay(100);
    const roi = computeEstimatedRoi({
      planId: params.planId ?? "growth",
      teamSize: params.teamSize ?? 10,
      hourlyRate: params.hourlyRate ?? 150,
      pipelineRunsPerMonth: params.pipelineRunsPerMonth ?? 80,
      sprintWeeks: params.sprintWeeks ?? 2,
      reworkRate: params.reworkRate ?? 0.25,
    });
    return {
      roi,
      annualSavings: roi.annualLaborSavings,
      netBenefit: roi.netAnnualBenefit,
      subscriptionCost: roi.assumptions.monthlyPrice,
      hourlyRate: roi.hourlyRate,
      sprintWeeks: roi.sprintWeeks,
      reworkRate: roi.reworkRate,
    };
  },
  async listPipelines(status) {
    markUsed();
    await delay(120);
    const items = status
      ? MOCK_PIPELINES.filter((p) => p.status === status)
      : MOCK_PIPELINES;
    return { items };
  },
  async getPipeline(id) {
    markUsed();
    await delay(160);
    return fullPipelineDetail(id);
  },
  async listEngineeringRuns() {
    markUsed();
    await delay(100);
    return {
      items: Object.values(MOCK_ENGINEERING_RUNS).map((r) => ({
        pipelineId: r.pipelineId,
        jiraKey: r.jiraKey,
        summary: r.summary,
        status: r.status,
        costUsd: r.costUsd,
        durationMinutes: r.durationMinutes,
      })),
    };
  },
  async getEngineeringRun(pipelineId) {
    markUsed();
    await delay(120);
    const run = MOCK_ENGINEERING_RUNS[pipelineId];
    if (!run) return null;
    return run;
  },
  async getAudit() {
    markUsed();
    await delay(100);
    return { items: MOCK_AUDIT };
  },
  async globalSearch(query, branch = "main") {
    markUsed();
    await delay(160);
    const q = String(query ?? "").trim().toLowerCase();
    if (!q) {
      return { query: "", tickets: [], codebase: { files: [], patterns: [], results: [] }, audit: [] };
    }

    const tickets = MOCK_PIPELINES.filter((pipeline) => {
      const key = pipeline.ticket?.jiraKey?.toLowerCase() ?? "";
      const summary = pipeline.ticket?.normalizedData?.summary?.toLowerCase() ?? "";
      return key.includes(q) || summary.includes(q);
    })
      .slice(0, 8)
      .map((pipeline) => ({
        id: pipeline.id,
        jiraKey: pipeline.ticket?.jiraKey ?? pipeline.id,
        summary: pipeline.ticket?.normalizedData?.summary ?? "Untitled ticket",
        status: pipeline.status,
        currentStage: pipeline.currentStage,
      }));

    const audit = MOCK_AUDIT.filter((entry) => {
      const event = entry.event?.toLowerCase() ?? "";
      const meta = JSON.stringify(entry.metadata ?? {}).toLowerCase();
      return event.includes(q) || meta.includes(q);
    })
      .slice(0, 8)
      .map((entry, index) => ({
        id: `audit-${index}`,
        event: entry.event,
        timestamp: entry.timestamp,
        pipelineId: MOCK_PIPELINES[0]?.id ?? "pl_01J7H2",
        jiraKey: entry.metadata?.jiraKey ?? MOCK_PIPELINES[0]?.ticket?.jiraKey ?? "PROD-1863",
        summary: MOCK_PIPELINES[0]?.ticket?.normalizedData?.summary ?? "Pipeline activity",
        metadata: entry.metadata ?? {},
      }));

    const codebase = await mockApi.codebaseSearch(query, branch);

    return {
      query,
      tickets,
      codebase: {
        files: codebase.files ?? [],
        patterns: codebase.patterns ?? [],
        results: codebase.results ?? codebase.files ?? [],
      },
      audit,
    };
  },
  async runPipeline(ticketId) {
    markUsed();
    await delay(140);
    return { ticketId, started: true };
  },
  async submitOverride(pipelineId, payload) {
    markUsed();
    await delay(180);
    return { ok: true, pipelineId, payload };
  },
  async readiness() {
    markUsed();
    await delay(60);
    return { status: "ready", checks: { postgres: "ok" } };
  },
  async gitIntegrationSetup() {
    markUsed();
    await delay(80);
    return buildMockGitIntegrationSetup();
  },
  async connectGitIntegration(body) {
    markUsed();
    await delay(120);
    const provider = body?.provider ?? "github";
    const workspace = String(body?.workspace ?? "").trim();
    const repoSlug = String(body?.repoSlug ?? "").trim();
    mockGitState = {
      connected: true,
      git: {
        provider,
        workspace,
        repoSlug,
        username: body?.username ?? null,
        hasToken: Boolean(body?.token),
        tokenHint: body?.token ? `${String(body.token).slice(0, 4)}…` : null,
        webhookSecret: body?.webhookSecret ?? "",
        defaultBranch: body?.defaultBranch ?? "main",
        configured: true,
        authMethod: "pat",
        installationId: null,
        source: "database",
      },
    };
    return {
      connected: true,
      fullName: `${workspace}/${repoSlug}`,
      defaultBranch: mockGitState.git.defaultBranch,
      git: { ...mockGitState.git },
    };
  },
  async completeGithubInstall(installationId) {
    markUsed();
    await delay(140);
    mockGitState = {
      connected: false,
      git: {
        ...mockGitState.git,
        installationId: String(installationId),
        authMethod: "github_app",
        workspace: "acme-corp",
        repoSlug: "",
        configured: false,
        hasToken: false,
        source: "database",
      },
    };
    return {
      installationId: String(installationId),
      accountLogin: "acme-corp",
      repositories: MOCK_GIT_REPOS,
      availableRepositories: MOCK_GIT_REPOS,
      connected: false,
      needsRepoSelection: true,
      installationDetected: true,
    };
  },
  async selectGithubRepository(body) {
    markUsed();
    await delay(120);
    const owner = String(body?.owner ?? "").trim();
    const repo = String(body?.repo ?? "").trim();
    const installationId = String(body?.installationId ?? mockGitState.git.installationId ?? "");
    mockGitState = {
      connected: true,
      git: {
        ...mockGitState.git,
        provider: "github",
        workspace: owner,
        repoSlug: repo,
        configured: true,
        authMethod: "github_app",
        installationId,
        hasToken: true,
        source: "database",
      },
    };
    return {
      connected: true,
      fullName: `${owner}/${repo}`,
      defaultBranch: body?.defaultBranch ?? "main",
      git: { ...mockGitState.git },
    };
  },
  async disconnectGitIntegration() {
    markUsed();
    await delay(100);
    mockGitState = {
      connected: false,
      git: {
        provider: null,
        workspace: "",
        repoSlug: "",
        username: null,
        hasToken: false,
        tokenHint: null,
        webhookSecret: "",
        defaultBranch: "main",
        configured: false,
        authMethod: null,
        installationId: null,
        source: "none",
      },
    };
    return {
      ok: true,
      disconnected: true,
      postgresInstallationsRemoved: 1,
      message: "Git integration disconnected (mock).",
    };
  },
  async getJiraSyncStatus() {
    markUsed();
    await delay(80);
    return {
      connected: true,
      running: false,
      stats: { total: 42, embedded: 38, deleted: 0, byStatus: { Done: 12, "In Progress": 8, "To Do": 22 } },
      latestRun: {
        mode: "FULL",
        status: "COMPLETED",
        startedAt: minutes(30),
        completedAt: minutes(28),
        issuesSynced: 42,
        issuesSkipped: 0,
        errors: 0,
      },
    };
  },
  async listJiraSyncIssues(params = {}) {
    markUsed();
    await delay(100);
    let items = MOCK_JIRA_SYNC_ISSUES;
    if (params.q) {
      const q = params.q.toLowerCase();
      items = items.filter(
        (i) =>
          i.jiraKey.toLowerCase().includes(q) ||
          i.summary.toLowerCase().includes(q)
      );
    }
    if (params.status) {
      items = items.filter(
        (i) => i.status.toLowerCase() === params.status.toLowerCase()
      );
    }
    const limit = params.limit ?? 50;
    return { items: items.slice(0, limit), total: items.length, limit, offset: 0 };
  },
  async getJiraSyncIssue(jiraKey) {
    markUsed();
    await delay(80);
    const key = String(jiraKey).toUpperCase();
    return (
      MOCK_JIRA_SYNC_ISSUES.find((i) => i.jiraKey === key) ??
      MOCK_JIRA_SYNC_ISSUES[0]
    );
  },
  async runJiraSync(body = {}) {
    markUsed();
    await delay(200);
    return {
      status: "STARTED",
      mode: body.mode ?? "full",
      message: `Jira ${body.mode ?? "full"} sync started (mock)`,
    };
  },
  async listPmAnalyses() {
    markUsed();
    await delay(120);
    return { items: MOCK_PM_ANALYSES_LIST };
  },
  async getPmAnalysis(ticketId) {
    markUsed();
    await delay(120);
    const key = String(ticketId).toUpperCase();
    return MOCK_PM_ANALYSES[key] ?? MOCK_PM_ANALYSIS_FULL;
  },
  async analyzePmTicket(ticketId) {
    markUsed();
    await delay(200);
    const key = String(ticketId).toUpperCase();
    MOCK_PM_ANALYSES[key] = { ...MOCK_PM_ANALYSIS_FULL, jiraKey: key, status: "RUNNING", currentStage: "ENRICHMENT" };
    setTimeout(() => {
      MOCK_PM_ANALYSES[key] = { ...MOCK_PM_ANALYSIS_FULL, jiraKey: key, status: "COMPLETED", currentStage: null, completedAt: minutes(0) };
    }, 4000);
    return { jiraKey: key, status: "RUNNING", message: "PM analysis pipeline started (mock)" };
  },
  async resumePmTicket(ticketId) {
    markUsed();
    await delay(200);
    const key = String(ticketId).toUpperCase();
    const existing = MOCK_PM_ANALYSES[key] ?? MOCK_PM_ANALYSIS_FULL;
    MOCK_PM_ANALYSES[key] = {
      ...existing,
      jiraKey: key,
      status: "RUNNING",
      currentStage: "ACCEPTANCE_CRITERIA",
      error: undefined,
    };
    setTimeout(() => {
      MOCK_PM_ANALYSES[key] = {
        ...MOCK_PM_ANALYSIS_FULL,
        jiraKey: key,
        status: "COMPLETED",
        currentStage: null,
        completedAt: minutes(0),
      };
    }, 3000);
    return {
      jiraKey: key,
      status: "RUNNING",
      resumeFrom: "ACCEPTANCE_CRITERIA",
      message: "PM analysis resumed (mock)",
    };
  },
  async startPmPipeline(ticketId) {
    markUsed();
    await delay(180);
    const key = String(ticketId).toUpperCase();
    return {
      jiraKey: key,
      pipelineId: "pl_01J7A1",
      status: "started",
      message: "Coding pipeline enqueued from PM handoff (mock)",
      intake: { enqueued: 1, skipped: 0, sourceKey: key },
      queue: { activeJiraKey: null, queuedJiraKeys: [key] },
    };
  },
  async runPmRetrospective(ticketId) {
    markUsed();
    await delay(300);
    const key = String(ticketId).toUpperCase();
    const base = MOCK_PM_ANALYSES[key] ?? MOCK_PM_ANALYSIS_FULL;
    base.retrospective = MOCK_PM_RETROSPECTIVE;
    MOCK_PM_ANALYSES[key] = base;
    return { jiraKey: key, retrospective: MOCK_PM_RETROSPECTIVE, costUsd: 0.12 };
  },
  async getPmHandoff(ticketId) {
    markUsed();
    await delay(180);
    return buildMockPmHandoff(ticketId);
  },
  async runPmHandoff(ticketId) {
    markUsed();
    await delay(220);
    const payload = buildMockPmHandoff(ticketId);
    return {
      ...payload,
      status: "ready",
      message:
        "Handoff prompt assembled. Copy the prompt or wire Cursor SDK to start implementation.",
    };
  },
};

const MOCK_PM_RETROSPECTIVE = {
  classificationAccuracy: "correct",
  classificationNote: "Bug classification matched post-implementation review.",
  severityAccuracy: "correct",
  severityNote: "High severity was appropriate given enterprise reporter tier.",
  priorityAccuracy: "accepted",
  priorityOverrideAnalysis: "PM accepted NOW recommendation without override.",
  effortAccuracy: "accurate",
  effortVariance: "0 — actual 5 points matched estimate.",
  fileDetectionAccuracy: "80% — primary handler identified; one config file missed.",
  acQuality: "4/5 — happy path complete; one edge case added during implementation.",
  rootCauseOfErrors: ["Config file not in semantic search top-k results."],
  learningSignals: ["Boost config pattern tags in codebase index for billing tickets."],
  patternFlag: "none",
};

const MOCK_PM_ANALYSIS_FULL = {
  id: "pm_mock_01",
  jiraKey: "PLT-1287",
  status: "COMPLETED",
  currentStage: null,
  ticketInput: {
    jiraKey: "PLT-1287",
    summary: "Add usage-based billing controls",
    description: "Enterprise admins need per-workspace spend limits and alerts.",
    issueType: "Story",
    reporter: "Alex Chen",
    labels: ["enterprise", "billing"],
    components: ["Billing"],
    createdDate: minutes(48),
    priority: "High",
  },
  context: { reporterTier: "enterprise" },
  enrichment: {
    cleanSummary: "Enterprise admins need workspace-level billing limits and proactive spend alerts.",
    realUserProblem: "Finance teams cannot prevent runaway usage charges across workspaces.",
    missingContext: ["Exact alert channel preferences", "Whether limits are hard or soft"],
    relatedTicketsSummary: "Two similar billing tickets open in the last quarter.",
    reporterContext: "Enterprise customer success escalation — high urgency implied.",
    okrAlignment: "Directly supports enterprise churn reduction OKR.",
    redFlags: ["Revenue impact if limits fail silently"],
  },
  classification: {
    type: "feature",
    subtype: "new capability",
    severity: "high",
    severityReasoning: "Affects enterprise billing workflows with revenue exposure.",
    affectedUserSegment: "Enterprise plan admins",
    estimatedUsersAffected: "50-80 enterprise workspaces",
    revenueRisk: "high",
    strategicAlignment: 8,
    strategicAlignmentReason: "Maps to billing reliability OKR.",
    isDuplicate: false,
    duplicateOf: null,
    classificationConfidence: 82,
    requiresHumanEscalation: false,
    escalationReason: null,
  },
  codebaseImpact: {
    affectedFiles: [
      { path: "server/src/billing/limits.ts", reason: "Core limit enforcement", role: "primary", confidence: 88, riskLevel: "high" },
      { path: "app/src/widgets/billing/BillingPanel.jsx", reason: "Admin UI for limits", role: "primary", confidence: 75, riskLevel: "medium" },
    ],
    recentChangeConnection: "Commit abc1234 adjusted metering hooks last week — possible related surface.",
    dependencyWarnings: ["server/src/billing/metering.ts may need coordinated changes"],
    scopeAssessment: "Touches billing service and admin UI — moderate blast radius across two modules.",
    suggestedFirstFile: "server/src/billing/limits.ts — defines current limit model.",
  },
  effortEstimate: {
    tshirt: "M",
    storyPoints: "5",
    confidenceInEstimate: 72,
    breakdown: { discovery: "30m", engineering: "3h", qa: "45m", review: "15m" },
    riskFactors: ["Low test coverage on billing limits module"],
    assumptions: ["Alerting channel API already exists"],
    recommendedApproach: "Add limit model first, then wire UI and webhook alerts.",
    estimateConfidenceNote: "Need confirmation on hard vs soft limit behavior.",
  },
  implementation: {
    approachSummary: "Extend billing limits service with workspace-scoped caps and surface controls in admin UI.",
    implementationSteps: [
      { step: "1", action: "Add WorkspaceLimit model in server/src/billing/limits.ts", why: "Persistence layer for caps", watchOut: "Migration required" },
      { step: "2", action: "Expose REST endpoints in billing routes", why: "Admin UI needs API", watchOut: "Auth scope for enterprise admins only" },
    ],
    whereNotToTouch: ["server/src/billing/invoicing.ts — out of scope"],
    testingGuidance: "Test limit enforcement at threshold and alert firing.",
    alternativeApproach: "Feature flag per workspace — slower rollout but lower risk.",
    openQuestionsForEngineer: ["Hard stop vs notify-only when limit reached?"],
  },
  prioritization: {
    recommendation: "NOW",
    recommendationReasoning: "High revenue risk, enterprise reporter, aligns with active OKR, manageable M effort.",
    impactScore: "78 (severity 30 + revenue 25 + users 15 + alignment 8)",
    costOfInaction: "Continued overage disputes and churn risk within 30 days.",
    tradeoff: "Delays self-serve admin controls sprint item.",
    conditionsToRevisit: "If fewer than 3 enterprise accounts affected, downgrade to NEXT.",
    suggestedOwner: "Billing platform team",
    suggestedSprint: "Current sprint",
    escalateToHuman: false,
    escalationReason: null,
  },
  acceptanceCriteria: {
    userStory: "As an enterprise admin, I want workspace spend limits, so that I can prevent unexpected overages.",
    happyPath: [{ given: "Admin on enterprise plan", when: "Sets $500 monthly limit", then: "Limit saved and displayed on billing dashboard" }],
    edgeCases: [{ scenario: "Limit reached", given: "Usage at cap", when: "New usage attempted", then: "Hard block with clear error message" }],
    explicitlyOutOfScope: ["Invoice proration changes"],
    regressionRisks: ["Existing metering must continue for non-limited workspaces"],
    definitionOfDone: ["Code merged", "Tests passing", "AC verified", "CS notified"],
  },
  artifacts: {
    engineeringPing: "PLT-1287 — workspace billing limits for enterprise admins.\nLikely files: server/src/billing/limits.ts, BillingPanel.jsx\nPriority: NOW (high revenue risk)\nGotcha: confirm hard vs soft limit before starting",
    stakeholderUpdate: "We've reviewed your billing limits request and understand the need to cap workspace spend. Engineering is scoping the change now. We'll share a timeline within this sprint.",
    pmOneLiner: "Feature — Workspace billing limits for enterprise — Revenue risk, 3 active accounts — M / complexity 5 — NOW",
    sprintPlanningNote: "Enterprise CS escalated billing caps. High alignment with churn OKR. ~4.5h agent pipeline estimate; main risk is billing module test coverage. Done = limits enforced + admin UI + alerts.",
  },
  retrospective: null,
  stageMeta: [],
  startedAt: minutes(6),
  completedAt: minutes(4),
  updatedAt: minutes(4),
  costUsd: 0.48,
};

const MOCK_PM_ANALYSES = { "PLT-1287": MOCK_PM_ANALYSIS_FULL };

function buildMockPmHandoff(ticketId) {
  const key = String(ticketId).toUpperCase();
  const analysis = MOCK_PM_ANALYSES[key] ?? MOCK_PM_ANALYSIS_FULL;
  const impact = analysis.codebaseImpact ?? MOCK_PM_ANALYSIS_FULL.codebaseImpact;
  const impl = analysis.implementation ?? MOCK_PM_ANALYSIS_FULL.implementation;
  const ac = analysis.acceptanceCriteria ?? MOCK_PM_ANALYSIS_FULL.acceptanceCriteria;
  const effort = analysis.effortEstimate ?? MOCK_PM_ANALYSIS_FULL.effortEstimate;
  const enrichment = analysis.enrichment ?? MOCK_PM_ANALYSIS_FULL.enrichment;
  const classification = analysis.classification ?? MOCK_PM_ANALYSIS_FULL.classification;
  const prio = analysis.prioritization ?? MOCK_PM_ANALYSIS_FULL.prioritization;

  const codeSnapshots = (impact.affectedFiles ?? [])
    .filter((f) => f.role === "primary")
    .slice(0, 3)
    .map((f) => ({
      path: f.path,
      content: `// Mock snapshot for ${f.path}\n// ${f.reason}\nexport function placeholder() {\n  return null;\n}\n`,
      size: 128,
    }));

  const handoff = {
    jiraId: key,
    jiraUrl: `https://example.atlassian.net/browse/${key}`,
    type: classification.type,
    subtype: classification.subtype,
    severity: classification.severity,
    recommendation: prio.recommendation,
    realUserProblem: enrichment.realUserProblem,
    cleanSummary: enrichment.cleanSummary,
    suggestedFirstFile: impact.suggestedFirstFile.split(" — ")[0] ?? impact.suggestedFirstFile,
    suggestedFirstFileReason:
      impact.suggestedFirstFile.split(" — ")[1] ?? impact.recentChangeConnection,
    affectedFiles: impact.affectedFiles,
    whereNotToTouch: impl.whereNotToTouch,
    recentCommitHistory:
      "abc1234 | Alex Chen | 2026-06-01 | Adjust metering hooks for workspace billing",
    approachSummary: impl.approachSummary,
    implementationSteps: impl.implementationSteps,
    alternativeApproach: impl.alternativeApproach,
    userStory: ac.userStory,
    happyPath: ac.happyPath,
    edgeCases: ac.edgeCases,
    explicitlyOutOfScope: ac.explicitlyOutOfScope,
    regressionRisks: ac.regressionRisks,
    definitionOfDone: ac.definitionOfDone,
    testingGuidance: impl.testingGuidance,
    tshirt: effort.tshirt,
    storyPoints: effort.storyPoints,
    effortBreakdown: effort.breakdown,
    openQuestions: impl.openQuestionsForEngineer,
    branchName: "main",
    codeSnapshots,
  };

  const prompt = `# Tech Agent Handoff — ${key}\n\n## 1. TICKET CONTEXT\n\n${enrichment.cleanSummary}\n\n## 12. CURRENT CODE — PRIMARY FILES\n\n${codeSnapshots.map((s) => `### ${s.path}\n\`\`\`\n${s.content}\n\`\`\``).join("\n\n")}`;

  return { handoff, prompt, codeSnapshots };
}

const MOCK_JIRA_SYNC_ISSUES = [
  {
    id: "sync_01",
    jiraKey: "PLT-1287",
    jiraTicketId: "10001",
    projectKey: "PLT",
    summary: "Add usage-based billing controls",
    issueType: "Story",
    status: "In Progress",
    priority: "High",
    jiraUpdatedAt: minutes(2),
    embeddedAt: minutes(5),
  },
  {
    id: "sync_02",
    jiraKey: "PLT-1201",
    jiraTicketId: "10002",
    projectKey: "PLT",
    summary: "Fix webhook retry storm on rate limits",
    issueType: "Bug",
    status: "To Do",
    priority: "Medium",
    jiraUpdatedAt: minutes(48),
    embeddedAt: minutes(50),
  },
  {
    id: "sync_03",
    jiraKey: "PLT-1150",
    jiraTicketId: "10003",
    projectKey: "PLT",
    summary: "Enterprise SSO session timeout",
    issueType: "Bug",
    status: "Done",
    priority: "High",
    jiraUpdatedAt: minutes(120),
    embeddedAt: minutes(122),
  },
];

const MOCK_PM_ANALYSES_LIST = [
  {
    id: "pm_mock_01",
    jiraKey: "PLT-1287",
    status: "COMPLETED",
    currentStage: null,
    summary: "Add usage-based billing controls",
    recommendation: "NOW",
    severity: "high",
    startedAt: minutes(6),
    completedAt: minutes(4),
    costUsd: 0.48,
  },
];

function buildMockKnowledge(branch = "main", source = "cache") {
  return {
    branchName: branch,
    generatedAt: new Date().toISOString(),
    source,
    architecture: {
      title: "AgentOS architecture",
      purpose: "Multi-agent Jira pipeline with codebase intelligence, GitHub indexing, and QA automation.",
      sections: [
        {
          heading: "System purpose",
          body: "AgentOS orchestrates Product → Engineering → QA agents with human gates, while indexing connected repositories for semantic search and documentation.",
          fileRefs: ["server/src/pipeline/orchestrator.ts"],
        },
        {
          heading: "Major components",
          body: "server/ hosts the API, agents, and indexing. app/ is the React dashboard. prisma/ defines the Postgres schema.",
          fileRefs: ["server/", "app/", "server/prisma/schema.prisma"],
        },
        {
          heading: "Data flows",
          body: "Jira webhooks trigger pipelines. GitHub connect triggers codebase indexing. Embeddings land in Supabase for search.",
          fileRefs: ["server/src/codebaseIntelligence/indexer.ts"],
        },
      ],
    },
    components: [
      {
        path: "server",
        title: "Backend API & agents",
        summary: "Express API, pipeline orchestration, codebase intelligence, and Git integration.",
        responsibilities: ["Agentic pipeline", "Codebase indexing", "Jira intake"],
        inputs: ["Jira webhooks", "GitHub App events"],
        outputs: ["REST API", "Indexed intelligence"],
        dependencies: ["app"],
        keyFiles: [
          {
            path: "server/src/pipeline/orchestrator.ts",
            summary: "Coordinates multi-agent pipeline stages.",
          },
        ],
      },
      {
        path: "app",
        title: "Frontend dashboard",
        summary: "React UI for pipelines, codebase intelligence, and Git connect.",
        responsibilities: ["Operator UX", "Codebase explorer & map"],
        inputs: ["REST API"],
        outputs: ["Human review surfaces"],
        dependencies: ["server"],
        keyFiles: [
          {
            path: "app/src/app/pages/CodebaseIntelligence.jsx",
            summary: "Codebase intelligence module shell.",
          },
        ],
      },
    ],
    runbooks: [
      {
        task: "add-api-endpoint",
        title: "Add a new API endpoint",
        summary: "Follow existing Express route patterns under server/src/api/routes.",
        steps: [
          { order: 1, instruction: "Create or extend a route module.", fileRef: "server/src/api/routes/codebase.ts" },
          { order: 2, instruction: "Mount the router in app.ts if new." },
          { order: 3, instruction: "Add a frontend adapter in entities/ if exposed to UI." },
        ],
        exampleFiles: ["server/src/api/routes/codebase.ts"],
      },
      {
        task: "add-database-migration",
        title: "Add a database migration",
        summary: "Update Prisma schema and add a SQL migration.",
        steps: [
          { order: 1, instruction: "Edit schema.prisma.", fileRef: "server/prisma/schema.prisma" },
          { order: 2, instruction: "Add migration SQL under prisma/migrations." },
          { order: 3, instruction: "Run prisma migrate deploy on Render." },
        ],
        exampleFiles: ["server/prisma/schema.prisma"],
      },
    ],
  };
}

function buildMockTour(branch = "main", source = "cache") {
  const viz = buildMockVisualization(branch);
  const nodes = viz.nodes ?? [];
  return {
    branchName: branch,
    source,
    generatedAt: minutes(0),
    steps: [
      {
        id: "welcome",
        title: "Welcome to AgentOS",
        narration: `This tour walks branch ${branch} from the galaxy view down into the districts that matter most — server automation, product UI, and codebase intelligence.`,
        focusPath: null,
        zoomLevel: "galaxy",
      },
      {
        id: "server-core",
        title: "Backend & agents",
        narration:
          "Pipeline orchestration, validation gates, and agent loops live under server/. Most ticket-to-PR automation is coordinated here.",
        focusPath: "server",
        zoomLevel: "district",
        highlightPaths: nodes.filter((n) => n.path.startsWith("server")).map((n) => n.path),
        spotlights: [
          {
            path: "server/src/pipeline/orchestrator.ts",
            summary: "Stages tickets through product, engineering, and QA agents.",
          },
          {
            path: "server/src/codebaseIntelligence/indexer.ts",
            summary: "Indexes files, refreshes the map, and triggers tour generation.",
          },
        ],
      },
      {
        id: "frontend",
        title: "Product UI",
        narration:
          "The app/ district renders dashboards, codebase intelligence tabs, and the district map you are viewing now.",
        focusPath: "app",
        zoomLevel: "district",
        highlightPaths: nodes.filter((n) => n.path.includes("codebase")).map((n) => n.path),
        spotlights: [
          {
            path: "app/src/features/codebase-viz/CodebaseVisualization.jsx",
            summary: "Treemap map, tour overlay, and live WebSocket updates.",
          },
        ],
      },
      {
        id: "quiz-routes",
        title: "Checkpoint: API routes",
        narration: "Where would you add a new REST endpoint for codebase features?",
        focusPath: "server",
        zoomLevel: "district",
        quiz: {
          prompt: "Click the district that contains HTTP route handlers.",
          correctPathPrefix: "server",
          explanation:
            "REST routes live under server/src/api/routes — keep handlers thin and push logic into services.",
        },
      },
      {
        id: "quiz-viz",
        title: "Checkpoint: visualization",
        narration: "The guided tour reuses the same map component as the Map tab.",
        focusPath: null,
        zoomLevel: "galaxy",
        quiz: {
          prompt: "Which district holds the codebase map React components?",
          correctPathPrefix: "app",
          explanation: "Visualization UI is under app/src/features/codebase-viz.",
        },
      },
      {
        id: "quiz-data",
        title: "Checkpoint: persistence",
        narration: "Schema and migrations define what gets stored long-term.",
        focusPath: null,
        zoomLevel: "galaxy",
        quiz: {
          prompt: "Where are Prisma models and SQL migrations defined?",
          correctPathPrefix: "server",
          explanation: "Database schema lives in server/prisma — tour cache uses CodebaseTourCache.",
        },
      },
    ],
    cheatSheet: [
      {
        question: "Where are API routes?",
        pathPrefix: "server/src/api/routes",
        highlightPaths: ["server/src/api/routes/codebase.ts"],
      },
      { question: "Where is the pipeline orchestrator?", pathPrefix: "server/src/pipeline" },
      { question: "Where are agents defined?", pathPrefix: "server/src/agents" },
      {
        question: "Where is the codebase map UI?",
        pathPrefix: "app/src/features/codebase-viz",
        highlightPaths: ["app/src/features/codebase-viz/CodebaseVisualization.jsx"],
      },
      { question: "Where is the guided tour tab?", pathPrefix: "app/src/widgets/codebase-tour" },
      {
        question: "Where does indexing happen?",
        pathPrefix: "server/src/codebaseIntelligence",
        highlightPaths: ["server/src/codebaseIntelligence/indexer.ts"],
      },
      {
        question: "Where is the tour service?",
        pathPrefix: "server/src/codebaseIntelligence/tourService.ts",
      },
      { question: "Where are Prisma models?", pathPrefix: "server/prisma" },
      { question: "Where is semantic search UI?", pathPrefix: "app/src/widgets/codebase-search" },
      { question: "Where is the file explorer?", pathPrefix: "app/src/widgets/codebase-explorer" },
    ],
  };
}

function buildMockVisualization(branch) {
  const paths = [
    ["server/src/pipeline/orchestrator.ts", 380, ["service-layer"], "Pipeline orchestration and stage transitions."],
    ["server/src/agents/productAgent.ts", 240, ["service-layer"], "Product agent and PRD tool loop."],
    ["server/src/qaAgent/index.ts", 210, ["service-layer"], "Four-phase QA agent entry point."],
    ["server/src/codebaseIntelligence/layoutComputer.ts", 320, ["utility"], "Precomputed treemap layout for visualization API."],
    ["server/src/codebaseIntelligence/indexer.ts", 410, ["service-layer"], "Indexes repository files with AI summaries."],
    ["server/src/api/routes/codebase.ts", 95, ["api-route"], "Codebase intelligence REST routes."],
    ["app/src/features/codebase-viz/CodebaseVisualization.jsx", 280, ["ui-component"], "Primary district map UI shell."],
    ["app/src/features/codebase-viz/TreemapCanvas.jsx", 190, ["ui-component"], "Canvas renderer for file cells."],
    ["app/src/entities/codebase/index.js", 120, ["utility"], "Client adapters for codebase APIs."],
    ["app/src/app/pages/CodebaseIntelligence.jsx", 80, ["ui-component"], "Codebase intelligence page host."],
  ];

  const cols = 4;
  const cellW = 240;
  const cellH = 160;
  const nodes = paths.map(([path, size, patterns, summary], index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    return {
      id: path,
      path,
      name: path.split("/").pop(),
      type: "file",
      size,
      depth: path.split("/").length,
      parent: path.split("/").slice(0, -1).join("/") || null,
      language: path.split(".").pop(),
      summary,
      patterns,
      lastModified: minutes(index * 3),
      lastModifiedBy: index % 3 === 0 ? "agent" : "human",
      coverage: 50 + (index * 7) % 45,
      complexity: 3 + (index % 6),
      importCount: 8 - (index % 5),
      exportCount: 2 + (index % 4),
      x: 12 + col * (cellW + 8),
      y: 28 + row * (cellH + 8),
      width: cellW,
      height: cellH,
    };
  });

  const polygonFor = (x, y, w, h) => [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];

  const nodesWithPolygons = nodes.map((n) => ({
    ...n,
    polygon: polygonFor(n.x, n.y, n.width, n.height),
  }));

  return {
    nodes: nodesWithPolygons,
    edges: [
      { source: paths[0][0], target: paths[1][0], type: "import", weight: 2 },
      { source: paths[2][0], target: paths[0][0], type: "import", weight: 1 },
      { source: paths[6][0], target: paths[5][0], type: "import", weight: 1 },
    ],
    meta: {
      totalFiles: nodes.length,
      totalLines: nodes.reduce((s, n) => s + n.size, 0),
      languages: ["ts", "tsx", "js", "jsx"],
      lastFullIndex: minutes(0),
      districts: [
        {
          path: "server",
          summary: "Backend — agents, pipeline, codebase intelligence, and APIs.",
          fileCount: 6,
          primaryPattern: "service-layer",
        },
        {
          path: "app",
          summary: "Frontend — visualization UI, entities, and product pages.",
          fileCount: 4,
          primaryPattern: "ui-component",
        },
      ],
      tourSteps: [
        {
          id: "shape",
          title: "The shape of this codebase",
          narration: `Branch ${branch} is split between server (agents & APIs) and app (product UI). The server district is larger — most business automation lives there.`,
          focusPath: null,
          zoomLevel: "galaxy",
        },
        {
          id: "server",
          title: "Core business logic",
          narration: "Pipeline orchestration and agents live under server/. This is where tickets become PRDs, plans, and tests.",
          focusPath: "server",
          zoomLevel: "district",
          highlightPaths: nodes.filter((n) => n.path.startsWith("server")).map((n) => n.path),
        },
        {
          id: "viz",
          title: "The visualization layer",
          narration: "The district map itself lives in app/src/features/codebase-viz — Canvas for scale, React for panels and tour mode.",
          focusPath: "app",
          zoomLevel: "district",
          highlightPaths: nodes.filter((n) => n.path.includes("codebase-viz")).map((n) => n.path),
        },
      ],
      quickReference: [
        { question: "Where are the API routes?", pathPrefix: "server/src/api" },
        { question: "Where are the agents?", pathPrefix: "server/src/agents" },
        { question: "Where is the codebase map UI?", pathPrefix: "app/src/features/codebase-viz" },
      ],
      activityTimeline: {
        minDate: minutes(220),
        maxDate: minutes(0),
      },
      layoutKind: "voronoi",
    },
  };
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
