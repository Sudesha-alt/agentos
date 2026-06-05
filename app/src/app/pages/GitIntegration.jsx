import { useState } from "react";
import {
  connectGitIntegration,
  getGitIntegrationSetup,
} from "../../entities/git-integration";
import { useResource } from "../../shared/lib/useResource";
import EmptyState from "../components/EmptyState";
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
  const providers = setup?.providers ?? [];
  const [provider, setProvider] = useState(
    () => setup?.git?.provider ?? "github"
  );
  const meta = providers.find((p) => p.id === provider) ?? providers[0];
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

  const connected = Boolean(setup?.connected);
  const webhook =
    provider === "bitbucket"
      ? setup?.webhooks?.bitbucket
      : setup?.webhooks?.github;

  const canConnect =
    workspace &&
    repoSlug &&
    (token.trim() || setup?.git?.hasToken) &&
    (!meta?.needsUsername || username.trim() || setup?.git?.username);

  async function onConnect() {
    setPending(true);
    setErr("");
    setStatus("");
    try {
      const result = await connectGitIntegration({
        provider,
        workspace,
        repoSlug,
        username: meta?.needsUsername ? username : undefined,
        token: token.trim() || undefined,
        webhookSecret: webhookSecret.trim() || undefined,
        defaultBranch: defaultBranch.trim() || undefined,
      });
      setStatus(`Connected to ${result.fullName} (default branch: ${result.defaultBranch})`);
      setToken("");
      await refetch();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Connect failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      <PageIntro
        title={connected ? "Git connected" : "Connect GitHub or Bitbucket"}
        description="Repository access for codebase indexing, visualization, QA sandbox clones, and push webhooks."
      />

      <Panel>
        <PanelHeader
          kicker={connected ? "Connected" : "Step 1"}
          title="Repository credentials"
        />
        <div className="space-y-4 p-6 pt-0">
          <label className="block text-sm">
            <span className="text-muted">Provider</span>
            <select
              className="mt-1 w-full rounded border border-border bg-surface px-3 py-2"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-muted">{meta?.workspaceLabel}</span>
            <input
              className="mt-1 w-full rounded border border-border bg-surface px-3 py-2 font-mono text-sm"
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
              placeholder={provider === "github" ? "my-org" : "workspace-slug"}
            />
          </label>

          <label className="block text-sm">
            <span className="text-muted">{meta?.repoLabel}</span>
            <input
              className="mt-1 w-full rounded border border-border bg-surface px-3 py-2 font-mono text-sm"
              value={repoSlug}
              onChange={(e) => setRepoSlug(e.target.value)}
              placeholder="repo-name"
            />
          </label>

          {meta?.needsUsername ? (
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
            <span className="text-muted">{meta?.tokenLabel}</span>
            <input
              type="password"
              className="mt-1 w-full rounded border border-border bg-surface px-3 py-2 font-mono text-sm"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={
                setup?.git?.hasToken
                  ? `Saved (${setup.git.tokenHint}) — leave blank to keep`
                  : "Required"
              }
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

          {err ? <p className="font-mono text-[11px] text-danger">{err}</p> : null}
          {status ? <p className="text-sm text-success">{status}</p> : null}

          <button
            type="button"
            className="rounded bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={pending || !canConnect}
            onClick={onConnect}
          >
            {pending ? "Connecting…" : connected ? "Update connection" : "Connect"}
          </button>
        </div>
      </Panel>

      {webhook ? (
        <Panel>
          <PanelHeader kicker="Step 2" title="Webhook" />
          <div className="space-y-3 p-6 pt-0 text-sm">
            <p className="text-muted">
              Register a repository webhook pointing at your API. Events:{" "}
              <span className="font-mono">{webhook.events?.join(", ")}</span>
            </p>
            <p className="font-mono text-xs break-all rounded bg-surface-elevated p-3">
              {webhook.url}
            </p>
            <p className="text-muted text-xs">
              Set the shared secret to match the value above (or env{" "}
              <span className="font-mono">{webhook.secretEnv}</span>).
            </p>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
