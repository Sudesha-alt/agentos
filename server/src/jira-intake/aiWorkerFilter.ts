export function isAiWorkerStatus(
  statusName: string | undefined,
  allowedStatuses: string[]
): boolean {
  if (!statusName) return false;
  const normalized = statusName.trim().toLowerCase();
  return allowedStatuses.some((s) => s.trim().toLowerCase() === normalized);
}
