import type { AuditLog, Pipeline, Ticket } from "../db/prisma";
import type { PipelineStage } from "../generated/prisma/client";
import { prisma } from "../db/client";
import { auditRepo } from "../db/repositories/auditRepo";
import { pipelineRepo } from "../db/repositories/pipelineRepo";
import {
  getCachedReadSourceFile,
  getStagedFilesForRun,
} from "../engineering/codingArtifactStore";
import type { ImplementationOutput } from "../types/agents";

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
  currentStage: PipelineStage;
  branch: string;
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

function buildDetail(
  pipeline: Pipeline & { ticket: Ticket },
  impl: ImplementationOutput | null,
  logs: AuditLog[],
  costUsd: number
): EngineeringRunDetail {
  const staged = getStagedFilesForRun(pipeline.id);
  const files = buildFiles(pipeline.id, impl);
  const criteriaTotal = impl?.criteriaMapping?.length ?? 0;
  const criteriaMapped = impl?.codeChanges?.length
    ? Math.min(criteriaTotal, impl.codeChanges.length)
    : staged.length
      ? Math.min(criteriaTotal || staged.length, staged.length)
      : 0;

  const durationMs =
    pipeline.completedAt && pipeline.startedAt
      ? pipeline.completedAt.getTime() - pipeline.startedAt.getTime()
      : Date.now() - pipeline.startedAt.getTime();

  return {
    pipelineId: pipeline.id,
    jiraKey: pipeline.ticket.jiraKey,
    summary: ticketSummary(pipeline.ticket),
    status: mapRunStatus(pipeline),
    currentStage: pipeline.currentStage,
    branch: resolveBranchName(),
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

  const items = pipelines.map((p) => ({
    pipelineId: p.id,
    jiraKey: p.ticket.jiraKey,
    summary: ticketSummary(p.ticket),
    status: mapRunStatus(p),
    currentStage: p.currentStage,
    branch: resolveBranchName(),
  }));

  return { items };
}

export async function getEngineeringRun(
  pipelineId: string
): Promise<EngineeringRunDetail | null> {
  const pipeline = await pipelineRepo.findById(pipelineId);
  if (!pipeline) return null;

  const logs = await auditRepo.listForPipeline(pipelineId, 300);
  const impl = await loadImplementationOutput(pipelineId);
  const stageLogs = await prisma.pipelineStageLog.findMany({
    where: { pipelineId },
    select: { costUsd: true },
  });
  const costUsd = stageLogs.reduce((sum, l) => sum + (l.costUsd ?? 0), 0);

  const detail = buildDetail(pipeline, impl, logs, costUsd);
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
