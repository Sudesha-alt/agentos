import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { embedJiraIssue, useJiraSyncIssues } from "../../entities/jira-sync";
import EmptyState from "../../app/components/EmptyState";
import LabelPill from "../../app/components/LabelPill";
import Spinner from "../../app/components/Spinner";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import { formatRelativeTime } from "../../shared/lib/format";
import { motionSafe, pageStagger, sectionFadeUp } from "../../lib/motion";
import { useOrgPathBuilder } from "../../shared/providers/OrgRouteProvider";

const PAGE_SIZE = 10;

export default function JiraTicketBrowser({ connected }) {
  const orgPath = useOrgPathBuilder();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(0);
  const animatedRef = useRef(false);
  const [didAnimate, setDidAnimate] = useState(false);
  const [embeddingKey, setEmbeddingKey] = useState(null);

  useEffect(() => {
    setPage(0);
  }, [query, statusFilter]);

  const params = useMemo(
    () => ({
      q: query.trim() || undefined,
      status: statusFilter || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [query, statusFilter, page]
  );

  const { data, loading } = useJiraSyncIssues(params, {
    pollMs: connected ? 15000 : undefined,
    skip: !connected,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const pageEnd = Math.min((page + 1) * PAGE_SIZE, total);
  const canPrev = page > 0;
  const canNext = pageEnd < total;

  useEffect(() => {
    if (!loading && items.length > 0 && !animatedRef.current) {
      animatedRef.current = true;
      setDidAnimate(true);
    }
  }, [loading, items.length]);

  const safeStagger = motionSafe(pageStagger(0.03));
  const safeSection = motionSafe(sectionFadeUp);

  async function handleEmbed(jiraKey) {
    setEmbeddingKey(jiraKey);
    try {
      await embedJiraIssue(jiraKey);
    } finally {
      setEmbeddingKey(null);
    }
  }

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
          <table className="w-full table-fixed text-left text-[13px]">
            <thead>
              <tr className="border-b border-app-border type-kicker">
                <th className="w-[7rem] px-5 py-2">Key</th>
                <th className="px-3 py-2">Summary</th>
                <th className="w-[6rem] px-3 py-2">Type</th>
                <th className="w-[7rem] px-3 py-2">Status</th>
                <th className="w-[5rem] px-3 py-2">Updated</th>
                <th className="w-[11rem] px-5 py-2">Actions</th>
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
                  <td className="whitespace-normal break-words px-3 py-2.5">{item.summary}</td>
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
                    <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-3">
                      <button
                        type="button"
                        disabled={embeddingKey === item.jiraKey}
                        onClick={() => handleEmbed(item.jiraKey)}
                        className="text-left text-[12px] text-indigo hover:underline disabled:opacity-50"
                      >
                        {embeddingKey === item.jiraKey ? "Embedding…" : "Embed"}
                      </button>
                      <Link
                        to={`${orgPath("pm-agents")}?ticket=${encodeURIComponent(item.jiraKey)}`}
                        className="text-[12px] text-indigo hover:underline"
                      >
                        Analyze
                      </Link>
                      <Link
                        to={orgPath("pipelines")}
                        className="text-[12px] text-app-ink-mute hover:underline"
                      >
                        Pipelines
                      </Link>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </div>
      )}
      {total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-app-border px-5 py-3 sm:px-6">
          <p className="text-xs text-app-ink-mute">
            Showing {pageStart}–{pageEnd} of {total} synced tickets
            {total > PAGE_SIZE ? ` · Page ${page + 1} of ${Math.ceil(total / PAGE_SIZE)}` : ""}
          </p>
          {total > PAGE_SIZE ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!canPrev || loading}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-app-sm border border-app-border px-3 py-1.5 text-[12px] text-app-ink-dim transition hover:border-indigo/30 hover:text-indigo disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!canNext || loading}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-app-sm border border-app-border px-3 py-1.5 text-[12px] text-app-ink-dim transition hover:border-indigo/30 hover:text-indigo disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}
