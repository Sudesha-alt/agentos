import type { AuditLog, Pipeline, PipelineStage, PipelineStageLog, Ticket } from "../db/prisma";
import { prisma } from "../db/client";
import { getPipelineQueueState } from "../queue/inProcessRunner";

const STAGE_LABELS: Record<PipelineStage, string> = {
  INGESTION: "Ingestion",
  PRODUCT_AGENT: "Virin (Product)",
  PRD_VALIDATION: "PRD validation gate",
  ENGINEERING_AGENT: "Ananta (Engineering)",
  IMPLEMENTATION_VALIDATION: "Implementation gate",
  QA_AGENT: "Neel (QA)",
  QA_VALIDATION: "QA validation gate",
  OUTPUT: "Jira writeback",
};

const AUDIT_LABELS: Record<string, string> = {
  PIPELINE_STARTED: "Pipeline started",
  PIPELINE_COMPLETED: "Pipeline completed",
  PIPELINE_FAILED: "Pipeline failed",
  PIPELINE_RESUMED: "Pipeline resumed",
  STAGE_ADVANCED: "Advanced to next stage",
  AWAITING_HUMAN: "Waiting for human review",
  DISCOVERY_STEP_STARTED: "Discovery step started",
  PRODUCT_AGENT_STARTED: "Virin is analyzing the ticket",
  PRODUCT_AGENT_COMPLETED: "Virin finished product analysis",
  ENGINEERING_AGENT_STARTED: "Ananta is planning implementation",
  ENGINEERING_AGENT_COMPLETED: "Ananta finished engineering plan",
  QA_AGENT_STARTED: "Neel is running QA analysis",
  QA_AGENT_COMPLETED: "Neel finished QA report",
  ENGINEERING_CODING_STARTED: "Ananta is writing code",
  ENGINEERING_CODING_COMPLETED: "Code changes complete",
  ENGINEERING_SANDBOX_COMPILE: "Compiling in sandbox",
  ENGINEERING_PUSHED_TO_BRANCH: "Pushed changes to branch",
  AGENTIC_LOOP_STARTED: "Agent reasoning loop started",
  AGENTIC_LOOP_COMPLETED: "Agent reasoning loop finished",
  LLM_RESPONSE_RECEIVED: "Received model response",
  TOOL_CALL_STARTED: "Running tool",
  TOOL_CALL_COMPLETED: "Tool call finished",
  TOOL_CALL_FAILED: "Tool call failed",
  CODING_TOOL_CALL_STARTED: "Running coding tool",
  CODING_TOOL_CALL_COMPLETED: "Coding tool finished",
  CODING_TOOL_CALL_FAILED: "Coding tool failed",
  QA_TOOL_CALL_STARTED: "Running QA tool",
  QA_TOOL_CALL_COMPLETED: "QA tool finished",
  QA_TOOL_CALL_FAILED: "QA tool failed",
  TICKET_EMBEDDED: "Embedded ticket for context",
  CONTEXT_RETRIEVED: "Retrieved similar tickets & code",
  TICKET_ANALYSED: "Analyzed ticket requirements",
  INTELLIGENCE_EXTRACTED: "Extracted org intelligence",
  GAPS_ANALYSED: "Identified requirement gaps",
  COMPLEXITY_SCORED: "Scored implementation complexity",
  PRD_GENERATED: "Generated PRD draft",
  DISCOVERY_COMPLETE: "Discovery phase complete",
  SCORES_COMPUTED: "Computed ROI scores",
  JIRA_WRITEBACK_COMPLETED: "Updated Jira with results",
  CANARY_FINDINGS: "Recorded canary findings",
  CANARY_RUN_COMPLETED: "Canary run finished",
  HUMAN_OVERRIDE: "Human override applied",
};

export interface LiveAuditEntry {
  id: string;
  event: string;
  label: string;
  detail: string | null;
  timestamp: string;
}

