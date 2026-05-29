import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { usePipelineList } from "../../entities/pipeline";
import PipelineCard from "./PipelineCard";
import PipelineDetailPanel from "./PipelineDetailPanel";
import Spinner from "../../app/components/Spinner";
import EmptyState from "../../app/components/EmptyState";

const TABS = [
  { id: "active", label: "Active", statuses: ["RUNNING"] },
  { id: "review", label: "Review queue", statuses: ["PAUSED"] },
  { id: "history", label: "History", statuses: ["COMPLETED", "FAILED"] },
];

export default function PipelineExplorerWidget() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "active";
  const selectedId = params.get("selected");
  const query = params.get("q") ?? "";

  const { items, loading } = usePipelineList(undefined, { pollMs: 10_000 });

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
    <div className="flex h-[calc(100vh-8.5rem)] min-h-[520px] overflow-hidden rounded-[1.25rem] border border-hairline bg-surface/20">
      <div className="flex w-full max-w-md shrink-0 flex-col border-r border-hairline">
        <div className="border-b border-hairline p-4">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-full px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] transition-colors ${
                  tab === t.id
                    ? "bg-indigo/15 text-ink"
                    : "text-ink-dim hover:text-ink"
                }`}
              >
                {t.label}
                {t.id === "review" && reviewCount > 0 ? (
                  <span className="ml-1.5 inline-flex size-4 items-center justify-center rounded-full bg-danger text-[10px] text-canvas">
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
            className="mt-3 h-9 w-full rounded-full border border-hairline bg-canvas/50 px-4 text-[13px] outline-none focus:border-indigo/40"
          />
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {loading && filtered.length === 0 ? (
            <Spinner label="Loading pipelines" />
          ) : filtered.length === 0 ? (
            <EmptyState title="No pipelines" body="Nothing in this queue right now." />
          ) : (
            filtered.map((pipeline) => (
              <PipelineCard
                key={pipeline.id}
                pipeline={pipeline}
                selected={selectedId === pipeline.id}
                onSelect={selectPipeline}
                showAction={tab === "review"}
              />
            ))
          )}
        </div>
      </div>

      <div className="hidden min-w-0 flex-1 md:block">
        <PipelineDetailPanel
          pipelineId={selectedId ?? filtered[0]?.id}
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
