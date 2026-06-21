import type { AuditLog, Pipeline, PipelineStage, Ticket } from "../db/prisma";
import { prisma } from "../db/client";
import { auditRepo } from "../db/repositories/auditRepo";
import { pipelineRepo } from "../db/repositories/pipelineRepo";
import {
  getCachedReadSourceFile,
  getStagedFilesForRun,
} from "../engineering/codingArtifactStore";
import { pipelineStageLabel } from "../pipeline/liveStatus";
import type { GeneratedPRD } from "../prd/prdGenerator";
import type { ImplementationMode, ImplementationOutput } from "../types/agents";

const ENGINEERING_STAGES: PipelineStage[] = [
  "ENGINEERING_AGENT",
  "IMPLEMENTATION_VALIDATION",
  "QA_AGENT",
  "QA_VALIDATION",
  "OUTPUT",
];

export interface EngineeringRunListItem {
  pipelineId: string;
  jiraKey: string;
  summary: string;
  status: string;
  statusLabel: string;
  currentStage: PipelineStage;
  currentStageLabel: string;
  branch: string;
  failureReason?: string;
}

export interface EngineeringRunDetail extends EngineeringRunListItem {
  prNumber: number | null;
  prDraft: boolean;
  durationMinutes: number;
  costUsd: number;
  toolCallCount: number;
  filesCreated: number;
  filesModified: number;
  testsGenerated: number;
  criteriaMapped: number;
  criteriaTotal: number;
  failedStage: PipelineStage | null;
  failedStageLabel: string | null;
  canResume: boolean;
  recentEvents: Array<{ event: string; timestamp: string; summary: string }>;
  implementationPlan: Record<string, unknown> | null;
  files: Array<{
    path: string;
    change: "created" | "modified";
    summary: string;
    content: string;
    diff?: string;
    humanModified: boolean;
  }>;
  toolCalls: Array<{ id: number; name: string; durationSec: number }>;
  pr: {
    title: string;
    description: string;
    labels: string[];
    draft: boolean;
    url: string;
    reviewers: string[];
  } | null;
  history: unknown[];
  liveSteps: Array<{
    id: string;
    label: string;
    status: "complete" | "in_progress" | "pending";
    detail?: string;
  }> | null;
  qaPhase: boolean;
  qaPipelineStage: PipelineStage | null;
  implementationMode: ImplementationMode;
  deliverableFiles: Array<{ path: string; format: string; purpose: string }>;
}

function resolveBranchName(): string {
  return process.env.ENGINEERING_CODING_BRANCH ?? "agentos/engineering";
}

function ticketSummary(ticket: Ticket): string {
  const normalized = ticket.normalizedData as { summary?: string } | null;
  return normalized?.summary?.trim() || ticket.jiraKey;
}

function mapFileChange(action: "create" | "modify"): "created" | "modified" {
  return action === "create" ? "created" : "modified";
}

function mapRunStatus(pipeline: Pipeline): string {
  if (pipeline.status === "RUNNING") return "RUNNING";
  if (pipeline.status === "PAUSED") return "PAUSED";
  if (pipeline.status === "FAILED") return "FAILED";
  if (pipeline.status === "COMPLETED") return "COMPLETED";
  return pipeline.status;
}

function mapStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    RUNNING: "Running",
    PAUSED: "Awaiting human",
    COMPLETED: "Completed",
    FAILED: "Failed",
  };
  return labels[status] ?? status;
}

interface FailureInfo {
  failedStage: PipelineStage | null;
  failureReason: string | null;
}

async function resolveFailureInfo(
  pipeline: Pipeline,
  logs: AuditLog[]
): Promise<FailureInfo> {
  if (pipeline.status !== "FAILED") {
    return { failedStage: null, failureReason: null };
  }

  const failedAudit = logs.find((l) => l.event === "PIPELINE_FAILED");
  if (failedAudit) {
    const meta = (failedAudit.metadata ?? {}) as {
      stage?: PipelineStage;
      error?: string;
    };
    return {
      failedStage: meta.stage ?? pipeline.currentStage,
      failureReason:
        meta.error?.trim() ||
        "Pipeline failed without a detailed error message.",
    };
  }

  const failedStageLog = await prisma.pipelineStageLog.findFirst({
    where: { pipelineId: pipeline.id, status: "FAILED" },
    orderBy: { completedAt: "desc" },
    select: { stage: true, error: true },
  });
  if (failedStageLog?.error) {
    return {
      failedStage: failedStageLog.stage,
      failureReason: failedStageLog.error,
    };
  }

  const runningStageLog = await prisma.pipelineStageLog.findFirst({
    where: { pipelineId: pipeline.id, status: "RUNNING" },
    orderBy: { startedAt: "desc" },
    select: { stage: true, startedAt: true },
  });
  if (runningStageLog) {
    return {
      failedStage: runningStageLog.stage,
      failureReason: `Pipeline stopped while ${pipelineStageLabel(runningStageLog.stage)} was still running. This often means the server restarted or the run exceeded the stale timeout. Resume to retry from the last completed stage.`,
    };
  }

  return {
    failedStage: pipeline.currentStage,
    failureReason:
      "Pipeline failed without a recorded error. Open the pipeline detail page for audit logs, or resume to retry.",
  };
}