export interface LivePipelineStatus {
  pipelineId: string;
  ticketId: string;
  jiraKey: string;
  summary: string;
  status: Pipeline["status"];
  currentStage: PipelineStage;
  currentStageLabel: string;
  currentAction: string;
  runningStage: PipelineStage | null;
  runningStageLabel: string | null;
  stageProgress: Array<{
    stage: PipelineStage;
    label: string;
    status: PipelineStageLog["status"] | "PENDING";
  }>;
  recentActivity: LiveAuditEntry[];
  /** Chronological audit trail for thought-process UI (oldest first). */
  thoughtProcess: LiveAuditEntry[];
  /** Discovery sub-steps while in PRODUCT_AGENT. */
  discoverySteps: Array<{
    step: string;
    label: string;
    status: "COMPLETED" | "RUNNING" | "PENDING" | "BLOCKED";
  }>;
  blockReason: string | null;
  blockStage: PipelineStage | null;
  startedAt: string;
  queuedCount: number;
  queuedJiraKeys: string[];
}

export interface LivePipelineResponse {
  active: LivePipelineStatus | null;
  queue: Awaited<ReturnType<typeof getPipelineQueueState>>;
}

function stageLabel(stage: PipelineStage): string {
  return STAGE_LABELS[stage] ?? stage;
}

