const AUDIT_EVENT_LABELS: Record<string, string> = {
  PIPELINE_STARTED: "Pipeline started",
  PIPELINE_COMPLETED: "Pipeline completed",
  PIPELINE_FAILED: "Pipeline failed",
  PIPELINE_RESUMED: "Pipeline resumed",
  STAGE_ADVANCED: "Advanced to next stage",
  AWAITING_HUMAN: "Waiting for human review",
  PRODUCT_AGENT_STARTED: "Virin is analyzing the ticket",
  DISCOVERY_STEP_STARTED: "Discovery step started",
  PRODUCT_AGENT_COMPLETED: "Virin finished product analysis",
  ENGINEERING_AGENT_STARTED: "Ananta is planning implementation",
  ENGINEERING_AGENT_COMPLETED: "Ananta finished engineering plan",
  QA_AGENT_STARTED: "Neel is running QA analysis",
  QA_AGENT_COMPLETED: "Neel finished QA report",
  ENGINEERING_CODING_STARTED: "Ananta is writing code",
  ENGINEERING_CODING_COMPLETED: "Code changes complete",
  ENGINEERING_SANDBOX_COMPILE: "Compiling in sandbox",
  ENGINEERING_PUSHED_TO_BRANCH: "Pushed changes to branch",
  AGENTIC_LOOP_STARTED: "Agent reasoning loop started",
  AGENTIC_LOOP_COMPLETED: "Agent reasoning loop finished",
  LLM_RESPONSE_RECEIVED: "Received model response",
  TOOL_CALL_STARTED: "Running tool",
  TOOL_CALL_COMPLETED: "Tool call finished",
  TOOL_CALL_FAILED: "Tool call failed",
  CODING_TOOL_CALL_STARTED: "Running coding tool",
  CODING_TOOL_CALL_COMPLETED: "Coding tool finished",
  CODING_TOOL_CALL_FAILED: "Coding tool failed",
  QA_TOOL_CALL_STARTED: "Running QA tool",
  QA_TOOL_CALL_COMPLETED: "QA tool finished",
  QA_TOOL_CALL_FAILED: "QA tool failed",
  TICKET_EMBEDDED: "Embedded ticket for context",
  CONTEXT_RETRIEVED: "Retrieved similar tickets & code",
  TICKET_ANALYSED: "Analyzed ticket requirements",
  INTELLIGENCE_EXTRACTED: "Extracted org intelligence",
  GAPS_ANALYSED: "Identified requirement gaps",
  COMPLEXITY_SCORED: "Scored implementation complexity",
  PRD_GENERATED: "Generated PRD draft",
  DISCOVERY_COMPLETE: "Discovery phase complete",
  SCORES_COMPUTED: "Computed ROI scores",
  JIRA_WRITEBACK_COMPLETED: "Updated Jira with results",
  CODE_EDIT_APPLIED: "Applied code edit",
  CANARY_FINDINGS: "Recorded canary findings",
  CANARY_RUN_COMPLETED: "Canary run finished",
  HUMAN_OVERRIDE: "Human override applied",
};

export function formatAuditEventLabel(event?: string | null, metadata?: unknown): string {
  if (event === "DISCOVERY_STEP_STARTED" && metadata && typeof metadata === "object") {
    const label = (metadata as Record<string, unknown>).label;
    if (typeof label === "string") return label;
  }
  if (!event) return "Audit event";
  if (AUDIT_EVENT_LABELS[event]) return AUDIT_EVENT_LABELS[event];
  return event.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function formatAuditEventDetail(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  const parts: string[] = [];

  if (typeof m.tool === "string") parts.push(`Tool: ${m.tool}`);
  if (typeof m.reason === "string") parts.push(m.reason);
  if (typeof m.message === "string") parts.push(m.message);
  if (typeof m.error === "string") parts.push(m.error);
  if (typeof m.filePath === "string") parts.push(`File: ${m.filePath}`);
  if (typeof m.path === "string") parts.push(`File: ${m.path}`);
  if (typeof m.jiraKey === "string") parts.push(m.jiraKey);
  if (typeof m.branch === "string") parts.push(`Branch: ${m.branch}`);
  if (typeof m.label === "string") parts.push(m.label);
  if (typeof m.step === "string") parts.push(`Step: ${m.step}`);

  return parts.length ? parts.join(" · ") : null;
}
