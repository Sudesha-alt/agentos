import { Router, type Request } from "express";
import { connectGit } from "../../git-integration/connectGit";
import {
  completeGithubInstallation,
  selectGithubRepository,
} from "../../git-integration/githubInstall";
import {
  getIndexRunById,
  getLatestIndexRun,
  indexRunProgress,
} from "../../codebaseIntelligence/indexQueue";
import {
  getPublicGitCredentials,
  validateGitConfig,
} from "../../git-integration/gitCredentialsStore";
import {
  githubAppInstallUrl,
  githubAppPublicConfig,
  isGithubAppConfigured,
} from "../../integrations/git/githubApp";
import { validateOAuthState } from "../../git-integration/oauthState";
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

function frontendGitUrl(): string {
  const configured = process.env.FRONTEND_URL?.trim();
  if (configured) return configured.replace(/\/$/, "") + "/app/git";
  return "";
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

  const needsRepoSelection =
    git.authMethod === "github_app" &&
    Boolean(git.installationId) &&
    (!git.workspace || !git.repoSlug);

  const githubApp = githubAppPublicConfig();
  const installUrl = githubAppInstallUrl();
  const callbackUrl = `${base}/git-integration/oauth/github/callback`;

  res.json({
    publicApiBase: base,
    git,
    connected,
    needsRepoSelection,
    githubApp: {
      ...githubApp,
      installUrl,
      callbackUrl,
      setupUrl: frontendGitUrl() || undefined,
      webhookUrl: `${base}/webhooks/github`,
    },
    webhooks: {
      github: {
        url: `${base}/webhooks/github`,
        events: ["push", "pull_request"],
        secretEnv: "GITHUB_APP_WEBHOOK_SECRET",
        managedByApp: isGithubAppConfigured(),
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
        connectMode: isGithubAppConfigured() ? "github_app" : "pat",
        workspaceLabel: "Owner (org or user)",
        repoLabel: "Repository name",
        tokenLabel: "Personal access token (repo scope)",
        needsUsername: false,
      },
      {
        id: "bitbucket",
        label: "Bitbucket",
        connectMode: "pat",
        workspaceLabel: "Workspace slug",
        repoLabel: "Repository slug",
        tokenLabel: "App password (repository read)",
        needsUsername: true,
      },
    ],
  });
});

router.get("/oauth/github/install", (_req, res) => {
  const url = githubAppInstallUrl();
  if (!url) {
    res.status(503).json({
      error: "github_app_not_configured",
      message: "Set GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, and GITHUB_APP_SLUG on the server.",
    });
    return;
  }
  res.redirect(url);
});

router.get("/oauth/github/callback", (req, res) => {
  const installationId = String(req.query.installation_id ?? "");
  const setupAction = String(req.query.setup_action ?? "");
  const state = String(req.query.state ?? "");
  const frontend = frontendGitUrl();

  if (state && !validateOAuthState(state)) {
    if (frontend) {
      res.redirect(`${frontend}?github_error=invalid_state`);
      return;
    }
    res.status(400).json({ error: "invalid_oauth_state" });
    return;
  }

  if (frontend) {
    const params = new URLSearchParams();
    if (installationId) params.set("installation_id", installationId);
    if (setupAction) params.set("setup_action", setupAction);
    params.set("provider", "github");
    res.redirect(`${frontend}?${params.toString()}`);
    return;
  }

  res.json({
    ok: true,
    installationId: installationId || null,
    setupAction: setupAction || null,
    hint: "Set FRONTEND_URL on the server to redirect back to the app after install.",
  });
});

router.post("/github/complete-install", async (req, res, next) => {
  try {
    const installationId = String(req.body?.installationId ?? "");
    const result = await completeGithubInstallation(installationId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/github/select-repo", async (req, res, next) => {
  try {
    const result = await selectGithubRepository({
      installationId: String(req.body?.installationId ?? ""),
      owner: String(req.body?.owner ?? ""),
      repo: String(req.body?.repo ?? ""),
      defaultBranch: req.body?.defaultBranch
        ? String(req.body.defaultBranch)
        : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/index/status", async (req, res, next) => {
  try {
    const runId = typeof req.query.runId === "string" ? req.query.runId : undefined;
    const branchName =
      typeof req.query.branch === "string" ? req.query.branch : undefined;
    const run = runId
      ? await getIndexRunById(runId)
      : await getLatestIndexRun({ branchName });
    if (!run) {
      res.json({ active: false, progress: null });
      return;
    }
    res.json({
      active: !indexRunProgress(run).done,
      runId: run.id,
      branchName: run.branchName,
      progress: indexRunProgress(run),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/index/progress", async (req, res) => {
  const runId = typeof req.query.runId === "string" ? req.query.runId : undefined;
  const branchName =
    typeof req.query.branch === "string" ? req.query.branch : undefined;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  const send = (payload: unknown) => {
    if (closed) return;
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const poll = async () => {
    try {
      const run = runId
        ? await getIndexRunById(runId)
        : await getLatestIndexRun({ branchName });
      if (!run) {
        send({ active: false, progress: null });
        res.end();
        return;
      }
      const progress = indexRunProgress(run);
      send({
        active: !progress.done,
        runId: run.id,
        branchName: run.branchName,
        progress,
      });
      if (progress.done) {
        res.end();
        return;
      }
      if (!closed) setTimeout(poll, 1500);
    } catch (err) {
      send({
        error: err instanceof Error ? err.message : "progress_poll_failed",
      });
      res.end();
    }
  };

  void poll();
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
