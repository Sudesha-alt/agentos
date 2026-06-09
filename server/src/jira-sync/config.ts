export function getJiraSyncConfig() {
  const embedStatusesRaw =
    process.env.JIRA_SYNC_EMBED_STATUSES?.trim() ?? "";
  const embedStatuses = embedStatusesRaw
    ? embedStatusesRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : null;

  return {
    fullSyncOnConnect: process.env.JIRA_SYNC_ON_CONNECT !== "false",
    intervalMs: Number(process.env.JIRA_SYNC_INTERVAL_MS ?? 15 * 60 * 1000),
    pageSize: Number(process.env.JIRA_SYNC_PAGE_SIZE ?? 100),
    /** null = embed all synced issues */
    embedStatuses,
    maxComments: Number(process.env.JIRA_SYNC_MAX_COMMENTS ?? 15),
  };
}

export function shouldEmbedStatus(status: string): boolean {
  const { embedStatuses } = getJiraSyncConfig();
  if (!embedStatuses || embedStatuses.length === 0) return true;
  const lower = status.toLowerCase();
  return embedStatuses.some((s) => s.toLowerCase() === lower);
}
