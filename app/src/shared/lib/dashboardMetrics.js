/** Format today's spend from GET /api/costs/daily (last bucket). */
export function formatCostToday(dailyData) {
  const today = dailyData?.days?.at(-1);
  if (!today) return "—";
  const total = (today.product ?? 0) + (today.engineering ?? 0) + (today.qa ?? 0);
  return `$${total.toFixed(2)}`;
}

/** Aggregate pass rate from QA pipeline reports (today first, else recent). */
export function derivePassRate(reportsData) {
  const reports = reportsData?.reports ?? [];
  if (!reports.length) return "—";

  const now = new Date();
  const todayReports = reports.filter((r) => {
    if (!r.completedAt) return false;
    const d = new Date(r.completedAt);
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  });

  const pool = todayReports.length > 0 ? todayReports : reports.slice(0, 12);
  const withRate = pool.filter((r) => typeof r.passRate === "number");
  if (!withRate.length) return "—";

  const avg = withRate.reduce((sum, r) => sum + r.passRate, 0) / withRate.length;
  return `${Math.round(avg)}%`;
}
