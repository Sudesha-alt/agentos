import type {
  AuditLogDto,
  PipelineStage,
  PipelineStatus,
  StageStatus,
} from "../../contracts";
import { STAGE_LABELS, STATUS_LABELS } from "../config/app";

export function formatStageLabel(stage: PipelineStage): string {
  return STAGE_LABELS[stage] ?? stage;
}

export function formatStatusLabel(status: PipelineStatus | StageStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function formatRelativeTime(ts?: string | null): string {
  if (!ts) return "—";
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

export function formatDuration(start?: string | null, end?: string | null): string {
  if (!start || !end) return "—";
  return `${Math.max(
    1,
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000)
  )}s`;
}

export function formatUsd(value?: number | null): string {
  if (typeof value !== "number") return "—";
  return `$${value.toFixed(4)}`;
}

export function formatCompactNumber(value?: number | null): string {
  if (typeof value !== "number") return "—";
  return value.toLocaleString();
}

export function formatAuditInline(entry: AuditLogDto): string {
  if (!entry.metadata || Object.keys(entry.metadata).length === 0) {
    return "";
  }

  return Object.entries(entry.metadata)
    .map(([key, value]) => `${key}: ${formatUnknown(value)}`)
    .join("  ·  ");
}

export function formatUnknown(value: unknown): string {
  if (typeof value === "number") {
    if (value > 1 && value < 1000000) return value.toLocaleString();
    if (value < 1) return value.toFixed(4);
  }
  if (typeof value === "string" && value.length > 80) {
    return `${value.slice(0, 80)}…`;
  }
  if (value == null) return "—";
  return String(value);
}
