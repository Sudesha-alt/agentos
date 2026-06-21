import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  connectPipelineJira,
  getPipelineJiraBoardColumns,
  getPipelineJiraBoards,
  getPipelineJiraProjects,
  registerPipelineJiraWebhook,
  savePipelineIntakeColumn,
  savePipelineReferenceColumns,
  syncPipelineReferenceColumns,
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
  } = usePipelineJiraSetup({ pollMs: 30000 });

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
  const [disconnected, setDisconnected] = useState(false);
  const setupConnected = Boolean(setup?.connected);
  const pipelineReady = Boolean(setup?.pipelineReady);
  const needsReconnect = Boolean(setup?.needsReconnect);
  const connected = setupConnected && !disconnected;
  const intakeConfigured = Boolean(setup?.intake?.aiWorkerColumnName);
  const connectedViaOAuth = Boolean(setup?.jira?.connectedViaOAuth) && !disconnected;
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
  const [referenceColumns, setReferenceColumns] = useState(
    () => setup?.intake?.referenceColumnNames ?? []
  );
  const [referencePending, setReferencePending] = useState(false);
  const [referenceSyncPending, setReferenceSyncPending] = useState(false);
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
  const boardsErrorRef = useRef("");
  const projectsErrorRef = useRef("");
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
    baseUrl.trim() &&
    (email.trim() || setup?.jira?.email) &&
    (apiToken.trim() || setup?.jira?.hasApiToken);

  /** Only call Jira REST when runtime credentials validate (not just DB row present). */
  const canPickProjectBoard = Boolean(pipelineReady && setup?.jira?.configured);

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
    if (setupConnected) {
      setDisconnected(false);
    } else if (!setup?.jira?.baseUrl && !setup?.jira?.connectedViaOAuth) {
      resetIntegrationState();
    }
  }, [setupConnected, setup?.jira?.baseUrl, setup?.jira?.connectedViaOAuth]);

  useEffect(() => {
    if (connectedViaOAuth) {
      setShowLegacyForm(false);
    }
  }, [connectedViaOAuth]);

  useEffect(() => {
    if (setup?.intake?.referenceColumnNames?.length) {
      setReferenceColumns(setup.intake.referenceColumnNames);
    }
  }, [setup?.intake?.referenceColumnNames]);

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
    if (!canPickProjectBoard) {
      projectsErrorRef.current = "";
      return undefined;
    }
    if (projectsErrorRef.current === "auth") {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoadingProjects(true);
      try {
        const { projects } = await getPipelineJiraProjects();
        if (!cancelled) {
          setJiraProjects(projects ?? []);
          boardsErrorRef.current = "";
          projectsErrorRef.current = "";
          setConnectError("");
        }
      } catch (err) {
        if (!cancelled) {
          const message = err.message || "Could not load Jira projects";
          if (/OAuth tokens are missing|not configured|401|403|invalid_grant/i.test(message)) {
            projectsErrorRef.current = "auth";
          }
          setConnectError(message);
        }
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canPickProjectBoard]);

  useEffect(() => {
    if (!canPickProjectBoard || !selectedProjectKey) {
      setJiraBoards([]);
      return undefined;
    }
    const errKey = `${selectedProjectKey}`;
    if (boardsErrorRef.current === errKey) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoadingBoards(true);
      try {
        const { boards } = await getPipelineJiraBoards(selectedProjectKey);
        if (!cancelled) {
          setJiraBoards(boards ?? []);
          boardsErrorRef.current = "";
        }
      } catch (err) {
        if (!cancelled) {
          boardsErrorRef.current = errKey;
          setConnectError(err.message || "Could not load Jira boards");
        }
      } finally {
        if (!cancelled) setLoadingBoards(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canPickProjectBoard, selectedProjectKey]);

  useEffect(() => {
    if (!canPickProjectBoard || !boardId || !/^\d+$/.test(String(boardId).trim())) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const { columns: cols } = await getPipelineJiraBoardColumns(boardId);
        if (!cancelled && cols?.length) setColumns(cols);
      } catch {
        /* optional until board saved */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canPickProjectBoard, boardId]);

  const columnOptions = useMemo(
    () => columns.map((c) => c.name).filter(Boolean),
    [columns]
  );

  async function handleSavePipelineSettings(e) {
    e.preventDefault();
    const id = boardId.trim();
    if (!selectedProjectKey || !id || !/^\d+$/.test(id)) {
      setConnectError("Select a project and board from the dropdowns before saving.");
      return;
    }
    setConnectPending(true);
    setConnectError("");
    try {
      const keys = selectedProjectKey
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
        const { columns: cols } = await getPipelineJiraBoardColumns(id);
        if (cols?.length) setColumns(cols);
      }
    } catch (err) {
      setConnectError(err.message || "Could not save settings");
    } finally {
      setConnectPending(false);
    }
  }

  const intakeStatuses = setup?.intake?.aiWorkerStatuses ?? [];
  const referenceStatuses = setup?.intake?.referenceStatuses ?? [];
  const referenceColumnOptions = useMemo(
    () => columnOptions.filter((name) => name !== intakeColumn),
    [columnOptions, intakeColumn]
  );
  const intakeItems = intakeData?.items ?? [];
  const showApiTokenForm = showLegacyForm && !connectedViaOAuth;

  function resetIntegrationState() {
    setBaseUrl("");
    setEmail("");
    setApiToken("");
    setBoardId("");
    setProjectKeys("");
    setWebhookSecret("");
    setColumns([]);
    setIntakeColumn("");
    setReferenceColumns([]);
    setJiraProjects([]);
    setJiraBoards([]);
    setSelectedProjectKey("");
    setShowLegacyForm(false);
    setConnectError("");
    boardsErrorRef.current = "";
    projectsErrorRef.current = "";
  }

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
    const confirmed = window.confirm(
      "Remove Jira from this workspace? Connection settings, OAuth tokens, project/board mapping, and intake column will be deleted. You will need to connect again."
    );
    if (!confirmed) return;

    setDisconnectPending(true);
    setConnectError("");
    setStatusMessage("");
    try {
      await disconnectJiraOAuth();
      resetIntegrationState();
      setDisconnected(true);
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

  async function handleSaveReferenceColumns(e) {
    e.preventDefault();
    setReferencePending(true);
    setStatusMessage("");
    try {
      const result = await savePipelineReferenceColumns({
        columnNames: referenceColumns,
      });
      const embedded = result?.sync?.embedded ?? 0;
      const synced = result?.sync?.synced ?? 0;
      setStatusMessage(
        synced > 0
          ? `Reference columns saved — synced ${synced} ticket(s), embedded ${embedded} new/changed.`
          : "Reference columns saved. Tickets in these columns are stored for context only (not pipelined)."
      );
      await refetchSetup();
    } catch (err) {
      setConnectError(err.message || "Could not save reference columns");
    } finally {
      setReferencePending(false);
    }
  }

  function toggleReferenceColumn(name) {
    setReferenceColumns((prev) =>
      prev.includes(name) ? prev.filter((col) => col !== name) : [...prev, name]
    );
  }

  async function handleIndexJiraVectors() {
    setReferenceSyncPending(true);
    setStatusMessage("");
    try {
      const result = await syncPipelineReferenceColumns();
      const embedded = result?.sync?.embedded ?? 0;
      const synced = result?.sync?.synced ?? 0;
      const skipped = result?.sync?.skipped ?? 0;
      setStatusMessage(
        `Jira vector index complete — ${synced} ticket(s) synced, ${embedded} embedded, ${skipped} unchanged.`
      );
      await refetchSetup();
    } catch (err) {
      setConnectError(err.message || "Could not index Jira vectors");
    } finally {
      setReferenceSyncPending(false);
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

      {disconnected && !connected ? (
        <div className="flex items-start gap-3 rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm">
          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-500">
            ✓
          </span>
          <div>
            <p className="font-medium text-app-ink">Jira disconnected</p>
            <p className="mt-0.5 text-app-ink-dim">
              The integration was removed. Connect with Atlassian or an API token to set up again.
            </p>
          </div>
        </div>
      ) : null}

      {needsReconnect && !disconnected ? (
        <div className="flex flex-col gap-3 rounded-app-sm border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
          <p className="text-app-ink-dim">
            Jira settings are saved but the server cannot use the OAuth tokens for this workspace.
            Disconnect Jira, then use <strong>Connect with Atlassian</strong> again.
          </p>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={disconnectPending}
            className="self-start rounded-lg border border-amber-500/40 px-3 py-1.5 text-sm font-medium text-app-ink disabled:opacity-50"
          >
            {disconnectPending ? "Disconnecting…" : "Disconnect and reconnect"}
          </button>
        </div>
      ) : null}

      {connected && !pipelineReady && !needsReconnect ? (
        <p className="rounded-app-sm border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-sm text-app-ink-dim">
          Jira OAuth is linked but credentials are incomplete. Disconnect and use{" "}
          <strong>Connect with Atlassian</strong> again after updating scopes in the Atlassian Developer Console.
        </p>
      ) : null}

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
      {connectError && !needsReconnect ? (
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
            <p className="text-xs text-app-ink-mute md:col-span-2">
              After connecting, choose your project and board in <strong>Pipeline settings</strong> below.
            </p>
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
            subtitle="Choose your Jira project and board — loaded automatically from your site."
          />
          <form
            className="grid gap-4 p-4 md:grid-cols-2 sm:px-6"
            onSubmit={handleSavePipelineSettings}
          >
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
                  boardsErrorRef.current = "";
                  setColumns([]);
                }}
                disabled={loadingProjects || !canPickProjectBoard}
              >
                <option value="">
                  {loadingProjects
                    ? "Loading projects…"
                    : !canPickProjectBoard
                      ? "Connect Jira first"
                      : jiraProjects.length
                        ? "Select a project…"
                        : "No projects found"}
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
                      : jiraBoards.length
                        ? "Select a board…"
                        : "No boards for this project"}
                </option>
                {jiraBoards.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name} ({b.type}) · #{b.id}
                  </option>
                ))}
              </select>
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={
                  !selectedProjectKey ||
                  !boardId.trim() ||
                  !/^\d+$/.test(boardId.trim()) ||
                  connectPending ||
                  loadingProjects ||
                  loadingBoards
                }
                className="app-btn-primary disabled:opacity-50"
              >
                {connectPending ? "Saving…" : "Save pipeline settings"}
              </button>
            </div>
          </form>
        </Panel>
      ) : null}

      {connected && canPickProjectBoard && !loadingProjects && jiraProjects.length === 0 && !connectError ? (
        <p className="text-sm text-app-ink-dim">
          No Jira projects visible for your account. Confirm you have Browse projects permission in Jira.
        </p>
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
            {!columnOptions.length ? (
              <p className="text-xs text-app-ink-mute">
                {boardId && /^\d+$/.test(String(boardId))
                  ? "Loading columns… or save pipeline settings first."
                  : "Select a project and board above to load columns."}
              </p>
            ) : null}
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
        <Panel>
          <PanelHeader
            title="Jira vector index (RAG)"
            subtitle="Embeds ticket summaries and descriptions into Supabase pgvector for semantic search. Only reference + AI Worker statuses are vectorized — not the whole backlog."
          />
          <div className="space-y-4 p-4 sm:px-6">
            <p className="text-[13px] leading-relaxed text-app-ink-dim">
              <strong className="text-app-ink">Where to configure:</strong> pick reference columns
              below (Done, Resolved, …), save, then use{" "}
              <strong className="text-app-ink">Index Jira vectors</strong>. New or updated tickets
              only — already-embedded tickets are skipped. Requires{" "}
              <code className="font-mono text-[12px]">OPENAI_API_KEY</code> on the server.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={
                  referenceSyncPending ||
                  !referenceStatuses.length ||
                  !pipelineReady
                }
                onClick={handleIndexJiraVectors}
                className="app-btn-primary disabled:opacity-50"
              >
                {referenceSyncPending ? "Indexing…" : "Index Jira vectors"}
              </button>
              {!referenceStatuses.length ? (
                <p className="text-xs text-app-ink-mute">
                  Save reference columns first to enable indexing.
                </p>
              ) : (
                <p className="text-xs text-app-ink-dim">
                  Statuses: {referenceStatuses.join(", ")}
                  {intakeStatuses.length
                    ? ` · AI Worker: ${intakeStatuses.join(", ")}`
                    : ""}
                </p>
              )}
            </div>
          </div>
        </Panel>
      ) : null}

      {connected ? (
        <Panel>
          <PanelHeader
            title="Reference columns (context only)"
            subtitle="Done, Resolved, and similar columns — synced to Postgres and vector DB for RAG. Never start the agent pipeline."
          />
          <form className="space-y-4 p-4 sm:px-6" onSubmit={handleSaveReferenceColumns}>
            {!referenceColumnOptions.length ? (
              <p className="text-xs text-app-ink-mute">
                Load board columns above, then select which columns hold completed work for context.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {referenceColumnOptions.map((name) => (
                  <li key={name}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-app-sm border border-app-border px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={referenceColumns.includes(name)}
                        onChange={() => toggleReferenceColumn(name)}
                      />
                      <span>{name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={referencePending || !referenceColumnOptions.length}
                className="app-btn-primary disabled:opacity-50"
              >
                {referencePending ? "Saving…" : "Save reference columns"}
              </button>
              {referenceStatuses.length ? (
                <p className="text-xs text-app-ink-dim">
                  Embed statuses: {referenceStatuses.join(", ")}
                </p>
              ) : null}
            </div>
          </form>
        </Panel>
      ) : null}

      {connected ? (
        <>
          <JiraSyncStatusPanel setupSync={setup?.sync} connected={pipelineReady} />
          <JiraTicketBrowser connected={pipelineReady} />
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
