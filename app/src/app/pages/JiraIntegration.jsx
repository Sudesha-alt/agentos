import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  advanceIssue,
  connectJiraIntegration,
  getBoardColumns,
  getJiraWebhookStatus,
  listAiWorkerIssues,
  registerJiraWebhook,
  saveIntegrationMapping,
  syncWorkingColumn,
  useIntegrationSetup,
} from "../../entities/jira-intake";
import { settingsAdapter } from "../../entities/settings";
import { useResource } from "../../shared/lib/useResource";
import EmptyState from "../components/EmptyState";
import LabelPill from "../components/LabelPill";
import Spinner from "../components/Spinner";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";
import JiraSetupGuideWidget from "../../widgets/jira-setup-guide/JiraSetupGuideWidget";

export default function JiraIntegration() {
  const {
    data: setup,
    error: setupError,
    loading: setupLoading,
    refetch: refetchSetup,
  } = useIntegrationSetup();

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
        body="Set VITE_API_URL on Vercel to your Render URL and redeploy."
      />
    );
  }

  return <JiraIntegrationContent setup={setup} refetchSetup={refetchSetup} />;
}

function JiraIntegrationContent({ setup, refetchSetup }) {
  const {
    data: issuesData,
    error: issuesError,
    loading: issuesLoading,
    refetch: refetchIssues,
  } = useResource(() => listAiWorkerIssues("1"), [], {
    pollMs: 10000,
    enabled: Boolean(setup?.connected),
  });

  const [baseUrl, setBaseUrl] = useState(() => setup?.jira?.baseUrl || "");
  const [email, setEmail] = useState(() => setup?.jira?.email || "");
  const [apiToken, setApiToken] = useState("");
  const [boardId, setBoardId] = useState(() => setup?.jira?.boardId || "");
  const [webhookSecret, setWebhookSecret] = useState(
    () => setup?.jira?.webhookSecret || ""
  );
  const [columns, setColumns] = useState([]);
  const [workingColumn, setWorkingColumn] = useState(
    () => setup?.mapping?.workingColumnName || ""
  );
  const [nextColumn, setNextColumn] = useState(
    () => setup?.mapping?.nextColumnName || ""
  );
  const [connectPending, setConnectPending] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [mappingPending, setMappingPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [syncPending, setSyncPending] = useState(false);
  const [advancePendingKey, setAdvancePendingKey] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [webhookRegistered, setWebhookRegistered] = useState(false);
  const [webhookRegisterPending, setWebhookRegisterPending] = useState(false);

  const connected = Boolean(setup?.connected);
  const items = issuesData?.items ?? [];
  const jiraAdminWebhooksUrl = baseUrl
    ? `${baseUrl.replace(/\/$/, "")}/plugins/servlet/webhooks`
    : null;
  const canConnect =
    baseUrl &&
    boardId &&
    (apiToken.trim() || setup?.jira?.hasApiToken);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ columns: cols }, webhookStatus] = await Promise.all([
          getBoardColumns(),
          getJiraWebhookStatus().catch(() => ({ registered: false })),
        ]);
        if (!cancelled && cols?.length) {
          setColumns(cols);
        }
        if (!cancelled) {
          setWebhookRegistered(Boolean(webhookStatus.registered));
        }
      } catch {
        /* columns load optional until mapping step */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected]);

  const columnOptions = useMemo(
    () => columns.map((c) => c.name).filter(Boolean),
    [columns]
  );

  async function handleConnect() {
    setConnectPending(true);
    setConnectError("");
    setStatusMessage("");
    try {
      const result = await connectJiraIntegration({
        baseUrl,
        email,
        boardId,
        apiToken: apiToken.trim() || undefined,
        webhookSecret: webhookSecret.trim() || undefined,
      });

      setColumns(result.columns ?? []);
      if (result.mapping?.workingColumnName) {
        setWorkingColumn(result.mapping.workingColumnName);
      } else if (result.columns?.length >= 2 && !workingColumn) {
        setWorkingColumn(result.columns[0].name);
      }
      if (result.mapping?.nextColumnName) {
        setNextColumn(result.mapping.nextColumnName);
      } else if (result.columns?.length >= 2 && !nextColumn) {
        setNextColumn(result.columns[1].name);
      }
      if (result.jira?.webhookSecret) {
        setWebhookSecret(result.jira.webhookSecret);
      }

      await settingsAdapter.save({
        ...(await settingsAdapter.get()),
        jiraBaseUrl: baseUrl,
        jiraEmail: email,
        jiraApiToken: apiToken.trim() ? apiToken : "stored-on-server",
        webhookSecret: result.jira?.webhookSecret || webhookSecret,
      });

      setStatusMessage(
        result.board?.name
          ? `Connected to Jira board “${result.board.name}”.`
          : "Connected to Jira."
      );
      if (result.webhookRegistration?.registered) {
        setWebhookRegistered(true);
      } else if (result.webhookRegistration?.error) {
        setWebhookRegistered(false);
        setStatusMessage(result.webhookRegistration.error);
      }

      await refetchSetup();
      try {
        const status = await getJiraWebhookStatus();
        setWebhookRegistered(Boolean(status.registered));
      } catch {
        /* optional */
      }
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnectPending(false);
    }
  }

  async function handleRegisterWebhook() {
    setWebhookRegisterPending(true);
    setStatusMessage("");
    try {
      const result = await registerJiraWebhook();
      setWebhookRegistered(Boolean(result.registered));
      setStatusMessage(
        result.created
          ? "Webhook created in Jira automatically."
          : "Webhook already registered in Jira."
      );
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Webhook registration failed");
    } finally {
      setWebhookRegisterPending(false);
    }
  }

  async function handleSaveMapping(e) {
    e.preventDefault();
    if (!connected) return;
    setMappingPending(true);
    setStatusMessage("");
    try {
      await saveIntegrationMapping({
        workingColumnName: workingColumn,
        nextColumnName: nextColumn,
      });
      setStatusMessage("Column mapping saved. Webhook will track the working column.");
      await refetchSetup();
      await refetchIssues();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setMappingPending(false);
    }
  }

  async function handleSync() {
    setSyncPending(true);
    try {
      const result = await syncWorkingColumn();
      setStatusMessage(`Synced ${result.synced} ticket(s) from Jira.`);
      await refetchIssues();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncPending(false);
    }
  }

  async function handleAdvance(issueKey) {
    setAdvancePendingKey(issueKey);
    try {
      const result = await advanceIssue(issueKey);
      setStatusMessage(
        `${result.issueKey} → ${result.column} (${result.toStatus})`
      );
      await refetchIssues();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Advance failed");
    } finally {
      setAdvancePendingKey(null);
    }
  }

  async function copyText(text, setter) {
    await navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  }

  return (
    <div className="mx-auto w-full max-w-[82rem] space-y-6">
      <PageIntro
        kicker="Jira intake"
        title={connected ? "Jira connected" : "Connect Jira"}
        body={
          connected
            ? "Webhook URL and secrets are ready. Map columns, sync your working queue, and advance tickets in one click."
            : "Paste your site URL and API token — we fetch your email, verify the board, and try to register the webhook in Jira for you."
        }
        right={
          connected ? (
            <LabelPill label="Integrated" tone="success" />
          ) : (
            <Link
              to="/app/jira-search"
              className="rounded-full border border-hairline px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-dim"
            >
              Board search
            </Link>
          )
        }
      />

      <JiraSetupGuideWidget
        connected={connected}
        webhookUrl={setup?.webhookUrl}
        baseUrl={baseUrl}
        defaultOpen={!connected}
      />

      <Panel>
        <PanelHeader
          kicker={connected ? "Connected" : "Step 1"}
          title="Jira account"
          body="Use the setup guide above for where to find each value. Saved credentials load from the server on refresh."
        />
        <div className="space-y-4 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Base URL"
              value={baseUrl}
              onChange={setBaseUrl}
              placeholder="https://your-domain.atlassian.net"
              hint="Jira site URL — see guide §1"
            />
            <Field
              label="Service email (optional)"
              value={email}
              onChange={setEmail}
              placeholder="Filled from Jira when you connect with API token"
            />
            <Field
              label="API token"
              value={apiToken}
              onChange={setApiToken}
              placeholder={
                setup?.jira?.hasApiToken
                  ? `Saved (${setup.jira.tokenHint}) — leave blank to keep`
                  : "Atlassian API token"
              }
              type="password"
              hint="Create at id.atlassian.com — see guide §2"
            />
            <Field
              label="Board ID"
              value={boardId}
              onChange={setBoardId}
              placeholder="e.g. 123"
              hint="Board search or Jira URL — see guide §4"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <ExternalLink
              href="https://id.atlassian.com/manage-profile/security/api-tokens"
              label="Create API token at Atlassian"
            />
            {jiraAdminWebhooksUrl ? (
              <ExternalLink href={jiraAdminWebhooksUrl} label="Open Jira webhooks (manual)" />
            ) : null}
          </div>

          {connectError ? (
            <p className="font-mono text-[11px] text-danger">{connectError}</p>
          ) : null}

          {!connected ? (
            <button
              type="button"
              disabled={connectPending || !canConnect}
              onClick={() => void handleConnect()}
              className="w-full rounded-full bg-indigo py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-white disabled:opacity-50 sm:w-auto sm:px-8"
            >
              {connectPending ? "Connecting…" : "Connect Jira"}
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={connectPending}
                onClick={() => void handleConnect()}
                className="rounded-full border border-hairline px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-dim"
              >
                {connectPending ? "Refreshing…" : "Re-test connection"}
              </button>
              {setup?.jira?.source === "environment" ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                  Credentials from server environment
                </span>
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                  Credentials saved on server
                </span>
              )}
            </div>
          )}
        </div>
      </Panel>

      {connected ? (
        <>
          <Panel>
            <PanelHeader
              kicker="Step 2"
              title="Webhook"
              body="We generate the URL and secret. With Jira admin access, Connect can register the webhook via API — otherwise use the manual link."
              right={
                webhookRegistered ? (
                  <LabelPill label="Registered in Jira" tone="success" />
                ) : (
                  <LabelPill label="Not in Jira yet" tone="warning" />
                )
              }
            />
            <div className="space-y-4 p-5 sm:p-6">
              {!webhookRegistered ? (
                <button
                  type="button"
                  disabled={webhookRegisterPending}
                  onClick={() => void handleRegisterWebhook()}
                  className="rounded-full bg-indigo px-5 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-white disabled:opacity-50"
                >
                  {webhookRegisterPending
                    ? "Registering in Jira…"
                    : "Register webhook in Jira"}
                </button>
              ) : null}
              <CopyRow
                label="Webhook URL"
                value={setup?.webhookUrl}
                copied={copiedUrl}
                onCopy={() => void copyText(setup?.webhookUrl, setCopiedUrl)}
              />
              <CopyRow
                label="Optional header x-agentos-secret"
                value={setup?.jira?.webhookSecret || webhookSecret}
                copied={copiedSecret}
                onCopy={() =>
                  void copyText(
                    setup?.jira?.webhookSecret || webhookSecret,
                    setCopiedSecret
                  )
                }
              />
              <p className="text-[13px] text-ink-dim">{setup?.webhookHint}</p>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              kicker="Step 3"
              title="Board columns"
              body="Pick working vs next column. Statuses under the working column are tracked automatically."
            />
            <form onSubmit={handleSaveMapping} className="space-y-4 p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Working column"
                  value={workingColumn}
                  onChange={setWorkingColumn}
                  options={columnOptions}
                />
                <SelectField
                  label="Next column (Advance)"
                  value={nextColumn}
                  onChange={setNextColumn}
                  options={columnOptions}
                />
              </div>
              <button
                type="submit"
                disabled={mappingPending || !workingColumn || !nextColumn}
                className="rounded-full bg-indigo px-5 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-white disabled:opacity-50"
              >
                {mappingPending ? "Saving…" : "Save column mapping"}
              </button>
            </form>
          </Panel>

          <Panel>
            <PanelHeader
              kicker="Step 4"
              title="Working queue"
              right={
                <button
                  type="button"
                  onClick={() => void handleSync()}
                  disabled={syncPending}
                  className="rounded-full border border-hairline px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-dim"
                >
                  {syncPending ? "Syncing…" : "Sync from Jira"}
                </button>
              }
            />
            <div className="p-5 sm:p-6">
              {statusMessage ? (
                <p className="mb-4 font-mono text-[11px] text-ink-dim">{statusMessage}</p>
              ) : null}
              {issuesLoading && !items.length ? (
                <div className="flex justify-center py-8">
                  <Spinner />
                </div>
              ) : issuesError ? (
                <EmptyState title="Queue error" body={issuesError.message} />
              ) : !items.length ? (
                <EmptyState
                  title="No tickets yet"
                  body="Move a card into the working column or click Sync from Jira."
                />
              ) : (
                <ul className="space-y-3">
                  {items.map((issue) => (
                    <li
                      key={issue.issueKey}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[1rem] border border-hairline bg-canvas/40 px-4 py-4"
                    >
                      <div>
                        <p className="font-mono text-[12px] text-indigo">{issue.issueKey}</p>
                        <p className="text-[15px] text-ink">{issue.summary}</p>
                      </div>
                      <button
                        type="button"
                        disabled={advancePendingKey === issue.issueKey}
                        onClick={() => void handleAdvance(issue.issueKey)}
                        className="rounded-full border border-indigo/40 bg-indigo/10 px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-indigo"
                      >
                        {advancePendingKey === issue.issueKey
                          ? "Moving…"
                          : `Advance → ${nextColumn || "next"}`}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", hint }) {
  return (
    <label className="block">
      <span className="editorial-kicker text-ink-mute">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-[0.85rem] border border-hairline bg-canvas/50 px-4 py-2.5 text-[14px] text-ink outline-none focus:border-indigo/50"
      />
      {hint ? (
        <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-mute">
          {hint}
        </p>
      ) : null}
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="editorial-kicker text-ink-mute">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-[0.85rem] border border-hairline bg-canvas/50 px-4 py-2.5 text-[14px] text-ink"
      >
        <option value="">Select…</option>
        {options.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ExternalLink({ href, label }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-indigo hover:underline"
    >
      {label} ↗
    </a>
  );
}

function CopyRow({ label, value, copied, onCopy }) {
  return (
    <div>
      <span className="editorial-kicker text-ink-mute">{label}</span>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="flex-1 break-all rounded-[0.85rem] border border-hairline bg-canvas/50 px-3 py-2 font-mono text-[11px] text-indigo">
          {value || "—"}
        </code>
        <button
          type="button"
          onClick={onCopy}
          disabled={!value}
          className="shrink-0 rounded-full border border-hairline px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
