import { useMemo } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { usePipelineList, usePipelineLive } from "../../entities/pipeline";
import { usePmAnalyses } from "../../entities/pm-agents";
import { mapPmAnalysisToPipelineSummary } from "../pm-analysis/pipelineIds";
import PipelineCard from "./PipelineCard";
import PipelineDetailPanel from "./PipelineDetailPanel";
import Spinner from "../../app/components/Spinner";
import EmptyState from "../../app/components/EmptyState";
import { motionSafe, pageStagger, sectionFadeUp } from "../../lib/motion";

const TABS = [
  { id: "active", label: "Active", statuses: ["RUNNING", "QUEUED"] },
  { id: "review", label: "Review queue", statuses: ["PAUSED"] },
  { id: "history", label: "History", statuses: ["COMPLETED", "FAILED"] },
];

export default function PipelineExplorerWidget() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "active";
  const selectedId = params.get("selected");
  const query = params.get("q") ?? "";

  const { items: pipelineItems, loading: pipelinesLoading } = usePipelineList(undefined, {
    pollMs: 10_000,
  });
  const { active: liveActive, queue: liveQueue } = usePipelineLive({ pollMs: 4000 });
  const { data: pmListData, loading: pmLoading } = usePmAnalyses({
    pollMs: 3000,
  });

  const items = useMemo(() => {
    const pmSummaries = (pmListData?.items ?? []).map(mapPmAnalysisToPipelineSummary);
    const classic = pipelineItems.map((p) => ({ ...p, kind: "pipeline" }));

    const runningKeys = new Set(classic.filter((p) => p.status === "RUNNING").map((p) => p.jiraKey));
    const queuedKeys = liveQueue?.queuedJiraKeys ?? [];
    const queuedItems = queuedKeys
      .filter((key) => key && !runningKeys.has(key))
      .map((jiraKey) => ({
        id: `queued-${jiraKey}`,
        jiraKey,
        summary: jiraKey,
        status: "QUEUED",
        currentStage: "INGESTION",
        startedAt: new Date().toISOString(),
        kind: "queued",
      }));

    return [...pmSummaries, ...queuedItems, ...classic].sort((a, b) =>
      (b.startedAt ?? "").localeCompare(a.startedAt ?? "")
    );
  }, [pmListData, pipelineItems, liveQueue?.queuedJiraKeys]);

  const loading = pipelinesLoading && pmLoading && items.length === 0;

  const activeTab = TABS.find((t) => t.id === tab) ?? TABS[0];

  const filtered = useMemo(() => {
    let list = items.filter((p) => activeTab.statuses.includes(p.status));
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (p) =>
          p.jiraKey?.toLowerCase().includes(q) ||
          p.summary?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, activeTab, query]);

  const reviewCount = items.filter((p) => p.status === "PAUSED").length;

  function setTab(id) {
    const next = new URLSearchParams(params);
    next.set("tab", id);
    setParams(next, { replace: true });
  }

  function selectPipeline(id) {
    const next = new URLSearchParams(params);
    next.set("selected", id);
    setParams(next, { replace: true });
  }

  return (
    <div className="app-card flex min-h-[calc(100dvh-11rem)] overflow-hidden">
      <div className="flex w-full max-w-md shrink-0 flex-col border-r border-app-border bg-app-surface-muted/30">
        <div className="border-b border-app-border p-4">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                  tab === t.id
                    ? "bg-app-surface text-app-ink shadow-app-nav-active"
                    : "text-app-ink-dim hover:bg-app-surface/80 hover:text-app-ink"
                }`}
              >
                {t.label}
                {t.id === "review" && reviewCount > 0 ? (
                  <span className="ml-1.5 inline-flex size-4 items-center justify-center rounded-full bg-danger text-[10px] font-semibold text-white">
                    {reviewCount}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              if (e.target.value) next.set("q", e.target.value);
              else next.delete("q");
              setParams(next, { replace: true });
            }}
            placeholder="Search tickets"
            className="mt-3 h-10 w-full rounded-full border border-app-border bg-app-surface px-4 text-sm text-app-ink outline-none placeholder:text-app-ink-mute focus:border-indigo/40 focus:ring-2 focus:ring-indigo/10"
          />
        </div>

        <motion.div
          className="flex-1 space-y-1.5 overflow-y-auto p-2.5"
          variants={motionSafe(pageStagger(0.04))}
          initial="hidden"
          animate="show"
          key={tab}
        >
          {loading && filtered.length === 0 ? (
            <Spinner label="Loading pipelines" />
          ) : filtered.length === 0 ? (
            <EmptyState title="No pipelines" />
          ) : (
            filtered.map((pipeline) => (
              <motion.div key={pipeline.id} variants={motionSafe(sectionFadeUp)}>
                <PipelineCard
                  pipeline={pipeline}
                  selected={selectedId === pipeline.id}
                  onSelect={selectPipeline}
                  showAction={tab === "review"}
                />
              </motion.div>
            ))
          )}
        </motion.div>
      </div>

      <div className="hidden min-w-0 flex-1 md:block">
        <PipelineDetailPanel
          pipelineId={
            selectedId && !selectedId.startsWith("queued-")
              ? selectedId
              : filtered.find((p) => p.kind !== "queued")?.id ??
                liveActive?.pipelineId
          }
          onClose={
            selectedId
              ? () => {
                  const next = new URLSearchParams(params);
                  next.delete("selected");
                  setParams(next, { replace: true });
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
