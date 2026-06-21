import type { IntakeScanResult } from "../../jira-sync/intakeScan";
import type { IntakeEnqueueResult } from "./intakeOrchestrator";

export interface IntakeDiagnosticsSnapshot {
  lastWebhookAt: string | null;
  lastWebhookJiraKey: string | null;
  lastWebhookIntake: IntakeEnqueueResult | null;
  lastScan: IntakeScanResult | null;
  lastScanAt: string | null;
}

const byOrg = new Map<string, IntakeDiagnosticsSnapshot>();

function emptySnapshot(): IntakeDiagnosticsSnapshot {
  return {
    lastWebhookAt: null,
    lastWebhookJiraKey: null,
    lastWebhookIntake: null,
    lastScan: null,
    lastScanAt: null,
  };
}

export function recordWebhookReceipt(organizationId: string, jiraKey: string): void {
  const current = byOrg.get(organizationId) ?? emptySnapshot();
  byOrg.set(organizationId, {
    ...current,
    lastWebhookAt: new Date().toISOString(),
    lastWebhookJiraKey: jiraKey,
  });
}

export function recordWebhookIntakeResult(
  organizationId: string,
  result: IntakeEnqueueResult
): void {
  const current = byOrg.get(organizationId) ?? emptySnapshot();
  byOrg.set(organizationId, {
    ...current,
    lastWebhookIntake: result,
  });
}

export function recordIntakeScanResult(
  organizationId: string,
  result: IntakeScanResult
): void {
  const current = byOrg.get(organizationId) ?? emptySnapshot();
  byOrg.set(organizationId, {
    ...current,
    lastScan: result,
    lastScanAt: new Date().toISOString(),
  });
}

export function getIntakeDiagnosticsSnapshot(
  organizationId: string
): IntakeDiagnosticsSnapshot {
  return byOrg.get(organizationId) ?? emptySnapshot();
}
