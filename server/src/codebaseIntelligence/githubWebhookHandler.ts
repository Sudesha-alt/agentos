import crypto from "node:crypto";
import type { Request, Response } from "express";
import { prisma } from "../db/client";
import { withOrganizationContext } from "../api/orgRequestContext";
import {
  resolveOrganizationByGithubInstallation,
  resolveOrganizationByGitWebhookSecret,
} from "../organization/webhookResolver";
import { enqueueCodebaseIndexFromPush } from "./pushWebhookHandler";
import {
  listPullRequestChangedFiles,
  resolveWebhookChangedFiles,
} from "./webhookIndexHelpers";
import { logger } from "../utils/logger";

type PushWebhookPayload = {
  ref?: string;
  before?: string;
  after?: string;
  compare?: string;
  sender?: { login?: string };
  repository?: { name?: string; owner?: { login?: string } };
  commits?: Array<{
    id?: string;
    message?: string;
    timestamp?: string;
    author?: { name?: string };
    added?: string[];
    modified?: string[];
    removed?: string[];
  }>;
};

type PullRequestPayload = {
  action?: string;
  number?: number;
  pull_request?: {
    merged?: boolean;
    merge_commit_sha?: string | null;
    base?: { ref?: string };
    head?: { sha?: string };
  };
  repository?: { name?: string; owner?: { login?: string } };
  sender?: { login?: string };
};

async function resolveGithubWebhookOrganization(req: Request): Promise<string | null> {
  const body = req.body as { installation?: { id?: number } };
  if (body.installation?.id) {
    const orgId = await resolveOrganizationByGithubInstallation(String(body.installation.id));
    if (orgId) return orgId;
  }

  const sig = req.header("x-hub-signature-256");
  const rawBody = (req as Request & { rawBody?: string }).rawBody ?? "";
  if (!sig || !rawBody) return null;

  const configs = await prisma.organizationGitConfig.findMany({
    where: { webhookSecret: { not: "" }, provider: "github" },
    select: { organizationId: true, webhookSecret: true },
  });

  for (const config of configs) {
    const digest = `sha256=${crypto
      .createHmac("sha256", config.webhookSecret)
      .update(rawBody)
      .digest("hex")}`;
    try {
      if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(digest))) {
        return config.organizationId;
      }
    } catch {
      continue;
    }
  }

  const legacySecret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
  if (legacySecret) {
    const digest = `sha256=${crypto
      .createHmac("sha256", legacySecret)
      .update(rawBody)
      .digest("hex")}`;
    try {
      if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(digest))) {
        return resolveOrganizationByGitWebhookSecret("github", legacySecret);
      }
    } catch {
      /* ignore */
    }
  }

  return null;
}

function verifySignature(req: Request, organizationId: string | null): boolean {
  if (!organizationId) return false;
  return true;
}

function parseBranch(ref?: string): string {
  if (!ref) return "main";
  return ref.replace("refs/heads/", "");
}

async function processGithubPush(req: Request): Promise<void> {
  const payload = req.body as PushWebhookPayload;
  const branchName = parseBranch(payload.ref);
  const repoOwner = payload.repository?.owner?.login ?? "";
  const repoName = payload.repository?.name ?? "";
  if (!repoOwner || !repoName) {
    logger.warn("github push webhook missing repository owner/name");
    return;
  }
  const headSha = payload.after ?? "";
  const beforeSha = payload.before ?? "";
  const commits = payload.commits ?? [];

  let changedFiles = Array.from(
    new Set(commits.flatMap((commit) => [...(commit.added ?? []), ...(commit.modified ?? [])]))
  );
  let deletedFiles = Array.from(
    new Set(commits.flatMap((commit) => commit.removed ?? []))
  );

  const resolved = await resolveWebhookChangedFiles({
    provider: "github",
    owner: repoOwner,
    repo: repoName,
    beforeSha,
    afterSha: headSha,
    webhookChanged: changedFiles,
    webhookDeleted: deletedFiles,
    commitCount: commits.length,
  });
  changedFiles = resolved.changedFiles;
  deletedFiles = resolved.deletedFiles;

  await enqueueCodebaseIndexFromPush({
    repoOwner,
    repoName,
    branchName,
    headSha,
    pushedBy: payload.sender?.login ?? "unknown",
    changedFiles,
    deletedFiles,
    commits: commits
      .filter((c) => c.id)
      .map((c) => ({
        sha: c.id!,
        message: c.message ?? "",
        author: c.author?.name ?? "unknown",
        authoredAt: c.timestamp ? new Date(c.timestamp) : new Date(),
        added: c.added ?? [],
        modified: c.modified ?? [],
        removed: c.removed ?? [],
      })),
    triggerSource: "push",
  });
}

async function processGithubPullRequestMerged(req: Request): Promise<void> {
  const payload = req.body as PullRequestPayload;
  const pr = payload.pull_request;
  if (!pr?.merged) return;

  const repoOwner = payload.repository?.owner?.login ?? "";
  const repoName = payload.repository?.name ?? "";
  const branchName = pr.base?.ref ?? "main";
  const headSha = pr.merge_commit_sha ?? pr.head?.sha ?? "";
  const prNumber = payload.number ?? 0;

  const { changedFiles, deletedFiles } = await listPullRequestChangedFiles({
    owner: repoOwner,
    repo: repoName,
    pullNumber: prNumber,
  });

  await enqueueCodebaseIndexFromPush({
    repoOwner,
    repoName,
    branchName,
    headSha,
    pushedBy: payload.sender?.login ?? "unknown",
    changedFiles,
    deletedFiles,
    commits: headSha
      ? [
          {
            sha: headSha,
            message: `Merged PR #${prNumber}`,
            author: payload.sender?.login ?? "unknown",
            authoredAt: new Date(),
            added: changedFiles,
            modified: [],
            removed: deletedFiles,
          },
        ]
      : [],
    triggerSource: "pr_merge",
    prNumber,
  });
}

export async function handleGithubWebhook(req: Request, res: Response): Promise<void> {
  const organizationId = await resolveGithubWebhookOrganization(req);
  if (!verifySignature(req, organizationId)) {
    res.status(401).json({ error: "invalid_signature" });
    return;
  }

  const event = req.header("x-github-event");

  if (event === "push") {
    res.status(202).json({ ok: true, queued: true });
    void withOrganizationContext(organizationId!, () => processGithubPush(req)).catch((err) => {
      logger.error({ err, organizationId }, "github push webhook async processing failed");
    });
    return;
  }

  if (event === "pull_request") {
    const action = (req.body as PullRequestPayload).action;
    const merged = (req.body as PullRequestPayload).pull_request?.merged;
    if (action === "closed" && merged) {
      res.status(202).json({ ok: true, queued: true, event: "pull_request_merged" });
      void withOrganizationContext(organizationId!, () =>
        processGithubPullRequestMerged(req)
      ).catch((err) => {
        logger.error({ err, organizationId }, "github PR merge webhook async processing failed");
      });
      return;
    }
    res.status(202).json({ ok: true, ignored: `pull_request:${action}` });
    return;
  }

  res.status(202).json({ ok: true, ignored: event ?? "unknown" });
}
