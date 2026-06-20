import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  completeGithubInstall,
  connectGitIntegration,
  disconnectGitIntegration,
  selectGithubRepository,
  startGithubAppInstall,
  useGitIntegrationSetup,
} from "../../entities/git-integration";
import { DATA_MODE, DATA_MODES } from "../../shared/config/app";
import EmptyState from "../components/EmptyState";
import GitHubSetupGuideWidget from "../../widgets/github-setup-guide/GitHubSetupGuideWidget";
import IndexProgressBar from "../../widgets/index-progress/IndexProgressBar";
import LabelPill from "../components/LabelPill";
import Spinner from "../components/Spinner";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";
import { SettingsPageShell } from "../layout/SettingsPageShell";
import { useOrg } from "../../shared/providers/OrgRouteProvider";

export default function GitIntegration({ embedded = false }) {
  const { data: setup, error, loading, refetch } = useGitIntegrationSetup();

  if (loading && !setup) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error && DATA_MODE !== DATA_MODES.MOCK) {
    return (
      <EmptyState
        title="Cannot reach API"
        body="Set VITE_API_URL on Vercel to your Render URL and redeploy."
      />
    );
  }

  if (error && !setup) {
    return (
      <EmptyState
        title="Git integration unavailable"
        body="Could not load integration setup. Check the server or switch to mock mode for local UI development."
      />
    );
  }

  return (
    <GitIntegrationContent setup={setup} refetch={refetch} embedded={embedded} />
  );
}

