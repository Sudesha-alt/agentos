import { randomUUID } from "crypto";
import type { PmAnalysisRecord, PmAnalysisStatus, PmStageId, PmStageMeta } from "./types";

const analyses = new Map<string, PmAnalysisRecord>();

export const pmAnalysisStore = {
  create(record: Omit<PmAnalysisRecord, "id" | "updatedAt">): PmAnalysisRecord {
    const now = new Date().toISOString();
    const full: PmAnalysisRecord = {
      ...record,
      id: randomUUID(),
      updatedAt: now,
    };
    analyses.set(full.jiraKey.toUpperCase(), full);
    return full;
  },

  get(jiraKey: string): PmAnalysisRecord | null {
    return analyses.get(jiraKey.toUpperCase()) ?? null;
  },

  list(limit = 50): PmAnalysisRecord[] {
    return [...analyses.values()]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit);
  },

  update(
    jiraKey: string,
    patch: Partial<PmAnalysisRecord>
  ): PmAnalysisRecord | null {
    const existing = analyses.get(jiraKey.toUpperCase());
    if (!existing) return null;
    const updated: PmAnalysisRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    analyses.set(jiraKey.toUpperCase(), updated);
    return updated;
  },

  setStatus(jiraKey: string, status: PmAnalysisStatus, error?: string): void {
    const existing = analyses.get(jiraKey.toUpperCase());
    if (!existing) return;
    pmAnalysisStore.update(jiraKey, {
      status,
      error,
      completedAt:
        status === "COMPLETED" || status === "FAILED"
          ? new Date().toISOString()
          : existing.completedAt,
    });
  },

  setCurrentStage(jiraKey: string, stage: PmStageId | null): void {
    pmAnalysisStore.update(jiraKey, { currentStage: stage });
  },

  appendStageMeta(jiraKey: string, meta: PmStageMeta): void {
    const existing = analyses.get(jiraKey.toUpperCase());
    if (!existing) return;
    pmAnalysisStore.update(jiraKey, {
      stageMeta: [...existing.stageMeta, meta],
    });
  },
};
