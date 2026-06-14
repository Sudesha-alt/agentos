import { randomUUID } from "crypto";
import { getDb } from "../../jira-intake/sqliteStore";
import { logger } from "../../utils/logger";
import type { PmAnalysisRecord, PmAnalysisStatus, PmStageId, PmStageMeta } from "./types";

const analyses = new Map<string, PmAnalysisRecord>();

function normalizeKey(jiraKey: string): string {
  return jiraKey.trim().toUpperCase();
}

function persistRecord(record: PmAnalysisRecord): void {
  const key = normalizeKey(record.jiraKey);
  analyses.set(key, record);
  try {
    getDb()
      .prepare(
        `INSERT INTO pm_analysis_records (jira_key, record_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(jira_key) DO UPDATE SET
           record_json = excluded.record_json,
           updated_at = excluded.updated_at`
      )
      .run(key, JSON.stringify(record), record.updatedAt);
  } catch (err) {
    logger.warn({ err, jiraKey: key }, "pm analysis sqlite persist failed");
  }
}

export function loadPmAnalysesFromStore(): number {
  try {
    const rows = getDb()
      .prepare(`SELECT jira_key, record_json FROM pm_analysis_records`)
      .all() as Array<{ jira_key: string; record_json: string }>;

    analyses.clear();
    for (const row of rows) {
      try {
        const record = JSON.parse(row.record_json) as PmAnalysisRecord;
        analyses.set(normalizeKey(row.jira_key), record);
      } catch (err) {
        logger.warn({ err, jiraKey: row.jira_key }, "pm analysis sqlite row parse failed");
      }
    }
    return analyses.size;
  } catch (err) {
    logger.warn({ err }, "pm analysis sqlite load failed");
    return 0;
  }
}

export const pmAnalysisStore = {
  create(record: Omit<PmAnalysisRecord, "id" | "updatedAt">): PmAnalysisRecord {
    const now = new Date().toISOString();
    const full: PmAnalysisRecord = {
      agentName: "Virin",
      ...record,
      id: randomUUID(),
      updatedAt: now,
    };
    persistRecord(full);
    return full;
  },

  get(jiraKey: string): PmAnalysisRecord | null {
    return analyses.get(normalizeKey(jiraKey)) ?? null;
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
    const key = normalizeKey(jiraKey);
    const existing = analyses.get(key);
    if (!existing) return null;
    const updated: PmAnalysisRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    persistRecord(updated);
    return updated;
  },

  setStatus(jiraKey: string, status: PmAnalysisStatus, error?: string): void {
    const existing = analyses.get(normalizeKey(jiraKey));
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
    const existing = analyses.get(normalizeKey(jiraKey));
    if (!existing) return;
    pmAnalysisStore.update(jiraKey, {
      stageMeta: [...existing.stageMeta, meta],
    });
  },
};