function summarizeAuditEvent(log: AuditLog): string {
  const meta = (log.metadata ?? {}) as Record<string, unknown>;
  if (typeof meta.error === "string" && meta.error.trim()) return meta.error.trim();
  if (typeof meta.message === "string" && meta.message.trim()) return meta.message.trim();
  if (typeof meta.tool === "string") {
    const filePath = typeof meta.filePath === "string" ? meta.filePath : "";
    return filePath ? `${meta.tool}: ${filePath}` : String(meta.tool);
  }
  return log.event.replaceAll("_", " ").toLowerCase();
}

function buildRecentEvents(logs: AuditLog[]): EngineeringRunDetail["recentEvents"] {
  return logs.slice(0, 8).map((log) => ({
    event: log.event,
    timestamp: log.timestamp.toISOString(),
    summary: summarizeAuditEvent(log),
  }));
}

function isQaPhase(stage: PipelineStage): boolean {
  return stage === "QA_AGENT" || stage === "QA_VALIDATION";
}

function simpleLineDiff(before: string, after: string): string {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const removed = beforeLines.filter((l) => !afterLines.includes(l)).slice(0, 12);
  const added = afterLines.filter((l) => !beforeLines.includes(l)).slice(0, 12);
  const parts: string[] = [];
  for (const l of removed) parts.push(`- ${l}`);
  for (const l of added) parts.push(`+ ${l}`);
  return parts.join("\n") || "(content changed)";
}

function buildImplementationPlan(
  impl: ImplementationOutput | null
): Record<string, unknown> | null {
  if (!impl) return null;
  return {
    technicalSummary: impl.summary,
    criteria: (impl.criteriaMapping ?? []).map((m, i) => ({
      id: `AC-${i + 1}`,
      text: m.criterion,
      implementation: m.implementation,
      test: "",
    })),
    risks: (impl.risks ?? []).map((r) => ({
      level: r.severity.toUpperCase(),
      text: `${r.description} — ${r.mitigation}`,
    })),
  };
}

function buildFiles(
  pipelineId: string,
  impl: ImplementationOutput | null
): EngineeringRunDetail["files"] {
  const staged = getStagedFilesForRun(pipelineId);
  if (staged.length) {
    return staged.map((f) => {
      const original = getCachedReadSourceFile(pipelineId, f.filePath);
      return {
        path: f.filePath,
        change: mapFileChange(f.action),
        summary: f.summary,
        content: f.content,
        diff:
          f.action === "modify" && original
            ? simpleLineDiff(original, f.content)
            : undefined,
        humanModified: false,
      };
    });
  }

  return (impl?.codeChanges ?? []).map((c) => ({
    path: c.filePath,
    change: mapFileChange(c.action),
    summary: c.summary,
    content: c.summary,
    humanModified: false,
  }));
}

function buildToolCalls(logs: AuditLog[]): EngineeringRunDetail["toolCalls"] {
  const coding = logs
    .filter((l) => l.event === "CODING_TOOL_CALL_COMPLETED")
    .reverse();
  return coding.map((l, i) => {
    const meta = (l.metadata ?? {}) as Record<string, unknown>;
    const tool = String(meta.tool ?? "tool");
    const filePath = typeof meta.filePath === "string" ? meta.filePath : "";
    const name = filePath ? `${tool}: ${filePath.split("/").pop()}` : tool;
    return {
      id: i + 1,
      name,
      durationSec: Math.round(Number(meta.durationMs ?? 0) / 100) / 10,
    };
  });
}

