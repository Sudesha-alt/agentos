import { Router, type Request } from "express";
import { connectGit } from "../../git-integration/connectGit";
import {
  completeGithubInstallation,
  selectGithubRepository,
} from "../../git-integration/githubInstall";
import {
  enqueueFullIndex,
  getIndexRunById,
  getLatestIndexRun,
  indexRunProgress,
} from "../../codebaseIntelligence/indexQueue";
import { getRepoContext } from "../../git-integration/gitCredentialsStore";
import {
  githubAppInstallUrl,
  githubAppPublicConfig,
  isGithubAppConfigured,
  listAppInstallations,
  probeGithubAppCredentials,
} from "../../integrations/git/githubApp";
import { resolveGitIntegrationSetupState } from "../../git-integration/gitSetupState";
import { getLatestGithubInstallState } from "../../git-integration/githubInstallationStore";
import { parseOAuthState, createOAuthState } from "../../git-integration/oauthState";
import { getPublicOrganizationGitConfig } from "../../organization/gitConfigStore";
import {
  requireOrganizationUser,
  withOrganizationContext,
} from "../orgRequestContext";
import { logger } from "../../utils/logger";
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

function frontendBaseUrl(): string {
  const configured = process.env.FRONTEND_URL?.trim();
  if (!configured) return "";
  let base = configured.replace(/\/$/, "");
  base = base.replace(/\/app(\/git)?$/i, "");
  return base;
}

function frontendGitUrl(): string {
  const base = frontendBaseUrl();
  return base ? `${base}/app/settings/integrations/github` : "";
}

router.get("/integration/setup", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      const git = await getPublicOrganizationGitConfig(user.organizationId!);
      const setupState = await resolveGitIntegrationSetupState(git, {
        orgScoped: true,
        organizationId: user.organizationId!,
      });
      const { connected, needsRepoSelection, availableRepositories } = setupState;

      const base = publicApiBase(req);
      const githubApp = githubAppPublicConfig();
      const installUrl = githubAppInstallUrl();
      const callbackUrl = `${base}/git-integration/oauth/github/callback`;

      res.json({
        publicApiBase: base,
        git: setupState.git,
        connected,
        needsRepoSelection,
        installationDetected: setupState.installationDetected,
        accountLogin: setupState.accountLogin,
        databaseConfigured: Boolean(process.env.DATABASE_URL?.trim()),
        availableRepositories,
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
  } catch (err) {
    next(err);
  }
});

