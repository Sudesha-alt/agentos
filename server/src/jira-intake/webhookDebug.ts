export interface LastWebhookRecord {
  receivedAt: string;
  webhookEvent?: string;
  issueKey?: string;
  statusName?: string;
  action: string;
}

let lastWebhook: LastWebhookRecord | null = null;

export function recordWebhook(
  payload: { webhookEvent?: string } | null,
  parsed: { issueKey?: string; statusName?: string } | null,
  action: string
): void {
  lastWebhook = {
    receivedAt: new Date().toISOString(),
    webhookEvent: payload?.webhookEvent,
    issueKey: parsed?.issueKey,
    statusName: parsed?.statusName,
    action,
  };
}

export function getLastWebhook(): LastWebhookRecord | null {
  return lastWebhook;
}
