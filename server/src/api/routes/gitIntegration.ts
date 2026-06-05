import { Router, type Request } from "express";
import { connectGit } from "../../git-integration/connectGit";
import {
  getPublicGitCredentials,
  validateGitConfig,
} from "../../git-integration/gitCredentialsStore";
import type { GitProviderId } from "../../integrations/git/types";

const router = Router();

function publicApiBase(req: Request): string {
  if (process.env.PUBLIC_API_URL?.trim()) {
    return process.env.PUBLIC_API_URL.replace(/\/$/, "");
  }
  const proto = req.header("x-forwarded-proto") || req.protocol || "https";
  const host = req.header("x-forwarded-host") || req.get("host") || "localhost:4000";
  return `${proto}://${host}`;
}

router.get("/integration/setup", (req, res) => {
  const base = publicApiBase(req);
  const git = getPublicGitCredentials();
  let connected = false;
  try {
    validateGitConfig();
    connected = true;
  } catch {
    connected = false;
  }

  res.json({
    publicApiBase: base,
    git,
    connected,
    webhooks: {
      github: {
        url: `${base}/webhooks/github`,
        events: ["push"],
        secretEnv: "GITHUB_WEBHOOK_SECRET",
      },
      bitbucket: {
        url: `${base}/webhooks/bitbucket`,
        events: ["repo:push"],
        secretEnv: "BITBUCKET_WEBHOOK_SECRET",
      },
    },
    providers: [
      {
        id: "github",
        label: "GitHub",
        workspaceLabel: "Owner (org or user)",
        repoLabel: "Repository name",
        tokenLabel: "Personal access token (repo scope)",
        needsUsername: false,
      },
      {
        id: "bitbucket",
        label: "Bitbucket",
        workspaceLabel: "Workspace slug",
        repoLabel: "Repository slug",
        tokenLabel: "App password (repository read)",
        needsUsername: true,
      },
    ],
  });
});

router.post("/integration/connect", async (req, res, next) => {
  const provider = String(req.body?.provider ?? "").trim() as GitProviderId;
  const workspace = String(req.body?.workspace ?? "").trim();
  const repoSlug = String(req.body?.repoSlug ?? "").trim();
  const username = req.body?.username ? String(req.body.username).trim() : undefined;
  const token = req.body?.token ? String(req.body.token).trim() : undefined;
  const webhookSecret = req.body?.webhookSecret
    ? String(req.body.webhookSecret).trim()
    : undefined;
  const defaultBranch = req.body?.defaultBranch
    ? String(req.body.defaultBranch).trim()
    : undefined;

  if (!provider || (provider !== "github" && provider !== "bitbucket")) {
    res.status(400).json({ error: "provider must be github or bitbucket" });
    return;
  }
  if (!workspace || !repoSlug) {
    res.status(400).json({ error: "workspace and repoSlug are required" });
    return;
  }

  try {
    const result = await connectGit({
      provider,
      workspace,
      repoSlug,
      username,
      token,
      webhookSecret,
      defaultBranch,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
