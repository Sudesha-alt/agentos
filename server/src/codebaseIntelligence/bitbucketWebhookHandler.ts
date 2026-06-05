import crypto from "node:crypto";
import type { Request, Response } from "express";
import { getGitWebhookSecret } from "../git-integration/gitCredentialsStore";
import { getRepoContext } from "../git-integration/gitCredentialsStore";
import { enqueueCodebaseIndexFromPush } from "./pushWebhookHandler";

type BitbucketPushPayload = {
  push?: {
    changes?: Array<{
      new?: { name?: string; target?: { hash?: string } };
      commits?: Array<{
        hash?: string;
        message?: string;
        date?: string;
        author?: { user?: { display_name?: string }; raw?: string };
      }>;
    }>;
  };
  repository?: { full_name?: string };
  actor?: { display_name?: string };
};

function verifySignature(req: Request): boolean {
  const secret = getGitWebhookSecret("bitbucket");
  if (!secret) return true;
  const sig = req.header("x-hub-signature");
  if (!sig) return false;
  const body = (req as Request & { rawBody?: string }).rawBody ?? "";
  const digest = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const expected = sig.startsWith("sha256=") ? sig.slice(7) : sig;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(digest));
  } catch {
    return false;
  }
}

export async function handleBitbucketWebhook(
  req: Request,
  res: Response
): Promise<void> {
  if (!verifySignature(req)) {
    res.status(401).json({ error: "invalid_signature" });
    return;
  }

  const event = req.header("x-event-key");
  if (event !== "repo:push") {
    res.status(202).json({ ok: true, ignored: event ?? "unknown" });
    return;
  }

  const payload = req.body as BitbucketPushPayload;
  const change = payload.push?.changes?.[0];
  const branchName = change?.new?.name ?? "main";
  const headSha = change?.new?.target?.hash ?? "";
  const ctx = getRepoContext();

  const commits =
    change?.commits?.map((c) => ({
      sha: c.hash ?? "",
      message: c.message ?? "",
      author: c.author?.user?.display_name ?? c.author?.raw ?? "unknown",
      authoredAt: c.date ? new Date(c.date) : new Date(),
      added: [] as string[],
      modified: [] as string[],
      removed: [] as string[],
    })) ?? [];

  await enqueueCodebaseIndexFromPush({
    repoOwner: ctx.workspace,
    repoName: ctx.repoSlug,
    branchName,
    headSha,
    pushedBy: payload.actor?.display_name ?? "unknown",
    changedFiles: [],
    deletedFiles: [],
    commits,
  });

  res.status(202).json({ ok: true, note: "bitbucket push queued; file lists may be empty until full index" });
}
