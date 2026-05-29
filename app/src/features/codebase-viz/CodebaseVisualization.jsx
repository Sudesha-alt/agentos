import { useMemo, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  useCodebaseVisualization,
  useCodebaseSearch,
  askCodebase,
} from "../../entities/codebase";
import TreemapCanvas from "./TreemapCanvas";
import ModuleGraphView from "./ModuleGraphView";
import TourOverlay from "./TourOverlay";
import ActivityTimeSlider from "./ActivityTimeSlider";
import FileInteriorView from "./FileInteriorView";
import { useCodebaseVizWs } from "./useCodebaseVizWs";
import { LAYERS } from "./layerColors";
import Spinner from "../../app/components/Spinner";

const LAYER_OPTIONS = [
  { id: LAYERS.structure, label: "Structure" },
  { id: LAYERS.activity, label: "Activity" },
  { id: LAYERS.quality, label: "Quality" },
  { id: LAYERS.understanding, label: "Understanding" },
];

const BRANCH = "main";

export default function CodebaseVisualization() {
  const { data, loading } = useCodebaseVisualization({ pollMs: 120_000 });
  const [layoutOverride, setLayoutOverride] = useState(null);
  const [view, setView] = useState("map");
  const [fileView, setFileView] = useState(false);
  const [layer, setLayer] = useState(LAYERS.activity);
  const [agentOverlay, setAgentOverlay] = useState(false);
  const [focusPath, setFocusPath] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [question, setQuestion] = useState("");
  const [questionAnswer, setQuestionAnswer] = useState(null);
  const [manualHighlights, setManualHighlights] = useState(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [welcome, setWelcome] = useState(() => !localStorage.getItem("agentos-viz-tour-seen"));
  const [activityAsOf, setActivityAsOf] = useState(null);
  const [asking, setAsking] = useState(false);

  const { data: searchData } = useCodebaseSearch(searchQuery, { pollMs: 0 });

  useCodebaseVizWs(BRANCH, (message) => {
    if (message.type === "layout_refresh") {
      setLayoutOverride(message.layout);
      return;
    }
    if (message.type === "node_update") {
      setLayoutOverride((prev) => {
        const base = prev ?? data;
        if (!base) return prev;
        const nodes = [...base.nodes];
        for (const node of message.nodes) {
          const idx = nodes.findIndex((n) => n.path === node.path);
          if (idx >= 0) nodes[idx] = { ...nodes[idx], ...node };
          else nodes.push(node);
        }
        return { ...base, nodes };
      });
      return;
    }
    if (message.type === "node_remove") {
      setLayoutOverride((prev) => {
        const base = prev ?? data;
        if (!base) return prev;
        const remove = new Set(message.paths);
        return { ...base, nodes: base.nodes.filter((n) => !remove.has(n.path)) };
      });
    }
  });

  const activeLayout = layoutOverride ?? data;
  const timelineMaxMs = activeLayout?.meta?.activityTimeline?.maxDate
    ? new Date(activeLayout.meta.activityTimeline.maxDate).getTime()
    : 0;
  const activityAsOfMs = activityAsOf ?? timelineMaxMs;

  const fileNodes = useMemo(
    () => (activeLayout?.nodes ?? []).filter((n) => n.type === "file"),
    [activeLayout]
  );

  const visibleNodes = useMemo(() => {
    if (!focusPath) return fileNodes;
    const prefix = focusPath.endsWith("/") ? focusPath : `${focusPath}/`;
    return fileNodes.filter((n) => n.path === focusPath || n.path.startsWith(prefix));
  }, [fileNodes, focusPath]);

  const breadcrumb = useMemo(() => {
    if (!focusPath) return ["repository"];
    return ["repository", ...focusPath.split("/").filter(Boolean)];
  }, [focusPath]);

  const highlights = useMemo(() => {
    if (manualHighlights) return manualHighlights;
    if (searchQuery.trim() && searchData?.results?.length) {
      return new Set(searchData.results.map((r) => r.path));
    }
    return new Set();
  }, [manualHighlights, searchQuery, searchData]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setFocusPath(null);
        setSelectedFile(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tourSteps = activeLayout?.meta?.tourSteps ?? [];
  const currentTourStep = tourSteps[tourStep];

  function applyTourStep(step) {
    if (!step) return;
    setFocusPath(step.focusPath ?? null);
    if (step.highlightPaths?.length) {
      setManualHighlights(new Set(step.highlightPaths));
    } else {
      setManualHighlights(null);
    }
  }

  const handleSelectNode = useCallback((node) => {
    const parts = node.path.split("/").filter(Boolean);
    const segment = parts[0];

    if (!focusPath) {
      setFocusPath(segment);
      return;
    }

    const focusDepth = focusPath.split("/").filter(Boolean).length;
    if (parts.length > focusDepth || node.path === focusPath) {
      setSelectedFile(node);
      setFileView(true);
      return;
    }

    setFocusPath(parts.slice(0, -1).join("/") || segment);
  }, [focusPath]);

  async function handleAskQuestion(e) {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    try {
      const result = await askCodebase(question, BRANCH);
      setManualHighlights(new Set(result.highlightPaths ?? []));
      setQuestionAnswer(result.answer);
    } catch {
      setQuestionAnswer("Could not reach the codebase Q&A service.");
    } finally {
      setAsking(false);
    }
  }

  function startTour() {
    localStorage.setItem("agentos-viz-tour-seen", "1");
    setWelcome(false);
    setTourOpen(true);
    setTourStep(0);
    applyTourStep(tourSteps[0]);
  }

  if (loading && !activeLayout) {
    return (
      <div className="flex h-[560px] items-center justify-center">
        <Spinner label="Computing codebase map" />
      </div>
    );
  }

  return (
    <div className="relative flex h-[min(78vh,820px)] flex-col overflow-hidden rounded-[1.25rem] border border-hairline bg-canvas/50">
      <header className="shrink-0 border-b border-hairline px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-full border border-hairline bg-surface/40 p-1">
            <ViewToggle active={view === "map"} onClick={() => setView("map")}>
              District map
            </ViewToggle>
            <ViewToggle active={view === "graph"} onClick={() => setView("graph")}>
              Relationships
            </ViewToggle>
          </div>

          <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1 font-mono text-[11px] text-ink-mute">
            {breadcrumb.map((crumb, i) => (
              <span key={crumb} className="flex items-center gap-1">
                {i > 0 ? <span>/</span> : null}
                <button
                  type="button"
                  className="hover:text-ink"
                  onClick={() => {
                    if (i === 0) setFocusPath(null);
                    else setFocusPath(breadcrumb.slice(1, i + 1).join("/"));
                  }}
                >
                  {crumb}
                </button>
              </span>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setTourOpen(true)}
            className="rounded-full border border-hairline px-3 py-1.5 text-[12px] text-ink-dim hover:text-ink"
          >
            Replay tour
          </button>
        </div>

        <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_1fr]">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Semantic search — e.g. where is authentication handled"
            className="h-10 rounded-full border border-hairline bg-canvas/60 px-4 text-[13px] outline-none focus:border-indigo/40"
          />
          <form onSubmit={handleAskQuestion} className="flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question about this codebase"
              className="h-10 min-w-0 flex-1 rounded-full border border-hairline bg-canvas/60 px-4 text-[13px] outline-none focus:border-indigo/40"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full border border-indigo/40 bg-indigo/10 px-4 text-[13px]"
            >
              {asking ? "…" : "Ask"}
            </button>
          </form>
        </div>

        {view === "map" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {LAYER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLayer(opt.id)}
                className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${
                  layer === opt.id
                    ? "bg-indigo/15 text-ink"
                    : "text-ink-mute hover:text-ink"
                }`}
              >
                {opt.label}
              </button>
            ))}
            <label className="ml-2 flex items-center gap-2 text-[12px] text-ink-dim">
              <input
                type="checkbox"
                checked={agentOverlay}
                onChange={(e) => setAgentOverlay(e.target.checked)}
              />
              Agent changes (purple)
            </label>
            {activeLayout?.meta?.layoutKind === "voronoi" ? (
              <span className="font-mono text-[10px] text-indigo">Voronoi layout</span>
            ) : null}
          </div>
        ) : null}

        {layer === LAYERS.activity && view === "map" ? (
          <div className="mt-3">
            <ActivityTimeSlider
              timeline={activeLayout?.meta?.activityTimeline}
              value={activityAsOfMs}
              onChange={setActivityAsOf}
            />
          </div>
        ) : null}

        {questionAnswer ? (
          <p className="mt-2 text-[13px] text-ink-dim">{questionAnswer}</p>
        ) : null}
      </header>

      <div className="relative min-h-0 flex-1">
        {fileView && selectedFile ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-hairline px-4 py-2">
              <p className="font-mono text-[12px] text-indigo">{selectedFile.path}</p>
              <button
                type="button"
                className="text-[12px] text-ink-dim hover:text-ink"
                onClick={() => setFileView(false)}
              >
                ← Back to map
              </button>
            </div>
            <div className="min-h-0 flex-1 p-3">
              <FileInteriorView filePath={selectedFile.path} branch={BRANCH} />
            </div>
          </div>
        ) : view === "map" ? (
          <TreemapCanvas
            nodes={visibleNodes}
            layer={layer}
            agentOverlay={agentOverlay}
            activityAsOfMs={layer === LAYERS.activity ? activityAsOfMs : undefined}
            highlightPaths={highlights}
            dimmed={highlights.size > 0}
            onHover={setHovered}
            onSelect={handleSelectNode}
          />
        ) : (
          <ModuleGraphView
            nodes={fileNodes}
            edges={activeLayout?.edges}
            highlightPaths={highlights}
            onSelectModule={(mod) => setFocusPath(mod)}
          />
        )}

        {hovered && view === "map"
          ? createPortal(
              <div
                className="pointer-events-none fixed z-50 max-w-xs rounded-xl border border-hairline bg-surface/95 p-3 shadow-xl"
                style={{ left: 16, bottom: 16 }}
              >
                <p className="font-mono text-[11px] text-indigo">{hovered.path}</p>
                <p className="mt-2 text-[13px] text-ink-dim">{hovered.summary}</p>
                <p className="mt-2 font-mono text-[10px] text-ink-mute">
                  {hovered.size} lines · {hovered.coverage}% coverage · complexity{" "}
                  {hovered.complexity}/10
                </p>
              </div>,
              document.body
            )
          : null}

        <TourOverlay
          open={tourOpen && Boolean(currentTourStep)}
          step={currentTourStep}
          stepIndex={tourStep}
          totalSteps={tourSteps.length}
          onNext={() => {
            if (tourStep >= tourSteps.length - 1) {
              setTourOpen(false);
              return;
            }
            const next = tourStep + 1;
            setTourStep(next);
            applyTourStep(tourSteps[next]);
          }}
          onPrev={() => {
            const prev = Math.max(0, tourStep - 1);
            setTourStep(prev);
            applyTourStep(tourSteps[prev]);
          }}
          onSkip={() => setTourOpen(false)}
          onClose={() => setTourOpen(false)}
        />

        {welcome ? (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-canvas/80 backdrop-blur-sm">
            <div className="max-w-md rounded-2xl border border-hairline bg-surface p-8 text-center">
              <h2 className="font-display text-2xl text-ink">Welcome to your codebase</h2>
              <p className="mt-3 text-[14px] text-ink-dim">
                This is a map of understanding — not just files. Take a guided tour or explore on
                your own.
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <button type="button" onClick={startTour} className="btn-trace rounded-full px-5 py-2.5">
                  Take the tour
                </button>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem("agentos-viz-tour-seen", "1");
                    setWelcome(false);
                  }}
                  className="rounded-full border border-hairline px-5 py-2.5 text-[13px]"
                >
                  Explore on my own
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <aside className="grid shrink-0 gap-0 border-t border-hairline lg:grid-cols-[1fr_280px]">
        <div className="hidden border-r border-hairline px-4 py-3 lg:block">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
            Quick reference
          </p>
          <ul className="mt-2 space-y-1">
            {(activeLayout?.meta?.quickReference ?? []).map((item) => (
              <li key={item.question}>
                <button
                  type="button"
                  className="text-left text-[12px] text-ink-dim hover:text-indigo"
                  onClick={() => {
                    setFocusPath(item.pathPrefix);
                    setManualHighlights(null);
                  }}
                >
                  {item.question}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="px-4 py-3">
          {selectedFile ? (
            <>
              <p className="font-mono text-[11px] text-indigo">{selectedFile.path}</p>
              <p className="mt-2 text-[13px] text-ink-dim">{selectedFile.summary}</p>
              <p className="mt-2 font-mono text-[10px] text-ink-mute">
                Patterns: {(selectedFile.patterns ?? []).join(", ") || "—"}
              </p>
            </>
          ) : (
            <p className="text-[13px] text-ink-dim">
              {activeLayout?.meta?.totalFiles ?? 0} files ·{" "}
              {activeLayout?.meta?.totalLines?.toLocaleString() ?? 0}{" "}
              lines indexed
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function ViewToggle({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
        active ? "bg-indigo/15 text-ink" : "text-ink-mute hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
