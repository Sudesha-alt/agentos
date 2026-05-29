export function formatToolResult(toolName: string, result: unknown): string {
  switch (toolName) {
    case "search_historical_context":
      return formatHistoricalContextResult(result);
    case "fetch_related_jira_tickets":
      return formatRelatedJiraTicketsResult(result);
    case "analyse_requirement_completeness":
      return formatCompletenessResult(result);
    case "score_prd_readiness":
      return formatPrdReadinessResult(result);
    default:
      return JSON.stringify(result, null, 2);
  }
}

function formatHistoricalContextResult(result: unknown): string {
  const data = asRecord(result);
  const results = Array.isArray(data.results) ? data.results : [];
  if (results.length === 0) {
    return [
      "No historical context found matching this query.",
      "This may be a novel feature or the query may need to be broadened.",
    ].join(" ");
  }

  return `Found ${results.length} relevant historical items:\n\n${results
    .map((item, index) => {
      const record = asRecord(item);
      const similarity = toNumber(record.similarity);
      return [
        `[${index + 1}] ${String(record.contentType ?? "unknown").toUpperCase()} from ${record.jiraKey ?? "unknown"}`,
        similarity !== null
          ? `Similarity: ${(similarity * 100).toFixed(0)}%`
          : "Similarity: unavailable",
        String(record.content ?? ""),
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n---\n\n")}`;
}

function formatRelatedJiraTicketsResult(result: unknown): string {
  const data = asRecord(result);
  const tickets = Array.isArray(data.tickets) ? data.tickets : [];
  const notes = Array.isArray(data.notes)
    ? data.notes.map((note) => String(note)).filter(Boolean)
    : [];

  const header =
    tickets.length === 0
      ? "No related tickets found."
      : `Found ${tickets.length} related tickets:\n\n${tickets
          .map((ticket) => {
            const item = asRecord(ticket);
            const relationship = item.relationship ? ` [${item.relationship}]` : "";
            return `${item.key ?? "UNKNOWN"}${relationship} [${item.type ?? "Unknown"}/${item.status ?? "Unknown"}]: ${item.summary ?? ""}`;
          })
          .join("\n")}`;

  return notes.length > 0 ? `${header}\n\nNotes:\n- ${notes.join("\n- ")}` : header;
}

function formatCompletenessResult(result: unknown): string {
  const data = asRecord(result);
  const totalIssues = toNumber(data.totalIssues) ?? 0;
  const passedChecks = Array.isArray(data.passedChecks)
    ? data.passedChecks.map((item) => String(item)).filter(Boolean)
    : [];
  const issues = Array.isArray(data.issues) ? data.issues : [];

  if (issues.length === 0) {
    return [
      "Completeness Analysis:",
      "",
      `Issues found: ${totalIssues}`,
      `Passed checks: ${passedChecks.join(", ") || "none"}`,
      "",
      "No issues found. The current requirement draft looks complete for the requested checks.",
    ].join("\n");
  }

  return [
    "Completeness Analysis:",
    "",
    `Issues found: ${totalIssues}`,
    `Passed checks: ${passedChecks.join(", ") || "none"}`,
    "",
    "Issues:",
    ...issues.map((issue) => {
      const item = asRecord(issue);
      return `- [${item.severity ?? "warning"}] ${item.description ?? "Unknown issue"} (${item.location ?? "unknown location"})`;
    }),
  ].join("\n");
}

function formatPrdReadinessResult(result: unknown): string {
  const data = asRecord(result);
  const score = toNumber(data.score) ?? 0;
  const passesGate = Boolean(data.passesGate);
  const recommendation = String(data.recommendation ?? "review");
  const failureReasons = Array.isArray(data.failureReasons)
    ? data.failureReasons.map((item) => String(item)).filter(Boolean)
    : [];

  return [
    `PRD Gate Score: ${(score * 100).toFixed(0)}%`,
    `Passes Gate (>=70%): ${passesGate ? "YES" : "NO"}`,
    `Recommendation: ${recommendation}`,
    "",
    failureReasons.length > 0
      ? `Failure reasons:\n${failureReasons.map((reason) => `- ${reason}`).join("\n")}`
      : "No failure reasons. The PRD is ready for the gate.",
  ].join("\n");
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
