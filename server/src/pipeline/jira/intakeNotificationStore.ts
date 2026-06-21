export interface IntakeNotification {
  id: string;
  jiraKey: string;
  summary: string;
  issueType: string;
  message: string;
  pipelineStarted: boolean;
  live: boolean;
  tone: "intake";
  timestamp: string;
}

const MAX_PER_ORG = 40;
const byOrg = new Map<string, IntakeNotification[]>();

export function recordIntakeAssignment(input: {
  organizationId: string;
  jiraKey: string;
  summary: string;
  issueType: string;
  pipelineStarted: boolean;
}): IntakeNotification {
  const event: IntakeNotification = {
    id: `intake-${input.jiraKey}-${Date.now()}`,
    jiraKey: input.jiraKey,
    summary: input.summary,
    issueType: input.issueType,
    message: input.pipelineStarted
      ? "New work assigned — pipeline started"
      : "New work assigned — queued for pipeline",
    pipelineStarted: input.pipelineStarted,
    live: input.pipelineStarted,
    tone: "intake",
    timestamp: new Date().toISOString(),
  };

  const list = byOrg.get(input.organizationId) ?? [];
  byOrg.set(input.organizationId, [event, ...list].slice(0, MAX_PER_ORG));
  return event;
}

export function listIntakeNotifications(organizationId: string): IntakeNotification[] {
  return byOrg.get(organizationId) ?? [];
}
