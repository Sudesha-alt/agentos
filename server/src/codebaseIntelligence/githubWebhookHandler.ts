import crypto from "node:crypto";
import type { Request, Response } from "express";
import { getGitWebhookSecret } from "../git-integration/gitCredentialsStore";
import { enqueueCodebaseIndexFromPush } from "./pushWebhookHandler";
import { logger } from "../utils/logger";

type PushWebhookPayload = {
  ref?: string;
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

function verifySignature(req: Request): boolean {
  const secret = getGitWebhookSecret("github");
  if (!secret) return true;
  const sig = req.header("x-hub-signature-256");
  if (!sig) return false;
  const body = (req as Request & { rawBody?: string }).rawBody ?? "";
  const digest = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex")}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(digest));
  } catch {
    return false;
  }
}

function parseBranch(ref?: string): string {
  if (!ref) return "main";
  return ref.replace("refs/heads/", "");
}

async function processGithubPush(req: Request): Promise<void> {
  const payload = req.body as PushWebhookPayload;
  const branchName = parseBranch(payload.ref);
  const repoOwner = payload.repository?.owner?.login ?? process.env.GITHUB_REPO_OWNER ?? "";
  const repoName = payload.repository?.name ?? process.env.GITHUB_REPO_NAME ?? "";
  const headSha = payload.after ?? "";
  const commits = payload.commits ?? [];

  const changedFiles = Array.from(
    new Set(commits.flatMap((commit) => [...(commit.added ?? []), ...(commit.modified ?? [])]))
  );
  const deletedFiles = Array.from(
    new Set(commits.flatMap((commit) => commit.removed ?? []))
  );

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
  });
}

export async function handleGithubWebhook(req: Request, res: Response): Promise<void> {
  if (!verifySignature(req)) {
    res.status(401).json({ error: "invalid_signature" });
    return;
  }

  const event = req.header("x-github-event");
  if (event !== "push") {
    res.status(202).json({ ok: true, ignored: event ?? "unknown" });
    return;
  }

  // Fast ack — queue processing runs after response (two-layer webhook pattern).
  res.status(202).json({ ok: true, queued: true });

  void processGithubPush(req).catch((err) => {
    logger.error({ err }, "github webhook async processing failed");
  });
}