function buildLiveSteps(
  pipeline: Pipeline,
  logs: AuditLog[],
  stagedCount: number
): EngineeringRunDetail["liveSteps"] {
  if (pipeline.status !== "RUNNING") return null;
  if (
    pipeline.currentStage !== "ENGINEERING_AGENT" &&
    pipeline.currentStage !== "IMPLEMENTATION_VALIDATION"
  ) {
    return null;
  }

  const codingStarted = logs.some((l) => l.event === "ENGINEERING_CODING_STARTED");
  const codingDone = logs.some((l) => l.event === "ENGINEERING_CODING_COMPLETED");
  const toolLogs = logs.filter((l) => l.event === "CODING_TOOL_CALL_COMPLETED");
  const writes = toolLogs.filter(
    (l) => (l.metadata as Record<string, unknown>)?.tool === "write_source_file"
  );
  const reads = toolLogs.filter(
    (l) => (l.metadata as Record<string, unknown>)?.tool === "read_source_file"
  );

  const steps: EngineeringRunDetail["liveSteps"] = [
    {
      id: "plan",
      label: "Creating implementation plan…",
      status: codingStarted ? "complete" : "in_progress",
    },
    {
      id: "read",
      label: `Reading source files… (${reads.length} read)`,
      status:
        codingStarted && !codingDone && writes.length === 0
          ? "in_progress"
          : reads.length
            ? "complete"
            : "pending",
    },
  ];

  const writeCount = Math.max(writes.length, stagedCount);
  for (let i = 0; i < writeCount; i++) {
    const meta = (writes[i]?.metadata ?? {}) as Record<string, unknown>;
    const filePath = String(meta.filePath ?? stagedCount > i ? `staged-${i + 1}` : `file-${i + 1}`);
    const fileName = filePath.split("/").pop() ?? filePath;
    const isLast = i === writeCount - 1;
    steps.push({
      id: `write-${i}`,
      label: `Writing ${fileName}…`,
      status: codingDone
        ? "complete"
        : isLast && !codingDone
          ? "in_progress"
          : i < writes.length
            ? "complete"
            : "pending",
      detail: isLast && !codingDone ? "Staging file content" : undefined,
    });
  }

  steps.push({
    id: "validate",
    label: "Running implementation check…",
    status: codingDone ? "complete" : "pending",
  });

  return steps;
}

async function loadImplementationOutput(
  pipelineId: string
): Promise<ImplementationOutput | null> {
  const log = await pipelineRepo.getStageOutput(pipelineId, "ENGINEERING_AGENT");
  if (!log?.output) return null;
  return log.output as unknown as ImplementationOutput;
}

async function loadBranchPr(jiraKey: string) {
  const row = await prisma.branchState.findFirst({
    where: { jiraKey },
    orderBy: { updatedAt: "desc" },
  });
  if (!row?.prUrl) return null;
  const match = row.prUrl.match(/\/pull\/(\d+)/);
  return {
    prNumber: match ? Number(match[1]) : null,
    prUrl: row.prUrl,
    draft: row.prStatus !== "open",
  };
}

function resolveRunDeliverableContext(
  impl: ImplementationOutput | null,
  ticket: Ticket
): {
  implementationMode: ImplementationMode;
  deliverableFiles: Array<{ path: string; format: string; purpose: string }>;
} {
  const normalized = ticket.normalizedData as {
    pmContext?: { generatedPrd?: GeneratedPRD };
  } | null;
  const generatedPrd = normalized?.pmContext?.generatedPrd;
  const implementationMode =
    impl?.implementationMode ?? generatedPrd?.implementationMode ?? "code";
  const deliverableFiles =
    generatedPrd?.deliverableFiles ??
    (impl?.targetFiles ?? []).map((path) => ({
      path,
      format: path.endsWith(".md") ? "markdown" : "document",
      purpose: "Implementation target",
    }));
  return { implementationMode, deliverableFiles };
}

