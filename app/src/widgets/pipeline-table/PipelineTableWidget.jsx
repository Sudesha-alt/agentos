import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import StatusPill from "../../app/components/StatusPill";
import Spinner from "../../app/components/Spinner";
import EmptyState from "../../app/components/EmptyState";
import { Panel } from "../../shared/ui/Panel";
import { useOrgPathBuilder } from "../../shared/providers/OrgRouteProvider";
import { formatRelativeTime, formatStageLabel } from "../../shared/lib/format";
import { EASE } from "../../lib/motion";

const PIPELINE_FILTERS = [
  { id: "all", label: "All" },
  { id: "RUNNING", label: "Running" },
  { id: "PAUSED", label: "Awaiting human" },
  { id: "COMPLETED", label: "Completed" },
  { id: "FAILED", label: "Failed" },
];

export default function PipelineTableWidget({
  items,
  loading,
  filter,
  onFilterChange,
  query,
  onQueryChange,
}) {
  const orgPath = useOrgPathBuilder();
  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {PIPELINE_FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onFilterChange(option.id)}
              className={`rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors ${
                filter === option.id
                  ? "border-indigo/50 bg-indigo/10 text-ink"
                  : "border-hairline bg-surface/30 text-ink-dim hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="relative">
          <span className="sr-only">Search</span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search by Jira key or summary"
            className="h-10 w-full min-w-[260px] rounded-full border border-hairline bg-surface/40 pl-10 pr-4 text-[13px] text-ink outline-none placeholder:text-ink-mute focus:border-indigo/50"
          />
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-mute"
          >
            <circle cx="6" cy="6" r="4" stroke="currentColor" />
            <path d="M9.2 9.2L12 12" stroke="currentColor" strokeLinecap="round" />
          </svg>
        </label>
      </div>

      <Panel className="overflow-hidden">
        <div className="grid grid-cols-[140px_1fr_140px_140px_120px] gap-3 border-b border-hairline bg-canvas/35 px-5 py-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-mute">
          <span>Jira</span>
          <span>Summary</span>
          <span>Stage</span>
          <span>Status</span>
          <span className="text-right">Started</span>
        </div>

        {loading && items.length === 0 ? (
          <div className="px-5 py-10">
            <Spinner label="Loading pipelines" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No pipelines match this filter"
          />
        ) : (
          <ul>
            {items.map((item, index) => (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: EASE, delay: index * 0.03 }}
                className="border-t border-hairline first:border-t-0 hover:bg-canvas/25 transition-colors"
              >
                <Link
                  to={orgPath("pipelines", item.id)}
                  className="grid grid-cols-[140px_1fr_140px_140px_120px] items-center gap-3 px-5 py-4"
                >
                  <span className="font-mono text-[12px] text-ink">{item.jiraKey}</span>
                  <span className="truncate text-[14px] text-ink-dim">{item.summary}</span>
                  <span className="font-mono text-[11px] text-ink-mute">
                    {formatStageLabel(item.currentStage)}
                  </span>
                  <StatusPill status={item.status} />
                  <span className="text-right font-mono text-[11px] text-ink-mute">
                    {formatRelativeTime(item.startedAt)}
                  </span>
                </Link>
              </motion.li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
