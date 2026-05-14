// In-memory mock backend so the product UI is fully usable without spinning
// up Postgres / Redis. The shape mirrors the real Express routes 1:1.

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
    currentStage: "QA_VALIDATION",
    status: "RUNNING",
    startedAt: minutes(2),
    completedAt: null,
    ticket: {
      jiraKey: "PLT-1287",
      normalizedData: { summary: "Add usage-based billing controls" },
    },
  },
  {
    id: "pl_01J6XP",
    ticketId: "tk_01J6XP",
    currentStage: "PRD_VALIDATION",
    status: "PAUSED",
    startedAt: minutes(14),
    completedAt: null,
    ticket: {
      jiraKey: "PLT-1271",
      normalizedData: {
        summary: "Workspace-level audit log export",
      },
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
      jiraKey: "PLT-1264",
      normalizedData: { summary: "Slack notification per failed validation gate" },
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
  { event: "PRODUCT_AGENT_STARTED", metadata: { promptLength: 2342 }, timestamp: minutes(13.8) },
  {
    event: "PRODUCT_AGENT_COMPLETED",
    metadata: { inputTokens: 1340, outputTokens: 1882, costUsd: 0.0327, durationMs: 8120 },
    timestamp: minutes(13.6),
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
      fakeStage("PRODUCT_AGENT", "COMPLETED", MOCK_PRD, null, 0.0327, MOCK_PRD.confidenceScore),
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

export const mockApi = {
  wasUsed: () => used,
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
  async getAudit() {
    markUsed();
    await delay(100);
    return { items: MOCK_AUDIT };
  },
  async runPipeline(ticketId) {
    markUsed();
    await delay(140);
    return { jobId: "mock-job", ticketId };
  },
  async submitOverride(pipelineId, payload) {
    markUsed();
    await delay(180);
    return { ok: true, pipelineId, payload };
  },
  async readiness() {
    markUsed();
    await delay(60);
    return { status: "ready", checks: { postgres: "ok", redis: "ok" } };
  },
};

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
