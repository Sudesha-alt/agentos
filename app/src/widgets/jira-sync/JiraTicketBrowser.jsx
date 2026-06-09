import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useJiraSyncIssues } from "../../entities/jira-sync";
import EmptyState from "../../app/components/EmptyState";
import LabelPill from "../../app/components/LabelPill";
import Spinner from "../../app/components/Spinner";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import { formatRelativeTime } from "../../shared/lib/format";

export default function JiraTicketBrowser({ connected }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const params = useMemo(
    () => ({
      q: query.trim() || undefined,
      status: statusFilter || undefined,
      limit: 50,
    }),
    [query, statusFilter]
  );

  const { data, loading } = useJiraSyncIssues(params, {
    pollMs: connected ? 15000 : undefined,
  });

  const items = data?.items ?? [];

  if (!connected) return null;

  return (
    <Panel>
      <PanelHeader
        title="Synced tickets"
        subtitle="Browse all Jira tickets synced into AgentOS."
      />
      <div className="border-b border-white/10 px-5 py-3 sm:px-6">
        <div className="flex flex-wrap gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search key or summary"
            className="min-w-[200px] flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="Filter by status"
            className="w-40 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {loading && !items.length ? <Spinner /> : null}
      {!loading && !items.length ? (
        <EmptyState
          title="No synced tickets yet"
          body="Run a full sync after connecting Jira to import all project tickets."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase text-white/45">
                <th className="px-5 py-2 font-mono">Key</th>
                <th className="px-3 py-2">Summary</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-5 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {items.map((item) => (
                <tr key={item.jiraKey} className="hover:bg-white/5">
                  <td className="px-5 py-3 font-mono text-violet-300">{item.jiraKey}</td>
                  <td className="max-w-md truncate px-3 py-3">{item.summary}</td>
                  <td className="px-3 py-3">
                    <LabelPill label={item.issueType} tone="muted" />
                  </td>
                  <td className="px-3 py-3">
                    <LabelPill label={item.status} tone="indigo" />
                  </td>
                  <td className="px-3 py-3 text-xs text-white/50">
                    {item.jiraUpdatedAt
                      ? formatRelativeTime(item.jiraUpdatedAt)
                      : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      to={`/app/pm-agents?ticket=${encodeURIComponent(item.jiraKey)}`}
                      className="mr-3 text-xs text-violet-300 hover:underline"
                    >
                      Analyze
                    </Link>
                    <Link
                      to="/app/pipelines"
                      className="text-xs text-white/50 hover:underline"
                    >
                      Pipelines
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data?.total > items.length ? (
        <p className="px-5 py-3 text-xs text-white/45">
          Showing {items.length} of {data.total} synced tickets
        </p>
      ) : null}
    </Panel>
  );
}
