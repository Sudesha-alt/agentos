import { useMemo, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  useCodebaseVisualization,
  useCodebaseSearch,
  askCodebase,
} from "../../entities/codebase";
import { consumeMapHighlights } from "../../widgets/codebase-search/codebaseSearchUtils";
import TreemapCanvas from "./TreemapCanvas";
import MapMinimap from "./MapMinimap";
import ModuleGraphView from "./ModuleGraphView";
import TourOverlay from "./TourOverlay";
import ActivityTimeSlider from "./ActivityTimeSlider";
import FileInteriorView from "./FileInteriorView";
import { useCodebaseVizWs } from "./useCodebaseVizWs";
import { LAYERS } from "./layerColors";
import Spinner from "../../app/components/Spinner";

const LAYER_OPTIONS = [
  { id: LAYERS.structure, label: "Structure" },
  { id: LAYERS.language, label: "Language" },
  { id: LAYERS.activity, label: "Activity" },
  { id: LAYERS.quality, label: "Quality" },
  { id: LAYERS.understanding, label: "Understanding" },
  { id: LAYERS.agent, label: "Agent activity" },
];

export default function CodebaseVisualization({
  branch = "main",
  refreshOnOpen = false,
  tourMode = false,
  tourDefinition = null,
  tourOpen: controlledTourOpen,
  tourStep: controlledTourStep,
  onTourOpenChange,
  onTourStepChange,
  onOpenFile,
  onQuizAttempt,
  quizFeedback = null,
  hideWelcome = false,
  compact = false,
  mapNavigation = null,
}) {
  const { data, loading, error, refetch } = useCodebaseVisualization({
    branch,
    pollMs: 60_000,
    refresh: refreshOnOpen,
  });
  const [layoutOverride, setLayoutOverride] = useState(null);
  const [view, setView] = useState("map");
  const [fileView, setFileView] = useState(false);
  const [layer, setLayer] = useState(LAYERS.activity);
  const [focusPath, setFocusPath] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [question, setQuestion] = useState("");
  const [questionAnswer, setQuestionAnswer] = useState(null);
  const [manualHighlights, setManualHighlights] = useState(() => {
    const paths = consumeMapHighlights();
    return paths?.length ? new Set(paths) : null;
  });
  const [internalTourOpen, setInternalTourOpen] = useState(false);
  const [internalTourStep, setInternalTourStep] = useState(0);
  const tourOpen = controlledTourOpen ?? internalTourOpen;
  const setTourOpen = onTourOpenChange ?? setInternalTourOpen;
  const tourStep = controlledTourStep ?? internalTourStep;
  const setTourStep = onTourStepChange ?? setInternalTourStep;
  const [welcome, setWelcome] = useState(
    () => !hideWelcome && !tourMode && !localStorage.getItem("agentos-viz-tour-seen")
  );
  const [activityAsOf, setActivityAsOf] = useState(null);
  const [asking, setAsking] = useState(false);

  const { data: searchData } = useCodebaseSearch(searchQuery, { pollMs: 0 });

  const { status: wsStatus, reconnect: wsReconnect } = useCodebaseVizWs(branch, (message) => {
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

  const effectiveFocusPath =
    mapNavigation?.key != null ? (mapNavigation.focusPath ?? null) : focusPath;
  const effectiveManualHighlights = useMemo(() => {
    if (mapNavigation?.key == null) return manualHighlights;
    return mapNavigation.highlightPaths?.length
      ? new Set(mapNavigation.highlightPaths)
      : null;
  }, [mapNavigation, manualHighlights]);

  const focusPrefix = useMemo(() => {
    if (!effectiveFocusPath) return null;
    return effectiveFocusPath.endsWith("/") ? effectiveFocusPath : `${effectiveFocusPath}/`;
  }, [effectiveFocusPath]);

  const zoomLevel = fileView ? "file" : effectiveFocusPath ? "district" : "galaxy";

  const breadcrumb = useMemo(() => {
    if (!effectiveFocusPath) return ["repository"];
    return ["repository", ...effectiveFocusPath.split("/").filter(Boolean)];
  }, [effectiveFocusPath]);

  const highlights = useMemo(() => {
    if (effectiveManualHighlights) return effectiveManualHighlights;
    if (searchQuery.trim() && searchData?.results?.length) {
      return new Set(searchData.results.map((r) => r.path ?? r.file_path));
    }
    return new Set();
  }, [effectiveManualHighlights, searchQuery, searchData]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (fileView) {
          setFileView(false);
        } else if (focusPath) {
          const parts = focusPath.split("/").filter(Boolean);
          setFocusPath(parts.length > 1 ? parts.slice(0, -1).join("/") : null);
        }
        setSelectedFile(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fileView, focusPath]);

  const tourSteps = tourDefinition?.steps ?? activeLayout?.meta?.tourSteps ?? [];
  const quickReference =
    tourDefinition?.cheatSheet ?? activeLayout?.meta?.quickReference ?? [];
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

  const handleSelectNode = useCallback(
    (node) => {
      const parts = node.path.split("/").filter(Boolean);

      if (tourOpen && currentTourStep?.quiz && onQuizAttempt) {
        onQuizAttempt(parts[0] ?? node.path);
      }

      if (!effectiveFocusPath) {
        setFocusPath(parts[0]);
        return;
      }

      const prefix = effectiveFocusPath.endsWith("/")
        ? effectiveFocusPath
        : `${effectiveFocusPath}/`;
      const inFocus = node.path === effectiveFocusPath || node.path.startsWith(prefix);
      if (!inFocus) {
        setFocusPath(parts[0]);
        return;
      }

      const focusDepth = effectiveFocusPath.split("/").filter(Boolean).length;
      if (parts.length > focusDepth) {
        setSelectedFile(node);
        setFileView(true);
        return;
      }

      if (parts.length === focusDepth) {
        setSelectedFile(node);
        setFileView(true);
        return;
      }

      setFocusPath(parts.slice(0, focusDepth + 1).join("/"));
    },
    [effectiveFocusPath, tourOpen, currentTourStep, onQuizAttempt]
  );

  async function handleAskQuestion(e) {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    try {
      const result = await askCodebase(question, branch);
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
      <div className="flex h-[560px] items-center justify-center rounded-[1.25rem] border border-hairline bg-canvas/50">
        <Spinner label="Computing codebase map" />
      </div>
    );
  }

  if (error && !activeLayout) {
    return (
      <div className="flex h-[560px] flex-col items-center justify-center gap-3 rounded-[1.25rem] border border-danger/30 bg-danger/5 px-6 text-center">
        <p className="text-sm text-danger">Could not load the codebase map.</p>
        <p className="text-xs text-ink-dim">
          {error instanceof Error ? error.message : "Visualization API error"}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-full border border-indigo/50 bg-indigo/10 px-4 py-2 text-[13px] text-ink"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!loading && (!activeLayout?.nodes?.length || fileNodes.length === 0)) {
    return (
      <div className="flex h-[560px] flex-col items-center justify-center gap-3 rounded-[1.25rem] border border-hairline bg-canvas/50 px-6 text-center">
        <p className="font-display text-lg text-ink">Map not ready yet</p>
        <p className="max-w-md text-sm text-ink-dim">
          Indexing may still be running, or the graph has not been built for branch{" "}
          <code className="font-mono text-[12px] text-ink">{branch}</code>. Use{" "}
          <strong>Fetch &amp; index codebase</strong> above, then reload the map.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-full bg-indigo px-5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white"
        >
          Reload map
        </button>
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

          <span
            className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${
              zoomLevel === "galaxy"
                ? "bg-indigo/10 text-indigo"
                : zoomLevel === "district"
                  ? "bg-amber-500/10 text-amber-200"
                  : "bg-emerald-500/10 text-emerald-300"
            }`}
          >
            {zoomLevel === "galaxy" ? "Galaxy" : zoomLevel === "district" ? "District" : "File"}
          </span>

          <LiveBadge status={wsStatus} onReconnect={wsReconnect} />

          <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1 font-mono text-[11px] text-ink-mute">
            {breadcrumb.map((crumb, i) => (
              <span key={crumb} className="flex items-center gap-1">
                {i > 0 ? <span>/</span> : null}
                <button
                  type="button"
                  className="hover:text-ink"
                  onClick={() => {
                    setFileView(false);
                    setSelectedFile(null);
                    if (i === 0) setFocusPath(null);
                    else setFocusPath(breadcrumb.slice(1, i + 1).join("/"));
                  }}
                >
                  {crumb}
                </button>
              </span>
            ))}
          </nav>

          {!compact ? (
            <button
              type="button"
              onClick={() => setTourOpen(true)}
              className="rounded-full border border-hairline px-3 py-1.5 text-[12px] text-ink-dim hover:text-ink"
            >
              Replay tour
            </button>
          ) : null}
        </div>

        {!compact ? (
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
        ) : null}

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
                onClick={() => {
                  setFileView(false);
                }}
              >
                ← Back to map
              </button>
            </div>
            <div className="min-h-0 flex-1 p-3">
              <FileInteriorView filePath={selectedFile.path} branch={branch} />
            </div>
          </div>
        ) : view === "map" ? (
          <>
            <TreemapCanvas
              nodes={fileNodes}
              layer={layer}
              activityAsOfMs={layer === LAYERS.activity ? activityAsOfMs : undefined}
              highlightPaths={highlights}
              dimmed={highlights.size > 0}
              focusPrefix={focusPrefix}
              onHover={setHovered}
              onSelect={handleSelectNode}
            />
            <MapMinimap
              nodes={fileNodes}
              focusPath={effectiveFocusPath}
              onNavigate={(path) => {
                setFileView(false);
                setSelectedFile(null);
                setFocusPath(path);
              }}
            />
          </>
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
          onOpenFile={onOpenFile}
          quizFeedback={quizFeedback}
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

        {welcome && !tourMode ? (
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
            {(quickReference ?? []).map((item) => (
              <li key={item.question}>
                <button
                  type="button"
                  className="text-left text-[12px] text-ink-dim hover:text-indigo"
                  onClick={() => {
                    setFocusPath(item.pathPrefix);
                    if (item.highlightPaths?.length) {
                      setManualHighlights(new Set(item.highlightPaths));
                    } else {
                      setManualHighlights(null);
                    }
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

function LiveBadge({ status, onReconnect }) {
  const live = status === "live";
  const connecting = status === "connecting";
  return (
    <button
      type="button"
      onClick={status === "offline" ? onReconnect : undefined}
      title={status === "offline" ? "Click to reconnect" : undefined}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${
        live
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : connecting
            ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
            : "cursor-pointer border-hairline bg-surface/40 text-ink-mute hover:text-ink"
      }`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          live ? "bg-emerald-400 animate-pulse" : connecting ? "bg-amber-400" : "bg-ink-mute"
        }`}
      />
      {live ? "Live" : connecting ? "Connecting" : "Offline"}
    </button>
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
