import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  advanceIssue,
  getBoardColumns,
  getIntegrationMapping,
  getIntegrationSetup,
  listAiWorkerIssues,
  saveIntegrationMapping,
  syncWorkingColumn,
} from "../../entities/jira-intake";
import { useResource } from "../../shared/lib/useResource";
import EmptyState from "../components/EmptyState";
import LabelPill from "../components/LabelPill";
import Spinner from "../components/Spinner";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";

export default function JiraIntegration() {
  const { data: setup, error: setupError, refetch: refetchSetup } = useResource(
    () => getIntegrationSetup(),
    []
  );

  const {
    data: issuesData,
    error: issuesError,
    loading: issuesLoading,
    refetch: refetchIssues,
  } = useResource(() => listAiWorkerIssues("1"), [], { pollMs: 10000 });

  const [columns, setColumns] = useState([]);
  const [columnsError, setColumnsError] = useState(null);
  const [workingColumn, setWorkingColumn] = useState("");
  const [nextColumn, setNextColumn] = useState("");
  const [mappingPending, setMappingPending] = useState(false);
  const [mappingMessage, setMappingMessage] = useState("");
  const [syncPending, setSyncPending] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [advancePendingKey, setAdvancePendingKey] = useState(null);
  const [copied, setCopied] = useState(false);

  const items = issuesData?.items ?? [];

  const loadMapping = useCallback(async () => {
    try {
      const [mapping, cols] = await Promise.all([
        getIntegrationMapping(),
        getBoardColumns(),
      ]);
      setColumns(cols.columns ?? []);
      setWorkingColumn(mapping.workingColumnName || "");
      setNextColumn(mapping.nextColumnName || "");
      setColumnsError(null);
    } catch (err) {
      setColumnsError(err);
    }
  }, []);

  useEffect(() => {
    void loadMapping();
  }, [loadMapping]);

  useEffect(() => {
    if (!setup?.mapping) return;
    if (setup.mapping.workingColumnName) {
      setWorkingColumn((prev) => prev || setup.mapping.workingColumnName);
    }
    if (setup.mapping.nextColumnName) {
      setNextColumn((prev) => prev || setup.mapping.nextColumnName);
    }
  }, [setup]);

  const columnOptions = useMemo(
    () => columns.map((c) => c.name).filter(Boolean),
    [columns]
  );

  const workingStatusesPreview = useMemo(() => {
    const col = columns.find(
      (c) => c.name.toLowerCase() === workingColumn.toLowerCase()
    );
    return col?.statuses?.length ? col.statuses : [];
  }, [columns, workingColumn]);

  async function handleCopyWebhook() {
    if (!setup?.webhookUrl) return;
    await navigator.clipboard.writeText(setup.webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSaveMapping(e) {
    e.preventDefault();
    setMappingPending(true);
    setMappingMessage("");
    try {
      await saveIntegrationMapping({
        workingColumnName: workingColumn,
        nextColumnName: nextColumn,
      });
      setMappingMessage("Column mapping saved.");
      await refetchSetup();
      await refetchIssues();
    } catch (err) {
      setMappingMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setMappingPending(false);
    }
  }

  async function handleSync() {
    setSyncPending(true);
    setSyncMessage("");
    try {
      const result = await syncWorkingColumn();
      setSyncMessage(`Synced ${result.synced} ticket(s) from Jira.`);
      await refetchIssues();
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncPending(false);
    }
  }

  async function handleAdvance(issueKey) {
    setAdvancePendingKey(issueKey);
    try {
      const result = await advanceIssue(issueKey);
      setSyncMessage(
        `${result.issueKey} moved to ${result.column} (${result.toStatus}).`
      );
      await refetchIssues();
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : "Advance failed");
    } finally {
      setAdvancePendingKey(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[82rem] space-y-6">
      <PageIntro
        kicker="Jira intake"
        title="Integrate Jira"
        body="Connect your board webhook, map which column is “working”, and pull or advance tickets from the AI Worker queue."
        right={
          <Link
            to="/app/jira-search"
            className="rounded-full border border-hairline bg-surface/60 px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-dim transition-colors hover:text-ink"
          >
            Board search
          </Link>
        }
      />

      {setupError ? (
        <EmptyState
          title="API offline"
          body="Start the server (Render) and set VITE_API_URL on Vercel. Configure JIRA_* on the server."
        />
      ) : null}

      <Panel>
        <PanelHeader
          kicker="Step 1"
          title="Webhook URL"
          body="Create a webhook in Jira (Settings → System → Webhooks). Paste this URL and enable Issue updated."
        />
        <div className="space-y-4 p-5 sm:p-6">
          {!setup ? (
            <Spinner />
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <code className="flex-1 break-all rounded-[0.85rem] border border-hairline bg-canvas/50 px-4 py-3 font-mono text-[12px] text-indigo">
                  {setup.webhookUrl}
                </code>
                <button
                  type="button"
                  onClick={() => void handleCopyWebhook()}
                  className="shrink-0 rounded-full border border-indigo/40 bg-indigo/15 px-5 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink"
                >
                  {copied ? "Copied" : "Copy URL"}
                </button>
              </div>
              <p className="text-[13px] leading-relaxed text-ink-dim">
                {setup.webhookHint}
              </p>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-mute">
                Events: {setup.webhookEvents?.join(", ")}
                {setup.jiraConfigured ? " · Jira credentials OK" : " · Set JIRA_* on server"}
              </p>
            </>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          kicker="Step 2"
          title="Map board columns"
          body="Choose the column where agents work, and the column tickets move to when you click Advance."
        />
        <form onSubmit={handleSaveMapping} className="space-y-4 p-5 sm:p-6">
          {columnsError ? (
            <p className="text-[13px] text-danger">
              {columnsError.message}. Check JIRA_BOARD_ID and API token on Render.
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="editorial-kicker text-ink-mute">Working column</span>
              <select
                value={workingColumn}
                onChange={(e) => setWorkingColumn(e.target.value)}
                className="mt-2 w-full rounded-[0.85rem] border border-hairline bg-canvas/50 px-4 py-2.5 text-[14px] text-ink"
              >
                <option value="">Select column…</option>
                {columnOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="editorial-kicker text-ink-mute">Next column (on Advance)</span>
              <select
                value={nextColumn}
                onChange={(e) => setNextColumn(e.target.value)}
                className="mt-2 w-full rounded-[0.85rem] border border-hairline bg-canvas/50 px-4 py-2.5 text-[14px] text-ink"
              >
                <option value="">Select column…</option>
                {columnOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {workingStatusesPreview.length > 0 ? (
            <p className="font-mono text-[11px] text-ink-dim">
              Working statuses: {workingStatusesPreview.join(" · ")}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={mappingPending || !workingColumn || !nextColumn}
              className="rounded-full bg-indigo px-5 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-white disabled:opacity-50"
            >
              {mappingPending ? "Saving…" : "Save mapping"}
            </button>
            <button
              type="button"
              onClick={() => void loadMapping()}
              className="rounded-full border border-hairline px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-dim"
            >
              Reload columns
            </button>
            {mappingMessage ? (
              <span className="font-mono text-[11px] text-ink-dim">{mappingMessage}</span>
            ) : null}
          </div>
        </form>
      </Panel>

      <Panel>
        <PanelHeader
          kicker="Step 3"
          title="Working queue"
          body="Pull tickets from the working column now, or wait for Jira webhooks when cards move."
          right={
            <button
              type="button"
              onClick={() => void handleSync()}
              disabled={syncPending}
              className="rounded-full border border-hairline bg-surface/60 px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-dim hover:text-ink disabled:opacity-50"
            >
              {syncPending ? "Syncing…" : "Sync from Jira"}
            </button>
          }
        />
        <div className="p-5 sm:p-6">
          {syncMessage ? (
            <p className="mb-4 font-mono text-[11px] text-ink-dim">{syncMessage}</p>
          ) : null}
          {issuesLoading && !items.length ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : issuesError ? (
            <EmptyState title="Queue unavailable" body={issuesError.message} />
          ) : !items.length ? (
            <EmptyState
              title="No tickets in working column"
              body='Click "Sync from Jira" or move a card into your working column in Jira.'
            />
          ) : (
            <ul className="space-y-3">
              {items.map((issue) => (
                <li
                  key={issue.issueKey}
                  className="rounded-[1rem] border border-hairline bg-canvas/40 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[12px] text-indigo">{issue.issueKey}</p>
                      <h3 className="mt-1 text-[15px] font-medium text-ink">
                        {issue.summary || "Untitled"}
                      </h3>
                      <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-mute">
                        {issue.status}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <LabelPill label="In queue" tone="success" />
                      <button
                        type="button"
                        disabled={advancePendingKey === issue.issueKey}
                        onClick={() => void handleAdvance(issue.issueKey)}
                        className="rounded-full border border-indigo/40 bg-indigo/10 px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-indigo disabled:opacity-50"
                      >
                        {advancePendingKey === issue.issueKey
                          ? "Moving…"
                          : `Advance → ${setup?.mapping?.nextColumnName || "next"}`}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </div>
  );
}