function buildDetail(
  pipeline: Pipeline & { ticket: Ticket },
  impl: ImplementationOutput | null,
  logs: AuditLog[],
  costUsd: number,
  failure: FailureInfo
): EngineeringRunDetail {
  const staged = getStagedFilesForRun(pipeline.id);
  const files = buildFiles(pipeline.id, impl);
  const criteriaTotal = impl?.criteriaMapping?.length ?? 0;
  const criteriaMapped = impl?.codeChanges?.length
    ? Math.min(criteriaTotal, impl.codeChanges.length)
    : staged.length
      ? Math.min(criteriaTotal || staged.length, staged.length)
      : 0;

  const { implementationMode, deliverableFiles } = resolveRunDeliverableContext(
    impl,
    pipeline.ticket
  );

  const durationMs =
    pipeline.completedAt && pipeline.startedAt
      ? pipeline.completedAt.getTime() - pipeline.startedAt.getTime()
      : Date.now() - pipeline.startedAt.getTime();

  return {
    pipelineId: pipeline.id,
    jiraKey: pipeline.ticket.jiraKey,
    summary: ticketSummary(pipeline.ticket),
    status: mapRunStatus(pipeline),
    statusLabel: mapStatusLabel(mapRunStatus(pipeline)),
    currentStage: pipeline.currentStage,
    currentStageLabel: pipelineStageLabel(pipeline.currentStage),
    branch: resolveBranchName(),
    failureReason: failure.failureReason ?? undefined,
    failedStage: failure.failedStage,
    failedStageLabel: failure.failedStage
      ? pipelineStageLabel(failure.failedStage)
      : null,
    canResume: pipeline.status === "FAILED",
    recentEvents: buildRecentEvents(logs),
    prNumber: null,
    prDraft: true,
    durationMinutes: Math.max(1, Math.round(durationMs / 60_000)),
    costUsd,
    toolCallCount: logs.filter((l) => l.event === "CODING_TOOL_CALL_COMPLETED").length,
    filesCreated: files.filter((f) => f.change === "created").length,
    filesModified: files.filter((f) => f.change === "modified").length,
    testsGenerated: 0,
    criteriaMapped,
    criteriaTotal: criteriaTotal || criteriaMapped,
    implementationPlan: buildImplementationPlan(impl),
    files,
    toolCalls: buildToolCalls(logs),
    pr: null,
    history: [],
    liveSteps: buildLiveSteps(pipeline, logs, staged.length),
    qaPhase: isQaPhase(pipeline.currentStage),
    qaPipelineStage: isQaPhase(pipeline.currentStage) ? pipeline.currentStage : null,
    implementationMode,
    deliverableFiles,
  };
}

export async function listEngineeringRuns(
  organizationId: string
): Promise<{ items: EngineeringRunListItem[] }> {
  const pipelines = await prisma.pipeline.findMany({
    where: {
      organizationId,
      currentStage: { in: ENGINEERING_STAGES },
    },
    orderBy: { startedAt: "desc" },
    take: 50,
    include: { ticket: true },
  });

  const failedIds = pipelines.filter((p) => p.status === "FAILED").map((p) => p.id);
  const failureByPipeline = new Map<string, FailureInfo>();

  if (failedIds.length) {
    const failedAudits = await prisma.auditLog.findMany({
      where: { pipelineId: { in: failedIds }, event: "PIPELINE_FAILED" },
      orderBy: { timestamp: "desc" },
    });
    for (const audit of failedAudits) {
      if (!audit.pipelineId || failureByPipeline.has(audit.pipelineId)) continue;
      const meta = (audit.metadata ?? {}) as { stage?: PipelineStage; error?: string };
      const pipeline = pipelines.find((p) => p.id === audit.pipelineId);
      failureByPipeline.set(audit.pipelineId, {
        failedStage: meta.stage ?? pipeline?.currentStage ?? null,
        failureReason: meta.error?.trim() || null,
      });
    }
  }

  const items = pipelines.map((p) => {
    const failure = failureByPipeline.get(p.id);
    const status = mapRunStatus(p);
    return {
      pipelineId: p.id,
      jiraKey: p.ticket.jiraKey,
      summary: ticketSummary(p.ticket),
      status,
      statusLabel: mapStatusLabel(status),
      currentStage: p.currentStage,
      currentStageLabel: pipelineStageLabel(p.currentStage),
      branch: resolveBranchName(),
      failureReason: failure?.failureReason ?? undefined,
    };
  });

  return { items };
}

export async function getEngineeringRun(
  pipelineId: string
): Promise<EngineeringRunDetail | null> {
  const pipeline = await pipelineRepo.findById(pipelineId);
  if (!pipeline) return null;

  const logs = await auditRepo.listForPipeline(pipelineId, 300);
  const failure = await resolveFailureInfo(pipeline, logs);
  const impl = await loadImplementationOutput(pipelineId);
  const stageLogs = await prisma.pipelineStageLog.findMany({
    where: { pipelineId },
    select: { costUsd: true },
  });
  const costUsd = stageLogs.reduce((sum, l) => sum + (l.costUsd ?? 0), 0);

  const detail = buildDetail(pipeline, impl, logs, costUsd, failure);
  const prInfo = await loadBranchPr(pipeline.ticket.jiraKey);
  if (prInfo) {
    detail.prNumber = prInfo.prNumber;
    detail.pr = {
      title: `${pipeline.ticket.jiraKey}: ${ticketSummary(pipeline.ticket)}`,
      description: impl?.codingSummary ?? impl?.summary ?? "",
      labels: ["agent-generated"],
      draft: prInfo.draft,
      url: prInfo.prUrl,
      reviewers: [],
    };
  }

  return detail;
}
