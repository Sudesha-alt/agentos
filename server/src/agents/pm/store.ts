import { randomUUID } from "crypto";
import { getDb } from "../../jira-intake/sqliteStore";
import { upsertPmAnalysisRecord } from "../../db/repositories/pmAnalysisRepo";
import { getActiveOrganizationId } from "../../organization/context";
import { logger } from "../../utils/logger";
import type { PmAnalysisRecord, PmAnalysisStatus, PmStageId, PmStageMeta } from "./types";

/** Composite cache key when org is known; falls back to jiraKey-only for legacy rows. */
const analyses = new Map<string, PmAnalysisRecord>();
const hydratedOrgs = new Set<string>();

function normalizeKey(jiraKey: string): string {
  return jiraKey.trim().toUpperCase();
}

function cacheKey(jiraKey: string, organizationId?: string | null): string {
  const key = normalizeKey(jiraKey);
  return organizationId ? `${organizationId}:${key}` : key;
}

function resolveOrganizationId(record?: PmAnalysisRecord): string | null {
  return getActiveOrganizationId() ?? record?.organizationId ?? null;
}

function putInCache(record: PmAnalysisRecord): void {
  const jiraKey = normalizeKey(record.jiraKey);
  const orgId = record.organizationId ?? null;
  if (orgId) {
    analyses.set(cacheKey(jiraKey, orgId), record);
  }
  analyses.set(cacheKey(jiraKey), record);
}

function getFromCache(jiraKey: string, organizationId?: string | null): PmAnalysisRecord | null {
  const key = normalizeKey(jiraKey);
  const orgId = organizationId ?? getActiveOrganizationId();
  if (orgId) {
    const scoped = analyses.get(cacheKey(key, orgId));
    if (scoped) return scoped;
  }
  return analyses.get(cacheKey(key)) ?? null;
}

function persistRecord(record: PmAnalysisRecord): void {
  putInCache(record);
  const orgId = resolveOrganizationId(record);
  if (!orgId) {
    logger.warn({ jiraKey: record.jiraKey }, "pm analysis persist skipped — no organization context");
    return;
  }
  const withOrg: PmAnalysisRecord = { ...record, organizationId: orgId };
  putInCache(withOrg);
  void upsertPmAnalysisRecord(orgId, normalizeKey(record.jiraKey), withOrg).catch((err) => {
    logger.warn({ err, jiraKey: record.jiraKey }, "pm analysis postgres persist failed");
  });
}

function loadPmAnalysesFromSqliteForOrg(organizationId: string, limit: number): number {
  try {
    const rows = getDb()
      .prepare(`SELECT jira_key, record_json FROM pm_analysis_records`)
      .all() as Array<{ jira_key: string; record_json: string }>;

    let loaded = 0;
    for (const row of rows) {
      if (loaded >= limit) break;
      try {
        const record = JSON.parse(row.record_json) as PmAnalysisRecord;
        if (record.organizationId && record.organizationId !== organizationId) continue;
        putInCache(record);
        loaded += 1;
      } catch (err) {
        logger.warn({ err, jiraKey: row.jira_key }, "pm analysis sqlite row parse failed");
      }
    }
    return loaded;
  } catch (err) {
    logger.warn({ err }, "pm analysis sqlite load failed");
    return 0;
  }
}

export async function ensurePmAnalysesHydratedForOrg(
  organizationId: string,
  limit = 100
): Promise<void> {
  if (hydratedOrgs.has(organizationId)) return;
  hydratedOrgs.add(organizationId);

  if (!process.env.DATABASE_URL?.trim()) {
    loadPmAnalysesFromSqliteForOrg(organizationId, limit);
    return;
  }

  try {
    const { listPmAnalysisRecordsForOrg } = await import("../../db/repositories/pmAnalysisRepo");
    const rows = await listPmAnalysisRecordsForOrg(organizationId, limit);
    for (const record of rows) {
      putInCache({ ...record, organizationId });
    }
  } catch (err) {
    logger.warn({ err, organizationId }, "pm analysis org hydrate failed");
    hydratedOrgs.delete(organizationId);
  }
}

export async function ensurePmAnalysisRecordLoaded(
  organizationId: string,
  jiraKey: string
): Promise<PmAnalysisRecord | null> {
  const key = normalizeKey(jiraKey);
  const cached = getFromCache(key, organizationId);
  if (cached) return cached;

  if (!process.env.DATABASE_URL?.trim()) {
    await ensurePmAnalysesHydratedForOrg(organizationId);
    return getFromCache(key, organizationId);
  }

  try {
    const { getPmAnalysisRecordForOrg } = await import("../../db/repositories/pmAnalysisRepo");
    const record = await getPmAnalysisRecordForOrg(organizationId, key);
    if (!record) return null;
    putInCache({ ...record, organizationId });
    return getFromCache(key, organizationId);
  } catch (err) {
    logger.warn({ err, organizationId, jiraKey: key }, "pm analysis record load failed");
    return null;
  }
}

/** @deprecated Startup no longer loads all orgs — use ensurePmAnalysesHydratedForOrg per request. */
export async function loadPmAnalysesFromStore(): Promise<number> {
  return 0;
}

export const pmAnalysisStore = {
  create(record: Omit<PmAnalysisRecord, "id" | "updatedAt">): PmAnalysisRecord {
    const now = new Date().toISOString();
    const organizationId = record.organizationId ?? getActiveOrganizationId() ?? undefined;
    const full: PmAnalysisRecord = {
      agentName: "Virin",
      ...record,
      organizationId,
      id: randomUUID(),
      updatedAt: now,
    };
    persistRecord(full);
    return full;
  },

  get(jiraKey: string): PmAnalysisRecord | null {
    return getFromCache(jiraKey);
  },

  /** Merge a Postgres row into the in-memory cache (no-op if newer cache entry exists). */
  hydrate(record: PmAnalysisRecord): PmAnalysisRecord {
    const existing = getFromCache(record.jiraKey, record.organizationId);
    if (existing && existing.updatedAt >= record.updatedAt) {
      return existing;
    }
    persistRecord(record);
    return getFromCache(record.jiraKey, record.organizationId) ?? record;
  },

  list(limit = 50): PmAnalysisRecord[] {
    const orgId = getActiveOrganizationId();
    const byId = new Map<string, PmAnalysisRecord>();

    for (const record of analyses.values()) {
      if (orgId && record.organizationId && record.organizationId !== orgId) continue;
      byId.set(record.id, record);
    }

    return [...byId.values()]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit);
  },

  update(
    jiraKey: string,
    patch: Partial<PmAnalysisRecord>
  ): PmAnalysisRecord | null {
    const existing = getFromCache(jiraKey);
    if (!existing) return null;
    const updated: PmAnalysisRecord = {
      ...existing,
      ...patch,
      organizationId: patch.organizationId ?? existing.organizationId ?? getActiveOrganizationId() ?? undefined,
      updatedAt: new Date().toISOString(),
    };
    persistRecord(updated);
    return updated;
  },

  setStatus(jiraKey: string, status: PmAnalysisStatus, error?: string): void {
    const existing = getFromCache(jiraKey);
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
    const existing = getFromCache(jiraKey);
    if (!existing) return;
    pmAnalysisStore.update(jiraKey, {
      stageMeta: [...existing.stageMeta, meta],
    });
  },
};
