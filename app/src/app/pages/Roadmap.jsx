import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createRoadmapItem,
  updateRoadmapItem,
  useRoadmapBoard,
} from "../../entities/roadmap";
import { useOrgIntelligence } from "../../entities/org-intelligence";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";
import { AgentPageWithChat } from "../../widgets/agent-chat/AgentPageWithChat";
import { AgentPageHeader } from "../../widgets/agent-chat/AgentPageHeader";
import Spinner from "../components/Spinner";

const ROUTE_TYPE_OPTIONS = [
  { id: "USER_INPUT", label: "Needs your input" },
  { id: "AGENT", label: "Agent can do this" },
  { id: "APPROVAL", label: "Needs approval" },
];

const ITEM_ICONS = {
  idea: "💡",
  initial: "🌱",
  identity: "🎨",
  build: "⚙️",
  gtm: "🚀",
  default: "📋",
};

export default function Roadmap() {
  const [tab, setTab] = useState("board");
  const [board, setBoard] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [addStageKey, setAddStageKey] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [newRouteType, setNewRouteType] = useState("USER_INPUT");
  const [error, setError] = useState("");

  const { data, loading, error: fetchError, refresh } = useRoadmapBoard();
  const displayBoard = board ?? data;
  const stageCount = displayBoard?.stages?.length ?? 0;

  const allItems = useMemo(
    () => displayBoard?.stages?.flatMap((s) => s.items) ?? [],
    [displayBoard]
  );

  const slugIndex = useMemo(() => {
    const map = new Map();
    for (const item of allItems) {
      map.set(item.slug, item);
    }
    return map;
  }, [allItems]);

  const onAdvance = useCallback(
    async (item) => {
      if (item.availability === "locked" || item.availability === "completed") return;
      setBusyId(item.id);
      setError("");
      try {
        const nextStatus =
          item.availability === "available" ? "IN_PROGRESS" : "COMPLETED";
        const updated = await updateRoadmapItem(item.id, { status: nextStatus });
        setBoard(updated);
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update ticket");
      } finally {
        setBusyId(null);
      }
    },
    [refresh]
  );

  const onComplete = useCallback(
    async (item) => {
      setBusyId(item.id);
      setError("");
      try {
        const updated = await updateRoadmapItem(item.id, { status: "COMPLETED" });
        setBoard(updated);
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not complete ticket");
      } finally {
        setBusyId(null);
      }
    },
    [refresh]
  );

  const onAddItem = async (e) => {
    e.preventDefault();
    if (!addStageKey || !newTitle.trim()) return;
    setError("");
    try {
      const updated = await createRoadmapItem({
        stageKey: addStageKey,
        title: newTitle.trim(),
        routeType: newRouteType,
      });
      setBoard(updated);
      setAddStageKey(null);
      setNewTitle("");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add ticket");
    }
  };

  return (
    <AnimatedAppPage wide>
      <AgentPageWithChat domain="virin" contextKey="">
      <div className="min-w-0 space-y-5">
        <AgentPageHeader domain="virin" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="type-kicker text-app-ink-mute">Structure</p>
            <h2 className="text-xl font-bold text-app-ink">
              {displayBoard?.title ?? "Roadmap"}
            </h2>
          </div>
          <div className="flex rounded-full border border-app-border p-1">
            <TabButton active={tab === "board"} onClick={() => setTab("board")}>
              Board
            </TabButton>
            <TabButton active={tab === "learnings"} onClick={() => setTab("learnings")}>
              Learnings
            </TabButton>
          </div>
        </div>

        {fetchError ? (
          <div className="rounded-xl border border-danger/30 bg-danger/5 px-5 py-4">
            <p className="text-[13px] text-danger">
              {fetchError instanceof Error ? fetchError.message : "Could not load roadmap."}
            </p>
            <button
              type="button"
              onClick={() => refresh()}
              className="mt-3 rounded-lg bg-app-surface px-3 py-1.5 text-[12px] font-medium text-app-ink hover:bg-white"
            >
              Retry
            </button>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-2 text-[13px] text-danger">
            {error}
          </p>
        ) : null}

        {tab === "learnings" ? <LearningsTab /> : null}

        {tab === "board" ? (
          loading && !displayBoard ? (
            <div className="flex h-64 items-center justify-center">
              <Spinner label="Loading roadmap" />
            </div>
          ) : !stageCount && !fetchError ? (
            <div className="rounded-xl border border-app-border bg-app-surface px-5 py-10 text-center">
              <p className="text-[13px] text-app-ink-dim">No roadmap stages yet.</p>
              <button
                type="button"
                onClick={() => refresh()}
                className="mt-3 text-[13px] font-medium text-indigo hover:underline"
              >
                Reload board
              </button>
            </div>
          ) : stageCount > 0 ? (
            <div
              className="relative overflow-x-auto rounded-2xl border border-app-border bg-[#f7f6f3] p-6"
              style={{
                backgroundImage:
                  "radial-gradient(circle, #d4d4d4 1px, transparent 1px)",
                backgroundSize: "18px 18px",
              }}
            >
              <div className="flex min-w-max gap-8 pb-4">
                {displayBoard.stages.map((stage) => (
                <section key={stage.id} className="w-[240px] shrink-0">
                  <header className="mb-4">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9a9a9a]">
                      {stage.label}
                    </p>
                    <p className="text-[11px] text-[#6b6b6b]">
                      {stage.completedCount}/{stage.totalCount}
                    </p>
                  </header>

                  <ul className="flex flex-col gap-3">
                    {stage.items.map((item) => (
                      <li key={item.id} className="relative">
                        <RoadmapCard
                          item={item}
                          icon={ITEM_ICONS[stage.key] ?? ITEM_ICONS.default}
                          busy={busyId === item.id}
                          onAdvance={() => onAdvance(item)}
                          onComplete={() => onComplete(item)}
                          blockers={(item.dependsOnSlugs ?? [])
                            .map((slug) => slugIndex.get(slug))
                            .filter(Boolean)}
                        />
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => {
                      setAddStageKey(stage.key);
                      setNewTitle("");
                    }}
                    className="mt-3 w-full rounded-xl border border-dashed border-[#c8c8c8] py-2 text-[12px] text-[#6b6b6b] transition hover:border-indigo/40 hover:text-indigo"
                  >
                    + Add ticket
                  </button>
                </section>
              ))}
            </div>

            <DependencyLines stages={displayBoard.stages} slugIndex={slugIndex} />
          </div>
          ) : null
        ) : null}

        {addStageKey ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <form
            onSubmit={onAddItem}
            className="w-full max-w-md rounded-2xl border border-app-border bg-white p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-app-ink">Add ticket</h2>
            <p className="mt-1 text-[12px] text-app-ink-dim">
              Stage: {addStageKey}
            </p>
            <label className="mt-4 block text-[12px] font-medium text-app-ink">
              Title
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-app-border px-3 py-2 text-[14px]"
                placeholder="e.g. Launch beta program"
                autoFocus
                required
              />
            </label>
            <label className="mt-3 block text-[12px] font-medium text-app-ink">
              Routing
              <select
                value={newRouteType}
                onChange={(e) => setNewRouteType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-app-border px-3 py-2 text-[14px]"
              >
                {ROUTE_TYPE_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddStageKey(null)}
                className="rounded-lg px-4 py-2 text-[13px] text-app-ink-dim hover:text-app-ink"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-indigo px-4 py-2 text-[13px] font-medium text-white hover:bg-indigo/90"
              >
                Add
              </button>
            </div>
          </form>
        </div>
      ) : null}
      </div>
      </AgentPageWithChat>
    </AnimatedAppPage>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-[12px] font-medium transition ${
        active ? "bg-indigo text-white" : "text-app-ink-dim hover:text-app-ink"
      }`}
    >
      {children}
    </button>
  );
}

function RoadmapCard({ item, icon, busy, onAdvance, onComplete, blockers }) {
  const isDone = item.availability === "completed";
  const isLocked = item.availability === "locked";
  const isAvailable = item.availability === "available";
  const inProgress = item.availability === "in_progress";

  return (
    <article
      className={`relative rounded-2xl border bg-white px-3 py-3 shadow-sm transition ${
        isDone
          ? "border-success/30"
          : isLocked
            ? "border-[#e8e8e8] opacity-70"
            : "border-[#e0e0e0] hover:border-indigo/30"
      }`}
    >
      {isAvailable ? (
        <span className="absolute right-2 top-2 rounded-full bg-[#3b82f6] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
          Available
        </span>
      ) : null}
      {isLocked ? (
        <span className="absolute right-2 top-2 text-[12px] text-[#aaa]" title="Blocked">
          🔒
        </span>
      ) : null}
      {isDone ? (
        <span className="absolute right-2 top-2 text-success" title="Complete">
          ✓
        </span>
      ) : null}

      <div className="flex gap-2 pr-14">
        <span className="text-lg leading-none">{icon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-semibold leading-snug text-[#2b2d33]">
            {item.title}
          </h3>
          <p className="mt-0.5 text-[11px] text-[#6b6b6b]">{item.statusHint}</p>
          {isLocked && blockers.length ? (
            <p className="mt-1 text-[10px] text-[#999]">
              After: {blockers.map((b) => b.title).join(", ")}
            </p>
          ) : null}
          {item.jiraKey ? (
            <Link
              to={`/app/jira-search?q=${encodeURIComponent(item.jiraKey)}`}
              className="mt-1 inline-block text-[10px] text-indigo hover:underline"
            >
              {item.jiraKey}
            </Link>
          ) : null}
        </div>
      </div>

      {!isDone && !isLocked ? (
        <div className="mt-3 flex gap-2">
          {inProgress ? (
            <button
              type="button"
              disabled={busy}
              onClick={onComplete}
              className="flex-1 rounded-lg bg-success/10 py-1.5 text-[11px] font-medium text-success hover:bg-success/20 disabled:opacity-50"
            >
              Mark complete
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={onAdvance}
              className="flex-1 rounded-lg bg-indigo/10 py-1.5 text-[11px] font-medium text-indigo hover:bg-indigo/20 disabled:opacity-50"
            >
              Start
            </button>
          )}
        </div>
      ) : null}
    </article>
  );
}

/** Simple cross-column dependency hints (visual routing guide). */
function DependencyLines({ stages, slugIndex }) {
  const crossLinks = [];
  for (const stage of stages) {
    for (const item of stage.items) {
      for (const depSlug of item.dependsOnSlugs ?? []) {
        const dep = slugIndex.get(depSlug);
        if (!dep || dep.stageKey === item.stageKey) continue;
        crossLinks.push({ from: dep.slug, to: item.slug });
      }
    }
  }
  if (!crossLinks.length) return null;

  return (
    <p className="mt-4 border-t border-[#ddd] pt-3 text-[11px] text-[#888]">
      {crossLinks.length} cross-stage dependencies — complete upstream tickets to unlock downstream work.
    </p>
  );
}

function LearningsTab() {
  const { data, loading } = useOrgIntelligence({ limit: 50, pollMs: 30_000 });
  const items = data?.items ?? [];

  if (loading && !items.length) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner label="Loading learnings" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <p className="rounded-xl border border-app-border px-5 py-8 text-[13px] text-app-ink-dim">
        No learnings yet. Complete pipeline runs to capture organizational intelligence.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-app-border rounded-xl border border-app-border bg-white">
      {items.map((item) => (
        <li key={item.id} className="px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12px] text-indigo">{item.jiraKey}</span>
            <span className="ml-auto text-[11px] text-app-ink-mute">
              {new Date(item.createdAt).toLocaleString()}
            </span>
          </div>
          <p className="mt-2 text-[13px] text-app-ink">{item.signal}</p>
        </li>
      ))}
    </ul>
  );
}