router.get("/integration/diagnostics", async (_req, res, next) => {
  try {
    const githubProbe = isGithubAppConfigured()
      ? await probeGithubAppCredentials()
      : { ok: false, error: "github_app_not_configured" };

    let githubInstallations: Awaited<ReturnType<typeof listAppInstallations>> = [];
    if (githubProbe.ok) {
      try {
        githubInstallations = await listAppInstallations();
      } catch (err) {
        logger.warn({ err }, "list github app installations failed");
      }
    }

    let databaseOk = false;
    let databaseError: string | null = null;
    let latestInstallation: {
      installationId: string;
      accountLogin: string;
      selectedRepoOwner: string | null;
      selectedRepoName: string | null;
    } | null = null;

    if (process.env.DATABASE_URL?.trim()) {
      try {
        const row = await getLatestGithubInstallState();
        databaseOk = true;
        latestInstallation = row
          ? {
              installationId: row.installationId,
              accountLogin: row.accountLogin,
              selectedRepoOwner: row.selectedRepoOwner,
              selectedRepoName: row.selectedRepoName,
            }
          : null;
      } catch (err) {
        databaseError = err instanceof Error ? err.message : "database_error";
      }
    }

    res.json({
      githubAppConfigured: isGithubAppConfigured(),
      githubApiReachable: githubProbe.ok,
      githubApiError: githubProbe.error ?? null,
      githubAppName: githubProbe.appName ?? null,
      githubInstallationsOnGitHub: githubInstallations.map((row) => ({
        id: row.id,
        accountLogin: row.accountLogin,
        repositorySelection: row.repositorySelection,
      })),
      databaseConfigured: Boolean(process.env.DATABASE_URL?.trim()),
      databaseReachable: databaseOk,
      databaseError,
      frontendUrlConfigured: Boolean(process.env.FRONTEND_URL?.trim()),
      frontendGitUrl: frontendGitUrl() || null,
      corsOrigin: process.env.CORS_ORIGIN ?? "*",
      latestInstallation,
      hints: [
        !process.env.FRONTEND_URL?.trim()
          ? "Set FRONTEND_URL=https://agentos-inky.vercel.app on Render"
          : null,
        !githubProbe.ok
          ? "Fix GITHUB_APP_ID + GITHUB_APP_PRIVATE_KEY (PEM with literal \\n newlines on Render)"
          : null,
        githubProbe.ok &&
        githubInstallations.length > 0 &&
        !latestInstallation
          ? "GitHub has installations but Postgres is empty — POST /github/complete-install with installation id"
          : null,
        githubProbe.ok && githubInstallations.length === 0
          ? "No GitHub App installations found — click Connect with GitHub in the app"
          : null,
      ].filter(Boolean),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/oauth/github/install-url", async (req, res) => {
  const user = requireOrganizationUser(req, res);
  if (!user?.organizationId) return;

  const url = githubAppInstallUrl(createOAuthState(user.organizationId));
  if (!url) {
    res.status(503).json({
      error: "github_app_not_configured",
      message: "Set GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, and GITHUB_APP_SLUG on the server.",
    });
    return;
  }
  res.json({ url });
});

router.get("/oauth/github/install", async (req, res) => {
  const user = requireOrganizationUser(req, res);
  const state = user?.organizationId ? createOAuthState(user.organizationId) : undefined;
  const url = githubAppInstallUrl(state);
  if (!url) {
    res.status(503).json({
      error: "github_app_not_configured",
      message: "Set GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, and GITHUB_APP_SLUG on the server.",
    });
    return;
  }
  res.redirect(url);
});

router.get("/oauth/github/callback", async (req, res) => {
  const installationId = String(req.query.installation_id ?? "");
  const setupAction = String(req.query.setup_action ?? "");
  const state = String(req.query.state ?? "");
  const frontend = frontendGitUrl();
  const parsedState = state ? parseOAuthState(state) : { valid: false as const };
  const stateInvalid = Boolean(state && !parsedState.valid);

  if (stateInvalid) {
    logger.warn(
      { installationId: installationId || null },
      "github oauth callback state invalid — continuing when installation_id present"
    );
    if (!installationId) {
      if (frontend) {
        res.redirect(`${frontend}?github_error=invalid_state`);
        return;
      }
      res.status(400).json({ error: "invalid_oauth_state" });
      return;
    }
  }

  let installError: string | null = null;
  if (installationId) {
    try {
      await completeGithubInstallation(
        installationId,
        parsedState.valid ? parsedState.organizationId : undefined
      );
    } catch (err) {
      installError =
        err instanceof Error ? err.message : "GitHub install could not be saved";
      logger.warn({ err, installationId }, "github oauth callback complete-install failed");
    }
  }

  if (frontend) {
    const params = new URLSearchParams();
    if (installationId) params.set("installation_id", installationId);
    if (setupAction) params.set("setup_action", setupAction);
    params.set("provider", "github");
    if (installError) params.set("github_error", "install_failed");
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

router.post("/github/sync-install", async (req, res) => {
  try {
    const installations = await listAppInstallations();
    if (!installations.length) {
      res.status(404).json({
        error: "no_github_installations",
        message: "No GitHub App installations found. Install the app from /app/git first.",
      });
      return;
    }
    const requested = req.body?.installationId
      ? String(req.body.installationId)
      : String(installations[0]!.id);
    const result = await completeGithubInstallation(requested);
    res.json({ synced: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync_install_failed";
    logger.warn({ err }, "github sync-install failed");
    res.status(502).json({ error: "github_sync_install_failed", message });
  }
});

router.post("/github/complete-install", async (req, res) => {
  const user = requireOrganizationUser(req, res);
  if (!user?.organizationId) return;

  const installationId = String(req.body?.installationId ?? "");
  if (!installationId.trim()) {
    res.status(400).json({
      error: "installation_id_required",
      message: "installationId is required",
    });
    return;
  }
  try {
    const result = await completeGithubInstallation(installationId, user.organizationId);
    const git = await getPublicOrganizationGitConfig(user.organizationId);
    const setupState = await resolveGitIntegrationSetupState(git, {
      orgScoped: true,
      organizationId: user.organizationId,
    });
    res.json({
      ...result,
      connected: setupState.connected,
      needsRepoSelection: setupState.needsRepoSelection,
      installationDetected: setupState.installationDetected,
      accountLogin: setupState.accountLogin,
      availableRepositories: setupState.availableRepositories,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "complete_install_failed";
    logger.warn({ err, installationId }, "github complete-install failed");
    res.status(502).json({
      error: "github_complete_install_failed",
      message,
    });
  }
});

router.post("/integration/disconnect", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    const { clearOrganizationGitConfig } = await import(
      "../../organization/gitConfigStore"
    );
    const { unlinkGithubInstallationFromOrganization } = await import(
      "../../git-integration/githubInstallationStore"
    );
    await clearOrganizationGitConfig(user.organizationId);
    await unlinkGithubInstallationFromOrganization(user.organizationId);
    res.json({
      ok: true,
      message:
        "Git integration disconnected for your workspace. Indexed codebase data is kept; uninstall the GitHub App on GitHub if you want to revoke access entirely.",
    });
  } catch (err) {
    next(err);
  }
});

router.post("/github/select-repo", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    const result = await selectGithubRepository({
      installationId: String(req.body?.installationId ?? ""),
      owner: String(req.body?.owner ?? ""),
      repo: String(req.body?.repo ?? ""),
      defaultBranch: req.body?.defaultBranch
        ? String(req.body.defaultBranch)
        : undefined,
      organizationId: user.organizationId,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Fetch entire repo from GitHub → AI summaries → Postgres + vector embeddings → graph cache. */
router.post("/index/full", async (req, res) => {
  try {
    const ctx = getRepoContext();
    const branchName =
      typeof req.body?.branch === "string" && req.body.branch.trim()
        ? req.body.branch.trim()
        : ctx.defaultBranch;
    const result = await enqueueFullIndex(branchName, "manual");
    res.json({
      ok: true,
      branchName,
      repo: `${ctx.workspace}/${ctx.repoSlug}`,
      runId: result.runId,
      queued: result.queued,
      message: "Full index started in-process on the API server",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "index_enqueue_failed";
    res.status(400).json({ error: "index_enqueue_failed", message });
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
  const user = requireOrganizationUser(req, res);
  if (!user?.organizationId) return;

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
      organizationId: user.organizationId,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