function auditLabel(event: string, metadata?: unknown): string {
  if (event === "DISCOVERY_STEP_STARTED" && metadata && typeof metadata === "object") {
    const label = (metadata as Record<string, unknown>).label;
    if (typeof label === "string") return label;
  }
  if (AUDIT_LABELS[event]) return AUDIT_LABELS[event];
  return event.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function auditDetail(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  const parts: string[] = [];

  if (typeof m.tool === "string") parts.push(`Tool: ${m.tool}`);
  if (typeof m.stage === "string") parts.push(`Stage: ${stageLabel(m.stage as PipelineStage)}`);
  if (typeof m.reason === "string") parts.push(m.reason);
  if (typeof m.message === "string") parts.push(m.message);
  if (typeof m.error === "string") parts.push(m.error);
  if (typeof m.filePath === "string") parts.push(`File: ${m.filePath}`);
  if (typeof m.path === "string") parts.push(`File: ${m.path}`);
  if (typeof m.jiraKey === "string") parts.push(m.jiraKey);
  if (typeof m.branch === "string") parts.push(`Branch: ${m.branch}`);
  if (typeof m.label === "string") parts.push(m.label);
  if (typeof m.step === "string") parts.push(`Step: ${m.step}`);

  return parts.length ? parts.join(" · ") : null;
}

function formatAuditEntry(log: AuditLog): LiveAuditEntry {
  return {
    id: log.id,
    event: log.event,
    label: auditLabel(log.event, log.metadata),
    detail: auditDetail(log.metadata),
    timestamp: log.timestamp.toISOString(),
  };
}

function buildStageProgress(
  currentStage: PipelineStage,
  status: Pipeline["status"],
  stageLogs: PipelineStageLog[]
): LivePipelineStatus["stageProgress"] {
  const order: PipelineStage[] = [
    "INGESTION",
    "PRODUCT_AGENT",
    "PRD_VALIDATION",
    "ENGINEERING_AGENT",
    "IMPLEMENTATION_VALIDATION",
    "QA_AGENT",
    "QA_VALIDATION",
    "OUTPUT",
  ];
  const currentIdx = order.indexOf(currentStage);
  const latestByStage = new Map<PipelineStage, PipelineStageLog>();
  for (const log of stageLogs) {
    if (!latestByStage.has(log.stage)) latestByStage.set(log.stage, log);
  }

  return order.map((stage, idx) => {
    const log = latestByStage.get(stage);
    let stageStatus: PipelineStageLog["status"] | "PENDING" = log?.status ?? "PENDING";
    if (!log) {
      if (idx < currentIdx) stageStatus = "COMPLETED";
      else if (idx === currentIdx && status === "RUNNING") stageStatus = "RUNNING";
      else if (idx === currentIdx && status === "PAUSED") stageStatus = "AWAITING_HUMAN";
      else stageStatus = "PENDING";
    }
    return {
      stage,
      label: stageLabel(stage),
      status: stageStatus,
    };
  });
}

function deriveCurrentAction(
  status: Pipeline["status"],
  currentStage: PipelineStage,
  recentActivity: LiveAuditEntry[],
  runningStage: PipelineStage | null,
  blockReason: string | null
): string {
  if (status === "PAUSED") {
    if (blockReason) {
      return `Blocked — ${blockReason}`;
    }
    return `Waiting for your review at ${stageLabel(currentStage)}`;
  }
  const latest = recentActivity[0];
  if (latest) {
    return latest.detail ? `${latest.label} — ${latest.detail}` : latest.label;
  }
  if (runningStage) {
    return `Working on ${stageLabel(runningStage)}…`;
  }
  return `Running ${stageLabel(currentStage)}…`;
}

const DISCOVERY_STEP_DEFS: Array<{
  step: string;
  label: string;
  completeEvents: string[];
}> = [
  {
    step: "context_retrieval",
    label: "Retrieving similar tickets and codebase context",
    completeEvents: ["CONTEXT_RETRIEVED"],
  },
  {
    step: "ticket_analysis",
    label: "Analyzing ticket requirements",
    completeEvents: ["TICKET_ANALYSED"],
  },
  {
    step: "historical_intelligence",
    label: "Extracting historical patterns and precedents",
    completeEvents: ["INTELLIGENCE_EXTRACTED"],
  },
  {
    step: "gap_analysis",
    label: "Identifying requirement gaps",
    completeEvents: ["GAPS_ANALYSED"],
  },
  {
    step: "complexity_scoring",
    label: "Scoring implementation complexity",
    completeEvents: ["COMPLEXITY_SCORED"],
  },
  {
    step: "prd_generation",
    label: "Drafting the PRD",
    completeEvents: ["PRD_GENERATED", "DISCOVERY_COMPLETE"],
  },
];

function extractBlockInfo(auditLogs: AuditLog[]): {
  blockReason: string | null;
  blockStage: PipelineStage | null;
} {
  const awaiting = auditLogs.find((log) => log.event === "AWAITING_HUMAN");
  if (!awaiting?.metadata || typeof awaiting.metadata !== "object") {
    return { blockReason: null, blockStage: null };
  }
  const meta = awaiting.metadata as Record<string, unknown>;
  return {
    blockReason: typeof meta.reason === "string" ? meta.reason : null,
    blockStage: typeof meta.stage === "string" ? (meta.stage as PipelineStage) : null,
  };
}

function buildDiscoverySteps(
  auditLogs: AuditLog[],
  status: Pipeline["status"],
  currentStage: PipelineStage
): LivePipelineStatus["discoverySteps"] {
  if (currentStage !== "PRODUCT_AGENT" && status !== "PAUSED") {
    return [];
  }

  const eventSet = new Set(auditLogs.map((log) => log.event));
  const pausedAtProduct =
    status === "PAUSED" &&
    (currentStage === "PRODUCT_AGENT" ||
      auditLogs.some(
        (log) =>
          log.event === "AWAITING_HUMAN" &&
          typeof log.metadata === "object" &&
          (log.metadata as Record<string, unknown>).stage === "PRODUCT_AGENT"
      ));

  let runningIdx = DISCOVERY_STEP_DEFS.findIndex(
    (def) => !def.completeEvents.some((event) => eventSet.has(event))
  );
  if (runningIdx === -1) runningIdx = DISCOVERY_STEP_DEFS.length;

  return DISCOVERY_STEP_DEFS.map((def, idx) => {
    const completed = def.completeEvents.some((event) => eventSet.has(event));
    let stepStatus: LivePipelineStatus["discoverySteps"][number]["status"] = "PENDING";
    if (completed) stepStatus = "COMPLETED";
    else if (pausedAtProduct && idx === runningIdx) stepStatus = "BLOCKED";
    else if (idx === runningIdx && status === "RUNNING") stepStatus = "RUNNING";
    return { step: def.step, label: def.label, status: stepStatus };
  });
}

function mapPipelineToLive(
  pipeline: Pipeline & {
    ticket: Ticket;
    auditLogs: AuditLog[];
    stages: PipelineStageLog[];
  },
  queue: Awaited<ReturnType<typeof getPipelineQueueState>>
): LivePipelineStatus {
  const normalized = pipeline.ticket.normalizedData as { summary?: string } | null;
  const formattedLogs = pipeline.auditLogs.map(formatAuditEntry);
  const thoughtProcess = [...formattedLogs].reverse();
  const recentActivity = formattedLogs;
  const { blockReason, blockStage } = extractBlockInfo(pipeline.auditLogs);
  const runningLog = pipeline.stages.find((s: PipelineStageLog) => s.status === "RUNNING");
  const runningStage = runningLog?.stage ?? null;

  return {
    pipelineId: pipeline.id,
    ticketId: pipeline.ticketId,
    jiraKey: pipeline.ticket.jiraKey,
    summary: normalized?.summary ?? pipeline.ticket.jiraKey,
    status: pipeline.status,
    currentStage: pipeline.currentStage,
    currentStageLabel: stageLabel(pipeline.currentStage),
    currentAction: deriveCurrentAction(
      pipeline.status,
      pipeline.currentStage,
      recentActivity,
      runningStage,
      blockReason
    ),
    runningStage,
    runningStageLabel: runningStage ? stageLabel(runningStage) : null,
    stageProgress: buildStageProgress(pipeline.currentStage, pipeline.status, pipeline.stages),
    recentActivity,
    thoughtProcess,
    discoverySteps: buildDiscoverySteps(
      pipeline.auditLogs,
      pipeline.status,
      pipeline.currentStage
    ),
    blockReason,
    blockStage,
    startedAt: pipeline.startedAt.toISOString(),
    queuedCount: queue.queueLength,
    queuedJiraKeys: queue.queuedJiraKeys,
  };
}

export async function getLivePipelineStatus(
  organizationId: string,
  options?: { jiraKey?: string }
): Promise<LivePipelineResponse> {
  const queue = await getPipelineQueueState(organizationId);
  const jiraKey = options?.jiraKey?.trim().toUpperCase();

  const include = {
    ticket: true,
    auditLogs: { orderBy: { timestamp: "desc" as const }, take: 50 },
    stages: { orderBy: { startedAt: "desc" as const }, take: 20 },
  };

  let pipeline =
    jiraKey &&
    (await prisma.pipeline.findFirst({
      where: {
        organizationId,
        status: { in: ["RUNNING", "PAUSED"] },
        ticket: { jiraKey },
      },
      orderBy: { startedAt: "desc" },
      include,
    }));

  if (!pipeline) {
    pipeline =
      queue.activeTicketId &&
      (await prisma.pipeline.findFirst({
        where: {
          organizationId,
          ticketId: queue.activeTicketId,
          status: { in: ["RUNNING", "PAUSED"] },
        },
        include,
      }));
  }

  if (!pipeline) {
    pipeline = await prisma.pipeline.findFirst({
      where: {
        organizationId,
        status: { in: ["RUNNING", "PAUSED"] },
      },
      orderBy: { startedAt: "desc" },
      include,
    });
  }

  if (!pipeline) {
    if (queue.activeJiraKey) {
      const ticket = queue.activeTicketId
        ? await prisma.ticket.findFirst({
            where: { id: queue.activeTicketId, organizationId },
            select: { id: true, jiraKey: true, normalizedData: true },
          })
        : null;
      const normalized = ticket?.normalizedData as { summary?: string } | null;

      return {
        active: {
          pipelineId: "",
          ticketId: queue.activeTicketId ?? "",
          jiraKey: queue.activeJiraKey,
          summary: normalized?.summary ?? queue.activeJiraKey,
          status: "RUNNING",
          currentStage: "INGESTION",
          currentStageLabel: stageLabel("INGESTION"),
          currentAction: "Starting pipeline — preparing run…",
          runningStage: "INGESTION",
          runningStageLabel: stageLabel("INGESTION"),
          stageProgress: buildStageProgress("INGESTION", "RUNNING", []),
          recentActivity: [],
          thoughtProcess: [],
          discoverySteps: [],
          blockReason: null,
          blockStage: null,
          startedAt: new Date().toISOString(),
          queuedCount: queue.queueLength,
          queuedJiraKeys: queue.queuedJiraKeys,
        },
        queue,
      };
    }

    return {
      active: null,
      queue,
    };
  }

  return {
    active: mapPipelineToLive(pipeline, queue),
    queue,
  };
}
