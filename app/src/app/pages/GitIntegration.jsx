import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  completeGithubInstall,
  connectGitIntegration,
  getGitIntegrationSetup,
  selectGithubRepository,
  startGithubAppInstall,
} from "../../entities/git-integration";
import { useResource } from "../../shared/lib/useResource";
import EmptyState from "../components/EmptyState";
import LabelPill from "../components/LabelPill";
import Spinner from "../components/Spinner";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";

export default function GitIntegration() {
  const { data: setup, error, loading, refetch } = useResource(
    () => getGitIntegrationSetup(),
    []
  );

  if (loading && !setup) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Cannot reach API"
        body="Set VITE_API_URL on Vercel to your Render URL and redeploy."
      />
    );
  }

  return <GitIntegrationContent setup={setup} refetch={refetch} />;
}

function GitIntegrationContent({ setup, refetch }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState("github");
  const [repos, setRepos] = useState([]);
  const [pendingInstallationId, setPendingInstallationId] = useState(
    () => setup?.git?.installationId ?? ""
  );
  const [selectedRepo, setSelectedRepo] = useState("");
  const [installPending, setInstallPending] = useState(false);
  const [selectPending, setSelectPending] = useState(false);
  const [err, setErr] = useState("");
  const [status, setStatus] = useState("");

  const githubApp = setup?.githubApp;
  const githubAppEnabled = Boolean(githubApp?.configured && githubApp?.installUrl);
  const git = setup?.git;
  const connected = Boolean(setup?.connected);
  const isGithubApp =
    git?.authMethod === "github_app" || Boolean(pendingInstallationId && tab === "github");
  const needsRepoPick =
    isGithubApp &&
    pendingInstallationId &&
    (!git?.workspace || !git?.repoSlug) &&
    repos.length > 0;

  useEffect(() => {
    const installationId = searchParams.get("installation_id");
    const provider = searchParams.get("provider");
    if (!installationId || provider !== "github") return;

    let cancelled = false;
    (async () => {
      setInstallPending(true);
      setErr("");
      try {
        const result = await completeGithubInstall(installationId);
        if (cancelled) return;
        setPendingInstallationId(installationId);
        setRepos(result.repositories ?? []);
        setStatus("GitHub App installed — choose a repository below.");
        setSearchParams({}, { replace: true });
        await refetch();
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "GitHub install failed");
        }
      } finally {
        if (!cancelled) setInstallPending(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, setSearchParams, refetch]);

  const connectedLabel = useMemo(() => {
    if (!connected || !git?.workspace || !git?.repoSlug) return null;
    return `${git.workspace}/${git.repoSlug}`;
  }, [connected, git?.workspace, git?.repoSlug]);

  async function onSelectRepo() {
    const [owner, repo] = selectedRepo.split("/");
    if (!owner || !repo || !pendingInstallationId) return;
    setSelectPending(true);
    setErr("");
    try {
      const result = await selectGithubRepository({
        installationId: pendingInstallationId,
        owner,
        repo,
      });
      setStatus(`Connected to ${result.fullName}`);
      await refetch();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not select repository");
    } finally {
      setSelectPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[82rem] space-y-6 pb-16">
      <PageIntro
        kicker="Git integration"
        title={connected ? "GitHub connected" : "Connect GitHub"}
        body={
          connected
            ? "Repository access for codebase indexing, visualization, branch push, pull requests, and QA sandbox clones."
            : "Install the Agentos GitHub App for one-click access — read, write, push, and open PRs without copying tokens."
        }
        right={
          connected ? (
            <LabelPill label={connectedLabel ?? "Connected"} tone="success" />
          ) : null
        }
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
              kicker={connected ? "Connected" : "Step 1"}
              title="GitHub App"
              body={
                githubAppEnabled
                  ? "Permissions: contents & pull requests (read/write), metadata, webhooks, actions (read). Webhooks are delivered to your API automatically."
                  : "GitHub App env vars are not set on the server — use manual token setup below or configure GITHUB_APP_* on Render."
              }
            />
            <div className="space-y-4 p-5 sm:p-6">
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
                <button
                  type="button"
                  disabled={!githubAppEnabled || installPending}
                  onClick={() => startGithubAppInstall()}
                  className="w-full rounded-full bg-indigo py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-white disabled:opacity-50 sm:w-auto sm:px-8"
                >
                  {installPending ? "Finishing install…" : "Connect with GitHub"}
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => startGithubAppInstall()}
                    className="rounded-full border border-hairline px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-dim"
                  >
                    Reconfigure installation
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
              {status ? <p className="text-sm text-success">{status}</p> : null}
            </div>
          </Panel>

          {needsRepoPick || (repos.length > 0 && !connected) ? (
            <Panel>
              <PanelHeader
                kicker="Step 2"
                title="Select repository"
                body="Choose which installed repository Agentos should index and push to."
              />
              <div className="space-y-4 p-5 sm:p-6">
                <label className="block text-sm">
                  <span className="text-muted">Repository</span>
                  <select
                    className="mt-1 w-full rounded border border-border bg-surface px-3 py-2 font-mono text-sm"
                    value={selectedRepo}
                    onChange={(e) => setSelectedRepo(e.target.value)}
                  >
                    <option value="">Select a repository…</option>
                    {repos.map((repo) => (
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
    </div>
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
        body="Use a personal access token if the GitHub App is not configured."
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
          body="One-click Bitbucket OAuth is coming soon — use an app password for now."
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
