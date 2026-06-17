import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useJiraSyncIssues } from "../../entities/jira-sync";
import EmptyState from "../../app/components/EmptyState";
import LabelPill from "../../app/components/LabelPill";
import Spinner from "../../app/components/Spinner";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import { formatRelativeTime } from "../../shared/lib/format";
import { motionSafe, pageStagger, sectionFadeUp } from "../../lib/motion";
import { useOrgPathBuilder } from "../../shared/providers/OrgRouteProvider";

export default function JiraTicketBrowser({ connected }) {
  const orgPath = useOrgPathBuilder();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const animatedRef = useRef(false);
  const [didAnimate, setDidAnimate] = useState(false);

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

  useEffect(() => {
    if (!loading && items.length > 0 && !animatedRef.current) {
      animatedRef.current = true;
      setDidAnimate(true);
    }
  }, [loading, items.length]);

  const safeStagger = motionSafe(pageStagger(0.03));
  const safeSection = motionSafe(sectionFadeUp);

  if (!connected) return null;

  return (
    <Panel>
      <PanelHeader title="Synced tickets" />
      <div className="border-b border-app-border px-5 py-3 sm:px-6">
        <div className="flex flex-wrap gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search key or summary"
            className="min-w-[200px] flex-1 rounded-app-sm border border-app-border bg-app-surface px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="Filter by status"
            className="w-40 rounded-app-sm border border-app-border bg-app-surface px-3 py-2 text-sm"
          />
        </div>
      </div>

      {loading && !items.length ? <Spinner /> : null}
      {!loading && !items.length ? (
        <EmptyState
          title="No synced tickets yet"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-app-border type-kicker">
                <th className="px-5 py-2">Key</th>
                <th className="px-3 py-2">Summary</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-5 py-2">Actions</th>
              </tr>
            </thead>
            <motion.tbody
              className="divide-y divide-app-border"
              variants={didAnimate ? safeStagger : undefined}
              initial={didAnimate ? "hidden" : false}
              animate={didAnimate ? "show" : false}
            >
              {items.map((item) => (
                <motion.tr
                  key={item.jiraKey}
                  variants={didAnimate ? safeSection : undefined}
                  className="hover:bg-app-surface-muted/50"
                >
                  <td className="px-5 py-2.5 font-medium text-indigo">{item.jiraKey}</td>
                  <td className="max-w-md truncate px-3 py-2.5">{item.summary}</td>
                  <td className="px-3 py-2.5">
                    <LabelPill label={item.issueType} tone="muted" />
                  </td>
                  <td className="px-3 py-2.5">
                    <LabelPill label={item.status} tone="indigo" />
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-app-ink-mute">
                    {item.jiraUpdatedAt
                      ? formatRelativeTime(item.jiraUpdatedAt)
                      : "—"}
                  </td>
                  <td className="px-5 py-2.5">
                    <Link
                      to={`${orgPath("pm-agents")}?ticket=${encodeURIComponent(item.jiraKey)}`}
                      className="mr-3 text-[12px] text-indigo hover:underline"
                    >
                      Analyze
                    </Link>
                    <Link
                      to={orgPath("pipelines")}
                      className="text-[12px] text-app-ink-mute hover:underline"
                    >
                      Pipelines
                    </Link>
                  </td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </div>
      )}
      {data?.total > items.length ? (
        <p className="px-5 py-2.5 text-xs text-app-ink-mute">
          Showing {items.length} of {data.total} synced tickets
        </p>
      ) : null}
    </Panel>
  );
}
