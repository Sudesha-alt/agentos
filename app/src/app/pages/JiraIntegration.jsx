import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  connectPipelineJira,
  getPipelineJiraBoardColumns,
  getPipelineJiraBoards,
  getPipelineJiraProjects,
  registerPipelineJiraWebhook,
  savePipelineIntakeColumn,
  usePipelineIntakeTickets,
  usePipelineJiraSetup,
} from "../../entities/pipeline-jira";
import {
  disconnectJiraOAuth,
  getJiraOAuthStatus,
  startJiraOAuth,
} from "../../entities/jira-oauth";
import EmptyState from "../components/EmptyState";
import LabelPill from "../components/LabelPill";
import Spinner from "../components/Spinner";
import PipelineQueuePanel from "../../widgets/pipeline-queue/PipelineQueuePanel";
import JiraSyncStatusPanel from "../../widgets/jira-sync/JiraSyncStatusPanel";
import JiraTicketBrowser from "../../widgets/jira-sync/JiraTicketBrowser";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import { SettingsPageShell } from "../layout/SettingsPageShell";
import { useOrg } from "../../shared/providers/OrgRouteProvider";

const OAUTH_ERROR_MESSAGES = {
  invalid_state: "OAuth session expired or was invalid. Try Connect with Atlassian again.",
  connect_failed: "Atlassian authorized the app, but the server could not save the connection.",
  no_jira_site: "No Jira Cloud site was found for this Atlassian account.",
  access_denied:
    "Atlassian blocked the connection — the OAuth app is in development mode and only its creator can authorize it. Use the API token method below, or ask the app owner to publish the Atlassian OAuth app.",
};

export default function JiraIntegration({ embedded = false }) {
  const {
    data: setup,
    error: setupError,
    loading: setupLoading,
    refetch: refetchSetup,
  } = usePipelineJiraSetup({ pollMs: 5000 });

  if (setupLoading && !setup) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (setupError) {
    return (
      <EmptyState
        title="Cannot reach API"
      />
    );
  }

  return (
    <JiraIntegrationContent
      setup={setup}
      refetchSetup={refetchSetup}
      embedded={embedded}
    />
  );
}

