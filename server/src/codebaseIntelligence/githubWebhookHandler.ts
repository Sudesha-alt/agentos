import crypto from "node:crypto";
import type { Request, Response } from "express";
import { prisma } from "../db/client";
import { JOB_NAMES, codebaseQueue } from "../queue/jobQueue";
import { logger } from "../utils/logger";
const prismaAny = prisma as any;

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
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return true;
  const sig = req.header("x-hub-signature-256");
  if (!sig) return false;
  const body = (req as Request & { rawBody?: string }).rawBody ?? "";
  const digest = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex")}`;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(digest));
}

function parseBranch(ref?: string): string {
  if (!ref) return "main";
  return ref.replace("refs/heads/", "");
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

  await prismaAny.branchState.upsert({
    where: {
      repoOwner_repoName_branchName: {
        repoOwner,
        repoName,
        branchName,
      },
    },
    create: {
      repoOwner,
      repoName,
      branchName,
      sourceBranch: "main",
      createdBy: "human",
      headSha,
      filesChanged: changedFiles,
      lastPushAt: new Date(),
      lastPushBy: payload.sender?.login ?? "unknown",
    },
    update: {
      headSha,
      filesChanged: changedFiles,
      lastPushAt: new Date(),
      lastPushBy: payload.sender?.login ?? "unknown",
    },
  });

  for (const commit of commits) {
    if (!commit.id) continue;
    await prismaAny.commitHistory.upsert({
      where: {
        repoOwner_repoName_sha: {
          repoOwner,
          repoName,
          sha: commit.id,
        },
      },
      create: {
        repoOwner,
        repoName,
        branchName,
        sha: commit.id,
        message: commit.message ?? "",
        author: commit.author?.name ?? "unknown",
        authoredAt: commit.timestamp ? new Date(commit.timestamp) : new Date(),
        filesAdded: commit.added ?? [],
        filesModified: commit.modified ?? [],
        filesDeleted: commit.removed ?? [],
        pushedBy: payload.sender?.login ?? "unknown",
      },
      update: {},
    });
  }

  await codebaseQueue.add(JOB_NAMES.RUN_CODEBASE_INCREMENTAL, {
    branchName,
    changedFiles,
    deletedFiles,
    commitSha: headSha,
    triggerType: "webhook",
  });

  logger.info(
    { branchName, changedCount: changedFiles.length, deletedCount: deletedFiles.length },
    "queued codebase incremental index"
  );
  res.status(202).json({ ok: true });
}
