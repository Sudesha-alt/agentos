import type { Request } from "express";
import {
  getPublicPipelineJiraCredentials,
  savePipelineJiraCredentials,
  validatePipelineJiraConfig,
} from "./credentialsStore";
import { fetchPipelineJiraCurrentUser } from "./client";
import { getJiraSyncConfig } from "../../jira-sync/config";
import { runJiraSyncInBackground } from "../../queue/inProcessRunner";
import { ensurePipelineJiraWebhook } from "./webhookRegistration";

export function pipelineJiraPublicBase(req: Request): string {
  if (process.env.PUBLIC_API_URL?.trim()) {
    return process.env.PUBLIC_API_URL.replace(/\/$/, "");
  }
  const proto = req.header("x-forwarded-proto") || req.protocol || "https";
  const host =
    req.header("x-forwarded-host") || req.get("host") || "localhost:4000";
  return `${proto}://${host}`;
}

export function pipelineJiraWebhookUrl(req: Request): string {
  return `${pipelineJiraPublicBase(req)}/webhooks/jira/pipeline`;
}

export { ensurePipelineJiraWebhook } from "./webhookRegistration";

export async function connectPipelineJira(input: {
  baseUrl: string;
  email?: string;
  apiToken?: string;
  webhookSecret?: string;
  projectKeys?: string[];
  boardId?: string;
  webhookUrl?: string;
  autoRegisterWebhook?: boolean;
}) {
  let email = input.email?.trim() || "";

  if (input.apiToken?.trim()) {
    savePipelineJiraCredentials({
      baseUrl: input.baseUrl,
      email: email || "pending@connect",
      apiToken: input.apiToken,
      webhookSecret: input.webhookSecret,
      projectKeys: input.projectKeys,
      boardId: input.boardId,
    });
    try {
      const me = await fetchPipelineJiraCurrentUser();
      email = me.email;
      savePipelineJiraCredentials({
        baseUrl: input.baseUrl,
        email,
        apiToken: input.apiToken,
        webhookSecret: input.webhookSecret,
        projectKeys: input.projectKeys,
        boardId: input.boardId,
      });
    } catch {
      if (!email) {
        throw new Error(
          "apiToken valid but could not fetch Jira profile — enter email"
        );
      }
    }
  } else {
    savePipelineJiraCredentials({
      baseUrl: input.baseUrl,
      email,
      webhookSecret: input.webhookSecret,
      projectKeys: input.projectKeys,
      boardId: input.boardId,
    });
  }

  validatePipelineJiraConfig();

  const jira = getPublicPipelineJiraCredentials();
  const projectKey = input.projectKeys?.[0] ?? jira.projectKeys[0] ?? null;

  let webhookRegistration: {
    registered: boolean;
    created: boolean;
    jiraWebhookId?: number;
    error?: string;
  } = { registered: false, created: false };

  if (
    input.autoRegisterWebhook !== false &&
    input.webhookUrl &&
    jira.webhookSecret
  ) {
    try {
      const result = await ensurePipelineJiraWebhook({
        webhookUrl: input.webhookUrl,
        secret: jira.webhookSecret,
        projectKey,
      });
      webhookRegistration = {
        registered: result.registered,
        created: result.created,
        jiraWebhookId: result.webhook.id,
      };
    } catch (err) {
      webhookRegistration = {
        registered: false,
        created: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const syncConfig = getJiraSyncConfig();
  let syncStarted = false;
  if (syncConfig.fullSyncOnConnect) {
    const result = runJiraSyncInBackground({
      mode: "full",
      projectKeys: input.projectKeys ?? jira.projectKeys,
    });
    syncStarted = result.started;
  }

  return {
    connected: true,
    jira,
    webhookRegistration,
    projectKey,
    syncStarted,
  };
}