function JiraIntegrationContent({ setup, refetchSetup, embedded = false }) {
  const { orgPath } = useOrg();
  const [searchParams, setSearchParams] = useSearchParams();
  const connected = Boolean(setup?.connected);
  const intakeConfigured = Boolean(setup?.intake?.aiWorkerColumnName);
  const connectedViaOAuth = Boolean(setup?.jira?.connectedViaOAuth);
  const authMethod = setup?.jira?.authMethod ?? "api_token";

  const {
    data: intakeData,
    loading: intakeLoading,
    refetch: refetchIntake,
  } = usePipelineIntakeTickets(connected && intakeConfigured, { pollMs: 10000 });

  const [baseUrl, setBaseUrl] = useState(() => setup?.jira?.baseUrl || "");
  const [email, setEmail] = useState(() => setup?.jira?.email || "");
  const [apiToken, setApiToken] = useState("");
  const [boardId, setBoardId] = useState(() => setup?.intake?.boardId || "");
  const [projectKeys, setProjectKeys] = useState(
    () => setup?.jira?.projectKeys?.join(", ") || ""
  );
  const [webhookSecret, setWebhookSecret] = useState(
    () => setup?.jira?.webhookSecret || ""
  );
  const [columns, setColumns] = useState([]);
  const [intakeColumn, setIntakeColumn] = useState(
    () => setup?.intake?.aiWorkerColumnName || ""
  );
  const [connectPending, setConnectPending] = useState(false);
  const [oauthPending, setOauthPending] = useState(false);
  const [disconnectPending, setDisconnectPending] = useState(false);
  const [mappingPending, setMappingPending] = useState(false);
  const [webhookPending, setWebhookPending] = useState(false);
  const [showLegacyForm, setShowLegacyForm] = useState(false);
  const [jiraProjects, setJiraProjects] = useState([]);
  const [jiraBoards, setJiraBoards] = useState([]);
  const [selectedProjectKey, setSelectedProjectKey] = useState("");
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [oauthAvailable, setOauthAvailable] = useState(false);
  const [oauthDevMode, setOauthDevMode] = useState(false);
  const [statusMessage, setStatusMessage] = useState(() => {
    if (searchParams.get("connected") === "1") {
      return "Jira connected via Atlassian OAuth.";
    }
    return "";
  });
  const [connectError, setConnectError] = useState(() => {
    const code = searchParams.get("error");
    if (code && OAUTH_ERROR_MESSAGES[code]) {
      return OAUTH_ERROR_MESSAGES[code];
    }
    if (code) return `OAuth error: ${code}`;
    return "";
  });
  const clearedOAuthParams = useRef(false);

  const canConnectLegacy =
    baseUrl &&
    boardId &&
    projectKeys.trim() &&
    (apiToken.trim() || setup?.jira?.hasApiToken);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await getJiraOAuthStatus();
        if (!cancelled) {
          setOauthAvailable(Boolean(status?.oauthAvailable));
          setOauthDevMode(Boolean(status?.oauthDevMode));
        }
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (clearedOAuthParams.current) return;
    if (!searchParams.get("connected") && !searchParams.get("error")) return;
    clearedOAuthParams.current = true;
    const next = new URLSearchParams(searchParams);
    next.delete("connected");
    next.delete("error");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (connectedViaOAuth) {
      setShowLegacyForm(false);
    }
  }, [connectedViaOAuth]);

  useEffect(() => {
    if (setup?.intake?.boardId) {
      const id = setup.intake.boardId;
      if (/^\d+$/.test(id)) {
        setBoardId(id);
      } else if (id && !/^\d+$/.test(id)) {
        setBoardId("");
      }
    }
  }, [setup?.intake?.boardId]);

  useEffect(() => {
    if (setup?.jira?.projectKeys?.length && !selectedProjectKey) {
      setSelectedProjectKey(setup.jira.projectKeys[0]);
      setProjectKeys(setup.jira.projectKeys.join(", "));
    }
  }, [setup?.jira?.projectKeys, selectedProjectKey]);

  useEffect(() => {
    if (!connected || authMethod !== "oauth") return;
    let cancelled = false;
    (async () => {
      setLoadingProjects(true);
      try {
        const { projects } = await getPipelineJiraProjects();
        if (!cancelled) setJiraProjects(projects ?? []);
      } catch (err) {
        if (!cancelled) {
          setConnectError(err.message || "Could not load Jira projects");
        }
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, authMethod]);

  useEffect(() => {
    if (!connected || authMethod !== "oauth" || !selectedProjectKey) {
      setJiraBoards([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoadingBoards(true);
      try {
        const { boards } = await getPipelineJiraBoards(selectedProjectKey);
        if (!cancelled) setJiraBoards(boards ?? []);
      } catch (err) {
        if (!cancelled) {
          setConnectError(err.message || "Could not load Jira boards");
        }
      } finally {
        if (!cancelled) setLoadingBoards(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, authMethod, selectedProjectKey]);

  useEffect(() => {
    if (!connected || !boardId || !/^\d+$/.test(String(boardId).trim())) return;
    let cancelled = false;
    (async () => {
      try {
        const { columns: cols } = await getPipelineJiraBoardColumns();
        if (!cancelled && cols?.length) setColumns(cols);
      } catch {
        /* optional until board mapped */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, boardId]);

  const columnOptions = useMemo(
    () => columns.map((c) => c.name).filter(Boolean),
    [columns]
  );

  async function handleSavePipelineSettings(e) {
    e.preventDefault();
    const id = boardId.trim();
    if (authMethod === "oauth" && (!selectedProjectKey || !id || !/^\d+$/.test(id))) {
      setConnectError("Select a project and board from the dropdowns before saving.");
      return;
    }
    setConnectPending(true);
    setConnectError("");
    try {
      const keys =
        authMethod === "oauth" && selectedProjectKey
          ? [selectedProjectKey]
          : projectKeys
              .split(",")
              .map((k) => k.trim())
              .filter(Boolean);
      await connectPipelineJira({
        baseUrl: (setup?.jira?.baseUrl || baseUrl).trim(),
        email: setup?.jira?.email || email.trim() || undefined,
        boardId: id,
        projectKeys: keys,
      });
      setStatusMessage("Pipeline settings saved.");
      await refetchSetup();
      if (boardId.trim()) {
        const { columns: cols } = await getPipelineJiraBoardColumns();
        if (cols?.length) setColumns(cols);
      }
    } catch (err) {
      setConnectError(err.message || "Could not save settings");
    } finally {
      setConnectPending(false);
    }
  }

  const intakeStatuses = setup?.intake?.aiWorkerStatuses ?? [];
  const intakeItems = intakeData?.items ?? [];
  const showApiTokenForm = showLegacyForm && !connectedViaOAuth;

  async function handleOAuthConnect() {
    setOauthPending(true);
    setConnectError("");
    setStatusMessage("");
    try {
      await startJiraOAuth();
    } catch (err) {
      setConnectError(err.message || "Could not start Atlassian OAuth");
      setOauthPending(false);
    }
  }

  async function handleDisconnect() {
    setDisconnectPending(true);
    setConnectError("");
    setStatusMessage("");
    try {
      await disconnectJiraOAuth();
      setStatusMessage("Jira disconnected.");
      await refetchSetup();
    } catch (err) {
      setConnectError(err.message || "Disconnect failed");
    } finally {
      setDisconnectPending(false);
    }
  }

  async function handleConnect(e) {
    e.preventDefault();
    setConnectPending(true);
    setConnectError("");
    setStatusMessage("");
    try {
      await connectPipelineJira({
        baseUrl: baseUrl.trim(),
        email: email.trim() || undefined,
        apiToken: apiToken.trim() || undefined,
        webhookSecret: webhookSecret.trim() || undefined,
        boardId: boardId.trim(),
        projectKeys: projectKeys
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      });
      setApiToken("");
      setStatusMessage("Jira connected with API token.");
      await refetchSetup();
    } catch (err) {
      setConnectError(err.message || "Connect failed");
    } finally {
      setConnectPending(false);
    }
  }

  async function handleSaveIntakeColumn(e) {
    e.preventDefault();
    if (!intakeColumn) return;
    setMappingPending(true);
    setStatusMessage("");
    try {
      await savePipelineIntakeColumn({
        columnName: intakeColumn,
        boardId: boardId.trim() || undefined,
      });
      setStatusMessage(`AI Worker intake column set to "${intakeColumn}".`);
      await refetchSetup();
      await refetchIntake();
    } catch (err) {
      setConnectError(err.message || "Could not save intake column");
    } finally {
      setMappingPending(false);
    }
  }

  async function handleRegisterWebhook() {
    const keys = setup?.jira?.projectKeys ?? [];
    if (!keys.length) {
      setConnectError("Save pipeline settings (project + board) before registering the webhook.");
      return;
    }
    setWebhookPending(true);
    setStatusMessage("");
    try {
      await registerPipelineJiraWebhook();
      setStatusMessage("Webhook registered with Jira.");
    } catch (err) {
      setConnectError(err.message || "Webhook registration failed");
    } finally {
      setWebhookPending(false);
    }
  }

  return (
    <SettingsPageShell
      embedded={embedded}
      kicker="Jira"
      title="Jira pipeline"
    >

      {connectedViaOAuth && statusMessage ? (
        <p className="rounded-app-sm border border-indigo/30 bg-indigo/5 px-4 py-2.5 text-sm text-app-ink-dim">
          OAuth is connected. Choose your <strong>project</strong> and <strong>board</strong> in Pipeline settings below, then pick an intake column.
        </p>
      ) : null}

      {statusMessage ? (
        <p className="rounded-app-sm border border-success/30 bg-success/10 px-4 py-2.5 text-sm text-success">
          {statusMessage}
        </p>
      ) : null}
      {connectError ? (
        <p className="rounded-app-sm border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
          {connectError}
        </p>
      ) : null}

      <Panel>
        <PanelHeader
          title="Connect Jira"
          subtitle={
            connected
              ? `Connected via ${authMethod === "oauth" ? "Atlassian OAuth" : "API token"}`
              : "Connect using an Atlassian API token or OAuth."
          }
        />

        {connected ? (
          <div className="space-y-3 px-4 pb-4 sm:px-6">
            <p className="text-sm text-app-ink">
              Site:{" "}
              <span className="font-medium text-indigo">
                {setup?.jira?.siteName || setup?.jira?.baseUrl || "—"}
              </span>
            </p>
            <p className="text-sm text-app-ink-dim">
              Auth:{" "}
              <LabelPill
                label={authMethod === "oauth" ? "OAuth 3LO" : "API token"}
                tone={authMethod === "oauth" ? "indigo" : "muted"}
              />
              {setup?.jira?.email ? (
                <span className="ml-2">({setup.jira.email})</span>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-3">
              {oauthAvailable && !oauthDevMode ? (
                <button
                  type="button"
                  disabled={oauthPending}
                  onClick={handleOAuthConnect}
                  className="app-btn-primary disabled:opacity-50"
                >
                  {oauthPending ? "Redirecting…" : "Reconnect with Atlassian"}
                </button>
              ) : null}
              <button
                type="button"
                disabled={webhookPending || !(setup?.jira?.projectKeys?.length)}
                onClick={handleRegisterWebhook}
                className="rounded-app-sm border border-app-border px-4 py-2 text-sm text-app-ink-dim hover:text-app-ink disabled:opacity-50"
                title={
                  setup?.jira?.projectKeys?.length
                    ? undefined
                    : "Save project and board in Pipeline settings first"
                }
              >
                {webhookPending ? "Registering…" : "Register webhook"}
              </button>
              <button
                type="button"
                disabled={disconnectPending}
                onClick={handleDisconnect}
                className="rounded-app-sm border border-danger/40 px-4 py-2 text-sm text-danger hover:bg-danger/10"
              >
                {disconnectPending ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
            <p className="text-xs text-app-ink-mute">
              Webhook URL: <code className="text-indigo">{setup.webhookUrl}</code> — events: created, updated, deleted
            </p>
          </div>
        ) : (
          <div className="space-y-4 px-4 pb-2 sm:px-6">
            {/* Dev-mode / private OAuth app warning */}
            {oauthAvailable && oauthDevMode ? (
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
                <span className="mt-0.5 shrink-0 text-amber-500">⚠</span>
                <div>
                  <p className="font-medium text-app-ink">Atlassian OAuth app is in development mode</p>
                  <p className="mt-1 text-app-ink-dim">
                    Only the owner of the Atlassian OAuth app can connect via OAuth right now. To allow other users,{" "}
                    <a
                      href="https://developer.atlassian.com/console/myapps/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo underline"
                    >
                      go to the Atlassian developer console
                    </a>{" "}
                    → open your OAuth app → Distribution → set <strong>Sharing</strong>.
                    <br />
                    <span className="mt-1 block font-medium text-app-ink">
                      In the meantime, use the API token form below — it works for everyone.
                    </span>
                  </p>
                </div>
              </div>
            ) : oauthAvailable ? (
              <button
                type="button"
                disabled={oauthPending}
                onClick={handleOAuthConnect}
                className="app-btn-primary disabled:opacity-50"
              >
                {oauthPending ? "Redirecting to Atlassian…" : "Connect with Atlassian"}
              </button>
            ) : null}

            {!oauthAvailable ? (
              <p className="text-sm text-app-ink-dim">
                Atlassian OAuth is not configured on the server. Set{" "}
                <code className="rounded bg-app-surface-muted px-1 text-xs">ATLASSIAN_CLIENT_ID</code> and{" "}
                <code className="rounded bg-app-surface-muted px-1 text-xs">ATLASSIAN_CLIENT_SECRET</code> on Render, or use the API token form below.
              </p>
            ) : null}

            {!oauthAvailable || oauthDevMode ? (
              <button
                type="button"
                onClick={() => setShowLegacyForm((v) => !v)}
                className="text-sm text-app-ink-dim underline hover:text-app-ink"
              >
                {showLegacyForm ? "Hide API token form" : "Use API token instead"}
              </button>
            ) : null}
          </div>
        )}

        {connected && connectedViaOAuth ? (
          <div className="border-t border-app-border px-4 pb-4 pt-3 sm:px-6">
            <button
              type="button"
              onClick={() => setShowLegacyForm((v) => !v)}
              className="text-sm text-app-ink-dim underline hover:text-app-ink"
            >
              {showLegacyForm ? "Hide API token form" : "Switch to API token"}
            </button>
          </div>
        ) : null}

        {showApiTokenForm ? (
          <form className="grid gap-4 border-t border-app-border p-4 md:grid-cols-2 sm:px-6" onSubmit={handleConnect}>
          <label className="block text-sm md:col-span-2">
            <span className="type-kicker text-app-ink-mute">
              {connected ? "Update API token credentials" : "API token — works for everyone"}
            </span>
          </label>
            <label className="block text-sm">
              <span className="type-kicker">Base URL</span>
              <input
                className="mt-1.5 w-full rounded-app-sm border border-app-border bg-app-surface px-3 py-2 text-sm"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://your-domain.atlassian.net"
              />
            </label>
            <label className="block text-sm">
              <span className="type-kicker">Email</span>
              <input
                className="mt-1.5 w-full rounded-app-sm border border-app-border bg-app-surface px-3 py-2 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="type-kicker">API token</span>
              <input
                type="password"
                className="mt-1.5 w-full rounded-app-sm border border-app-border bg-app-surface px-3 py-2 text-sm"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder={setup?.jira?.hasApiToken ? "Saved — leave blank to keep" : "Required"}
              />
            </label>
            <label className="block text-sm">
              <span className="type-kicker">Board ID</span>
              <input
                className="mt-1.5 w-full rounded-app-sm border border-app-border bg-app-surface px-3 py-2 text-sm"
                value={boardId}
                onChange={(e) => setBoardId(e.target.value)}
              />
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="type-kicker">Project keys (comma-separated)</span>
              <input
                className="mt-1.5 w-full rounded-app-sm border border-app-border bg-app-surface px-3 py-2 text-sm"
                value={projectKeys}
                onChange={(e) => setProjectKeys(e.target.value)}
                placeholder="SCRUM"
              />
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="type-kicker">Webhook secret (optional)</span>
              <input
                className="mt-1.5 w-full rounded-app-sm border border-app-border bg-app-surface px-3 py-2 text-sm"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-3 md:col-span-2">
              <button
                type="submit"
                disabled={!canConnectLegacy || connectPending}
                className="rounded-app-sm border border-app-border px-4 py-2 text-sm text-app-ink hover:bg-app-surface-elevated disabled:opacity-50"
              >
                {connectPending ? "Connecting…" : connected ? "Update API token connection" : "Connect with API token"}
              </button>
            </div>
          </form>
        ) : null}
      </Panel>

      {connected ? (
        <Panel>
          <PanelHeader
            title="Pipeline settings"
            subtitle={
              authMethod === "oauth"
                ? "Pick your Jira project and board — no API token needed."
                : undefined
            }
          />
          <form
            className="grid gap-4 p-4 md:grid-cols-2 sm:px-6"
            onSubmit={handleSavePipelineSettings}
          >
            {authMethod === "oauth" ? (
              <>
                <label className="block text-sm">
                  <span className="type-kicker">Project</span>
                  <select
                    className="mt-1.5 w-full rounded-app-sm border border-app-border bg-app-surface px-3 py-2 text-sm"
                    value={selectedProjectKey}
                    onChange={(e) => {
                      const key = e.target.value;
                      setSelectedProjectKey(key);
                      setProjectKeys(key);
                      setBoardId("");
                    }}
                    disabled={loadingProjects}
                  >
                    <option value="">
                      {loadingProjects ? "Loading projects…" : "Select a project…"}
                    </option>
                    {jiraProjects.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.key} — {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="type-kicker">Board</span>
                  <select
                    className="mt-1.5 w-full rounded-app-sm border border-app-border bg-app-surface px-3 py-2 text-sm"
                    value={boardId}
                    onChange={(e) => setBoardId(e.target.value)}
                    disabled={!selectedProjectKey || loadingBoards}
                  >
                    <option value="">
                      {!selectedProjectKey
                        ? "Select a project first"
                        : loadingBoards
                          ? "Loading boards…"
                          : "Select a board…"}
                    </option>
                    {jiraBoards.map((b) => (
                      <option key={b.id} value={String(b.id)}>
                        {b.name} ({b.type}) · #{b.id}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <>
                <label className="block text-sm">
                  <span className="type-kicker">Board ID</span>
                  <input
                    className="mt-1.5 w-full rounded-app-sm border border-app-border bg-app-surface px-3 py-2 text-sm"
                    value={boardId}
                    onChange={(e) => setBoardId(e.target.value)}
                    placeholder="Numeric board id from Jira board URL"
                  />
                </label>
                <label className="block text-sm">
                  <span className="type-kicker">Project keys</span>
                  <input
                    className="mt-1.5 w-full rounded-app-sm border border-app-border bg-app-surface px-3 py-2 text-sm"
                    value={projectKeys}
                    onChange={(e) => setProjectKeys(e.target.value)}
                    placeholder="SCRUM"
                  />
                </label>
              </>
            )}
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={
                  !boardId.trim() ||
                  !projectKeys.trim() ||
                  connectPending ||
                  (authMethod === "oauth" && (loadingProjects || loadingBoards))
                }
                className="app-btn-primary disabled:opacity-50"
              >
                {connectPending ? "Saving…" : "Save pipeline settings"}
              </button>
            </div>
          </form>
        </Panel>
      ) : null}

      {connected ? (
        <Panel>
          <PanelHeader title="AI Worker intake column" />
          <form className="flex flex-wrap items-end gap-3 p-4 sm:px-6" onSubmit={handleSaveIntakeColumn}>
            <label className="block min-w-[240px] flex-1 text-sm">
              <span className="type-kicker">Board column</span>
              <select
                className="mt-1.5 w-full rounded-app-sm border border-app-border bg-app-surface px-3 py-2 text-sm"
                value={intakeColumn}
                onChange={(e) => setIntakeColumn(e.target.value)}
              >
                <option value="">Select column…</option>
                {columnOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={!intakeColumn || mappingPending}
              className="app-btn-primary disabled:opacity-50"
            >
              {mappingPending ? "Saving…" : "Save intake column"}
            </button>
          </form>
          {intakeConfigured && intakeStatuses.length ? (
            <p className="px-5 pb-4 text-sm text-app-ink-dim sm:px-6">
              Trigger statuses:{" "}
              {intakeStatuses.map((status) => (
                <LabelPill key={status} label={status} tone="indigo" className="ml-1" />
              ))}
            </p>
          ) : null}
        </Panel>
      ) : null}

      {connected ? (
        <>
          <JiraSyncStatusPanel setupSync={setup?.sync} connected={connected} />
          <JiraTicketBrowser connected={connected} />
        </>
      ) : null}

      {connected ? (
        <PipelineQueuePanel setup={setup} onRefreshSetup={refetchSetup} />
      ) : null}

      {connected && intakeConfigured ? (
        <Panel>
          <PanelHeader title="Tickets in AI Worker" />
          {intakeLoading && !intakeItems.length ? <Spinner /> : null}
          {!intakeLoading && !intakeItems.length ? (
            <EmptyState
              title="No tickets in AI Worker"
            />
          ) : (
            <ul className="divide-y divide-app-border">
              {intakeItems.map((item) => (
                <li key={item.key} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
                  <span className="text-sm font-medium text-indigo">{item.key}</span>
                  <span className="flex-1 text-sm text-app-ink">{item.summary}</span>
                  <LabelPill label={item.issueType} tone="muted" />
                  <LabelPill label={item.status} tone="indigo" />
                </li>
              ))}
            </ul>
          )}
          <p className="px-5 pb-4 text-xs text-app-ink-mute sm:px-6">
            Active pipelines:{" "}
            <Link to={orgPath("pipelines")} className="text-indigo underline">
              View pipelines →
            </Link>
          </p>
        </Panel>
      ) : null}
    </SettingsPageShell>
  );
}