function GitIntegrationContent({ setup, refetch, embedded = false }) {
  const { orgPath } = useOrg();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState("github");
  const [repos, setRepos] = useState(() => setup?.availableRepositories ?? []);
  const [pendingInstallationId, setPendingInstallationId] = useState(
    () => setup?.git?.installationId ?? ""
  );
  const [selectedRepo, setSelectedRepo] = useState("");
  const [installPending, setInstallPending] = useState(false);
  const [selectPending, setSelectPending] = useState(false);
  const [disconnectPending, setDisconnectPending] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  const [err, setErr] = useState(() => {
    const code = searchParams.get("github_error");
    if (code === "invalid_state") {
      return "GitHub install session expired or was invalid. Try Connect with GitHub again.";
    }
    if (code === "install_failed") {
      return "GitHub App installed on GitHub, but the server could not save it. Check Render DATABASE_URL and that GithubInstallation exists in Supabase, then try again.";
    }
    return "";
  });
  const [status, setStatus] = useState("");
  const [indexRunId, setIndexRunId] = useState(null);
  const clearedGithubError = useRef(false);

  const githubApp = setup?.githubApp;
  const githubAppEnabled = Boolean(githubApp?.configured && githubApp?.installUrl);
  const git = setup?.git;
  const connected = Boolean(setup?.connected);
  const accountLogin = setup?.accountLogin ?? git?.workspace ?? null;
  const activeInstallationId = pendingInstallationId || git?.installationId || "";
  const isGithubApp =
    git?.authMethod === "github_app" || Boolean(activeInstallationId && tab === "github");
  const installationDetected = Boolean(setup?.installationDetected);
  const needsRepoPick =
    Boolean(setup?.needsRepoSelection) ||
    Boolean(installationDetected && !connected) ||
    (isGithubApp &&
      Boolean(activeInstallationId) &&
      (!git?.workspace || !git?.repoSlug));
  const installPendingFinish = installationDetected && !connected;

  useEffect(() => {
    if (connected) {
      setDisconnected(false);
    }
  }, [connected]);

  useEffect(() => {
    if (clearedGithubError.current) return;
    if (!searchParams.get("github_error")) return;
    clearedGithubError.current = true;
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (setup?.git?.installationId) {
      setPendingInstallationId(setup.git.installationId);
    }
    if (setup?.availableRepositories?.length) {
      setRepos(setup.availableRepositories);
    }
  }, [setup?.git?.installationId, setup?.availableRepositories]);

  useEffect(() => {
    const installationId = searchParams.get("installation_id");
    const provider = searchParams.get("provider");
    if (!installationId) return;
    // GitHub App redirects only include installation_id; provider is optional (server callback adds it).
    if (provider && provider !== "github") return;

    let cancelled = false;
    (async () => {
      setInstallPending(true);
      setErr("");
      try {
        const result = await completeGithubInstall(installationId);
        if (cancelled) return;
        setPendingInstallationId(installationId);
        setRepos(result.repositories ?? result.availableRepositories ?? []);
        if (result.autoSelected?.fullName) {
          setStatus(
            `Connected to ${result.autoSelected.fullName}. Initial codebase index started.`
          );
          if (result.autoSelected.indexRunId) {
            setIndexRunId(result.autoSelected.indexRunId);
          }
        } else if ((result.repositories ?? result.availableRepositories ?? []).length > 0) {
          setStatus("GitHub App installed — choose a repository below.");
        } else if (result.accountLogin) {
          setStatus(
            `GitHub App installed for ${result.accountLogin} — choose a repository below.`
          );
        } else {
          setStatus("GitHub App installed — grant repository access in GitHub if none appear below.");
        }
        setSearchParams({}, { replace: true });
        await refetch();
      } catch (e) {
        if (!cancelled) {
          setErr(formatGitIntegrationError(e));
        }
      } finally {
        if (!cancelled) setInstallPending(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, setSearchParams, refetch]);

  useEffect(() => {
    if (searchParams.get("installation_id")) return;
    if (!activeInstallationId || (git?.workspace && git?.repoSlug)) return;
    if (repos.length > 0 || installPending) return;

    let cancelled = false;
    (async () => {
      setInstallPending(true);
      setErr("");
      try {
        const result = await completeGithubInstall(activeInstallationId);
        if (cancelled) return;
        setRepos(result.repositories ?? []);
        if ((result.repositories ?? []).length === 0) {
          setStatus(
            "GitHub App is installed but no repositories were returned. Grant repo access in GitHub and click Reconfigure installation."
          );
        } else {
          setStatus("Select a repository to finish connecting.");
        }
      } catch (e) {
        if (!cancelled) {
          setErr(formatGitIntegrationError(e));
        }
      } finally {
        if (!cancelled) setInstallPending(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeInstallationId,
    git?.workspace,
    git?.repoSlug,
    repos.length,
    installPending,
    searchParams,
  ]);

  const connectedLabel = useMemo(() => {
    if (!connected || !git?.workspace || !git?.repoSlug) return null;
    return `${git.workspace}/${git.repoSlug}`;
  }, [connected, git?.workspace, git?.repoSlug]);

  const displayRepos = useMemo(() => {
    if (repos.length > 0) return repos;
    return setup?.availableRepositories ?? [];
  }, [repos, setup?.availableRepositories]);

  async function onDisconnect() {
    const confirmed = window.confirm(
      "Remove GitHub from this workspace? The app install, repository selection, and connection settings will be deleted. You will need to connect again."
    );
    if (!confirmed) return;

    setDisconnectPending(true);
    setErr("");
    setStatus("");
    try {
      await disconnectGitIntegration();
      setPendingInstallationId("");
      setSelectedRepo("");
      setRepos([]);
      setIndexRunId(null);
      setDisconnected(true);
      await refetch();
    } catch (e) {
      setErr(formatGitIntegrationError(e));
    } finally {
      setDisconnectPending(false);
    }
  }

  async function onSelectRepo() {
    const [owner, repo] = selectedRepo.split("/");
    if (!owner || !repo || !activeInstallationId) return;
    setSelectPending(true);
    setErr("");
    try {
      const result = await selectGithubRepository({
        installationId: activeInstallationId,
        owner,
        repo,
      });
      if (result.indexRunId) setIndexRunId(result.indexRunId);
      setStatus(
        `Connected to ${result.fullName}. Fetching and indexing the codebase in the background.`
      );
      await refetch();
    } catch (e) {
      setErr(formatGitIntegrationError(e));
    } finally {
      setSelectPending(false);
    }
  }

  return (
    <SettingsPageShell
      embedded={embedded}
      className="pb-16"
      kicker="GitHub integration"
      title={
        connected
          ? "GitHub connected"
          : needsRepoPick
            ? "Finish GitHub setup"
            : "Connect GitHub"
      }
    >
      {(connected || needsRepoPick) && !embedded ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {connected ? (
            <LabelPill label={connectedLabel ?? "Connected"} tone="success" />
          ) : installPendingFinish ? (
            <LabelPill label="App installed — select repo" tone="warning" />
          ) : needsRepoPick ? (
            <LabelPill label="Select repository" tone="warning" />
          ) : null}
          {accountLogin && !connected ? (
            <LabelPill label={`GitHub · ${accountLogin}`} tone="muted" />
          ) : null}
          {git?.installationId ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
              Install #{git.installationId}
            </span>
          ) : null}
        </div>
      ) : null}

      {(connected || indexRunId) && (
        <IndexProgressBar
          runId={indexRunId ?? undefined}
          branch={git?.defaultBranch ?? "main"}
          enabled={Boolean(connected || indexRunId)}
        />
      )}

      {disconnected && !connected ? (
        <div className="flex items-start gap-3 rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm">
          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-500">
            ✓
          </span>
          <div>
            <p className="font-medium text-app-ink">GitHub disconnected</p>
            <p className="mt-0.5 text-app-ink-dim">
              The integration was removed. Connect with GitHub again to install the app and pick a repository.
            </p>
          </div>
        </div>
      ) : null}

      {connected ? (
        <p className="text-[13px] text-ink-dim">
          Full index status, embedding counts, and reindex controls live in{" "}
          <Link to={orgPath("settings", "codebase-index")} className="font-medium text-indigo hover:underline">
            Settings → Codebase indexing
          </Link>
          .
        </p>
      ) : null}

      {setup?.databaseConfigured === false ? (
        <Panel>
          <PanelHeader
            kicker="Server config"
            title="DATABASE_URL is not set on the API"
            subtitle="GitHub installs cannot be saved without Postgres. Set DATABASE_URL on Render to your Supabase connection string, redeploy, then connect GitHub again."
          />
        </Panel>
      ) : null}

      <GitHubSetupGuideWidget
        connected={connected}
        webhookUrl={githubApp?.webhookUrl ?? setup?.webhooks?.github?.url}
        githubApp={githubApp}
        defaultOpen={!connected}
      />

      <div className="flex gap-2">
        <TabButton active={tab === "github"} onClick={() => setTab("github")}>
          GitHub
        </TabButton>
        <TabButton active={tab === "bitbucket"} onClick={() => setTab("bitbucket")}>
          Bitbucket
        </TabButton>
      </div>

      {tab === "github" ? (
        <>
          <Panel>
            <PanelHeader
              kicker={connected ? "Connected" : installPendingFinish ? "Installed" : "Step 1"}
              title="GitHub App"
              info={
                githubAppEnabled && !installPendingFinish
                  ? "Permissions: contents & pull requests (read/write), metadata, webhooks, actions (read). Webhooks are delivered to your API automatically."
                  : undefined
              }
              subtitle={
                installPendingFinish
                  ? "GitHub App installed — select a repository to finish connecting AgentOS to your codebase."
                  : !githubAppEnabled
                    ? "GitHub App env vars are not set on the server — use manual token setup below or configure GITHUB_APP_* on Render."
                    : undefined
              }
            />
            <div className="space-y-4 p-5 sm:p-6">
              {installPendingFinish && !status ? (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-ink">
                  GitHub App installed — select a repository below to finish setup.
                  {accountLogin ? (
                    <>
                      {" "}
                      Installed on{" "}
                      <span className="font-mono text-ink">{accountLogin}</span>.
                    </>
                  ) : null}
                </p>
              ) : null}
              {githubApp?.capabilities?.length ? (
                <ul className="grid gap-2 sm:grid-cols-2 text-sm text-muted">
                  {githubApp.capabilities.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}

              {!connected ? (
                <div className="flex flex-wrap items-center gap-3">
                  {accountLogin ? (
                    <p className="text-sm text-muted">
                      Installed on GitHub account{" "}
                      <span className="font-mono text-ink">{accountLogin}</span>
                      {activeInstallationId ? ` · #${activeInstallationId}` : ""}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={!githubAppEnabled || installPending}
                    onClick={() => {
                      setErr("");
                      startGithubAppInstall().catch((e) => {
                        setErr(formatGitIntegrationError(e));
                      });
                    }}
                    className="rounded-full bg-indigo px-8 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-white disabled:opacity-50"
                  >
                    {installPending ? "Finishing install…" : "Connect with GitHub"}
                  </button>
                  {needsRepoPick || setup?.installationDetected ? (
                    <button
                      type="button"
                      onClick={onDisconnect}
                      disabled={disconnectPending}
                      className="rounded-full border border-danger/40 px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-danger transition-opacity hover:bg-danger/5 disabled:opacity-50"
                    >
                      {disconnectPending ? "Disconnecting…" : "Disconnect GitHub"}
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setErr("");
                      startGithubAppInstall().catch((e) => {
                        setErr(formatGitIntegrationError(e));
                      });
                    }}
                    className="rounded-full border border-hairline px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-dim"
                  >
                    Reconfigure installation
                  </button>
                  <button
                    type="button"
                    onClick={onDisconnect}
                    disabled={disconnectPending}
                    className="rounded-full border border-danger/40 px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-danger transition-opacity hover:bg-danger/5 disabled:opacity-50"
                  >
                    {disconnectPending ? "Disconnecting…" : "Disconnect GitHub"}
                  </button>
                  {git?.authMethod === "github_app" ? (
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                      Auth: GitHub App
                      {git.installationId ? ` · #${git.installationId}` : ""}
                    </span>
                  ) : null}
                </div>
              )}

              {err ? <p className="font-mono text-[11px] text-danger">{err}</p> : null}
              {!disconnected && status ? <p className="text-sm text-success">{status}</p> : null}
            </div>
          </Panel>

          {needsRepoPick ? (
            <Panel>
              <PanelHeader
                kicker="Step 2"
                title="Select repository"
              />
              <div className="space-y-4 p-5 sm:p-6">
                {installPending && displayRepos.length === 0 ? (
                  <div className="flex items-center gap-3 text-sm text-muted">
                    <Spinner />
                    Loading repositories from GitHub…
                  </div>
                ) : displayRepos.length === 0 ? (
                  <p className="text-sm text-muted">
                    No repositories available for this installation. In GitHub, open the app
                    settings and grant access to at least one repository, then click
                    Reconfigure installation above.
                  </p>
                ) : (
                  <>
                    <label className="block text-sm">
                      <span className="text-muted">Repository</span>
                      <select
                        className="mt-1 w-full rounded border border-border bg-surface px-3 py-2 font-mono text-sm"
                        value={selectedRepo}
                        onChange={(e) => setSelectedRepo(e.target.value)}
                      >
                        <option value="">Select a repository…</option>
                        {displayRepos.map((repo) => (
                          <option key={repo.id} value={repo.fullName}>
                            {repo.fullName}
                            {repo.private ? " (private)" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={!selectedRepo || selectPending}
                      onClick={() => void onSelectRepo()}
                      className="rounded-full bg-indigo px-6 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-white disabled:opacity-50"
                    >
                      {selectPending ? "Saving…" : "Use this repository"}
                    </button>
                  </>
                )}
              </div>
            </Panel>
          ) : null}

          {connected && git?.authMethod === "github_app" ? (
            <Panel>
              <PanelHeader kicker="Webhook" title="Managed by GitHub App" />
              <div className="space-y-2 p-5 sm:p-6 text-sm text-muted">
                <p>
                  Push and pull request events are sent to your API — no manual webhook
                  setup in the repo settings.
                </p>
                <p className="font-mono text-xs break-all rounded bg-surface-elevated p-3 text-ink">
                  {setup?.githubApp?.webhookUrl ?? setup?.webhooks?.github?.url}
                </p>
              </div>
            </Panel>
          ) : null}

          <GithubManualPanel setup={setup} refetch={refetch} />
        </>
      ) : (
        <BitbucketManualPanel setup={setup} refetch={refetch} />
      )}
    </SettingsPageShell>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] ${
        active
          ? "bg-indigo text-white"
          : "border border-hairline text-ink-dim hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function GithubManualPanel({ setup, refetch }) {
  const [open, setOpen] = useState(false);
  const [workspace, setWorkspace] = useState(() => setup?.git?.workspace ?? "");
  const [repoSlug, setRepoSlug] = useState(() => setup?.git?.repoSlug ?? "");
  const [token, setToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState(
    () => setup?.git?.webhookSecret ?? ""
  );
  const [defaultBranch, setDefaultBranch] = useState(
    () => setup?.git?.defaultBranch ?? "main"
  );
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState("");

  const canConnect =
    workspace && repoSlug && (token.trim() || setup?.git?.hasToken);

  async function onConnect() {
    setPending(true);
    setErr("");
    try {
      await connectGitIntegration({
        provider: "github",
        workspace,
        repoSlug,
        token: token.trim() || undefined,
        webhookSecret: webhookSecret.trim() || undefined,
        defaultBranch: defaultBranch.trim() || undefined,
      });
      setToken("");
      await refetch();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Connect failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel>
      <PanelHeader
        kicker="Advanced"
        title="Manual token (fallback)"
        info="Use a personal access token if the GitHub App is not configured."
      />
      <div className="p-5 sm:p-6">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-dim"
        >
          {open ? "Hide" : "Show"} manual setup
        </button>
        {open ? (
          <div className="mt-4 space-y-4">
            <ManualFields
              workspace={workspace}
              setWorkspace={setWorkspace}
              repoSlug={repoSlug}
              setRepoSlug={setRepoSlug}
              token={token}
              setToken={setToken}
              tokenHint={setup?.git?.hasToken ? setup.git.tokenHint : null}
              webhookSecret={webhookSecret}
              setWebhookSecret={setWebhookSecret}
              defaultBranch={defaultBranch}
              setDefaultBranch={setDefaultBranch}
              workspaceLabel="Owner (org or user)"
              repoLabel="Repository name"
              tokenLabel="Personal access token (repo scope)"
            />
            {err ? <p className="font-mono text-[11px] text-danger">{err}</p> : null}
            <button
              type="button"
              disabled={pending || !canConnect}
              onClick={() => void onConnect()}
              className="rounded-full border border-hairline px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-dim disabled:opacity-50"
            >
              {pending ? "Connecting…" : "Save manual credentials"}
            </button>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function BitbucketManualPanel({ setup, refetch }) {
  const meta = setup?.providers?.find((p) => p.id === "bitbucket");
  const [workspace, setWorkspace] = useState(() => setup?.git?.workspace ?? "");
  const [repoSlug, setRepoSlug] = useState(() => setup?.git?.repoSlug ?? "");
  const [username, setUsername] = useState(() => setup?.git?.username ?? "");
  const [token, setToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState(
    () => setup?.git?.webhookSecret ?? ""
  );
  const [defaultBranch, setDefaultBranch] = useState(
    () => setup?.git?.defaultBranch ?? "main"
  );
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState("");
  const [status, setStatus] = useState("");

  const canConnect =
    workspace &&
    repoSlug &&
    (token.trim() || setup?.git?.hasToken) &&
    (username.trim() || setup?.git?.username);

  async function onConnect() {
    setPending(true);
    setErr("");
    try {
      const result = await connectGitIntegration({
        provider: "bitbucket",
        workspace,
        repoSlug,
        username,
        token: token.trim() || undefined,
        webhookSecret: webhookSecret.trim() || undefined,
        defaultBranch: defaultBranch.trim() || undefined,
      });
      setStatus(`Connected to ${result.fullName}`);
      setToken("");
      await refetch();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Connect failed");
    } finally {
      setPending(false);
    }
  }

  const webhook = setup?.webhooks?.bitbucket;

  return (
    <>
      <Panel>
        <PanelHeader
          kicker="Step 1"
          title="Bitbucket credentials"
          info="One-click Bitbucket OAuth is coming soon — use an app password for now."
        />
        <div className="space-y-4 p-5 sm:p-6">
          <ManualFields
            workspace={workspace}
            setWorkspace={setWorkspace}
            repoSlug={repoSlug}
            setRepoSlug={setRepoSlug}
            username={username}
            setUsername={setUsername}
            token={token}
            setToken={setToken}
            tokenHint={setup?.git?.hasToken ? setup.git.tokenHint : null}
            webhookSecret={webhookSecret}
            setWebhookSecret={setWebhookSecret}
            defaultBranch={defaultBranch}
            setDefaultBranch={setDefaultBranch}
            workspaceLabel={meta?.workspaceLabel ?? "Workspace slug"}
            repoLabel={meta?.repoLabel ?? "Repository slug"}
            tokenLabel={meta?.tokenLabel ?? "App password"}
            needsUsername
          />
          {err ? <p className="font-mono text-[11px] text-danger">{err}</p> : null}
          {status ? <p className="text-sm text-success">{status}</p> : null}
          <button
            type="button"
            disabled={pending || !canConnect}
            onClick={() => void onConnect()}
            className="rounded-full bg-indigo px-6 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-white disabled:opacity-50"
          >
            {pending ? "Connecting…" : "Connect Bitbucket"}
          </button>
        </div>
      </Panel>
      {webhook ? (
        <Panel>
          <PanelHeader kicker="Step 2" title="Webhook" />
          <div className="space-y-2 p-5 sm:p-6 text-sm text-muted">
            <p>
              Register a repository webhook for event{" "}
              <span className="font-mono">{webhook.events?.join(", ")}</span>
            </p>
            <p className="font-mono text-xs break-all rounded bg-surface-elevated p-3">
              {webhook.url}
            </p>
          </div>
        </Panel>
      ) : null}
    </>
  );
}

function ManualFields({
  workspace,
  setWorkspace,
  repoSlug,
  setRepoSlug,
  username,
  setUsername,
  token,
  setToken,
  tokenHint,
  webhookSecret,
  setWebhookSecret,
  defaultBranch,
  setDefaultBranch,
  workspaceLabel,
  repoLabel,
  tokenLabel,
  needsUsername,
}) {
  return (
    <>
      <label className="block text-sm">
        <span className="text-muted">{workspaceLabel}</span>
        <input
          className="mt-1 w-full rounded border border-border bg-surface px-3 py-2 font-mono text-sm"
          value={workspace}
          onChange={(e) => setWorkspace(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="text-muted">{repoLabel}</span>
        <input
          className="mt-1 w-full rounded border border-border bg-surface px-3 py-2 font-mono text-sm"
          value={repoSlug}
          onChange={(e) => setRepoSlug(e.target.value)}
        />
      </label>
      {needsUsername ? (
        <label className="block text-sm">
          <span className="text-muted">Atlassian username (email)</span>
          <input
            className="mt-1 w-full rounded border border-border bg-surface px-3 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </label>
      ) : null}
      <label className="block text-sm">
        <span className="text-muted">{tokenLabel}</span>
        <input
          type="password"
          className="mt-1 w-full rounded border border-border bg-surface px-3 py-2 font-mono text-sm"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={tokenHint ? `Saved (${tokenHint}) — leave blank to keep` : "Required"}
          autoComplete="off"
        />
      </label>
      <label className="block text-sm">
        <span className="text-muted">Default branch</span>
        <input
          className="mt-1 w-full rounded border border-border bg-surface px-3 py-2 font-mono text-sm"
          value={defaultBranch}
          onChange={(e) => setDefaultBranch(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="text-muted">Webhook secret (optional)</span>
        <input
          className="mt-1 w-full rounded border border-border bg-surface px-3 py-2 font-mono text-sm"
          value={webhookSecret}
          onChange={(e) => setWebhookSecret(e.target.value)}
        />
      </label>
    </>
  );
}

function formatGitIntegrationError(error) {
  const message = error instanceof Error ? error.message : "GitHub request failed";
  const lower = message.toLowerCase();
  if (lower.includes("unauthorized") || lower.includes("401")) {
    return "Session expired — sign in again, then retry Connect with GitHub.";
  }
  if (lower.includes("organization_required") || lower.includes("organization")) {
    return "Your workspace organization is missing. Complete onboarding or sign in again, then retry.";
  }
  return message;
}
