import { lazy, Suspense, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useCodebaseTour,
  generateCodebaseTour,
} from "../../entities/codebase";
import {
  explorerUrl,
} from "../codebase-search/codebaseSearchUtils";
import Spinner from "../../app/components/Spinner";
import { Panel, PanelHeader } from "../../shared/ui/Panel";

const CodebaseVisualization = lazy(
  () => import("../../features/codebase-viz/CodebaseVisualization")
);

export default function CodebaseTourExperience({ branch = "main" }) {
  const navigate = useNavigate();
  const { data: tour, loading, error, refetch } = useCodebaseTour({ branch });
  const [generating, setGenerating] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState(null);
  const [cheatOpen, setCheatOpen] = useState(true);
  const [mapNavigation, setMapNavigation] = useState(null);

  const applyStepToMap = useCallback((step) => {
    if (!step) return;
    setMapNavigation({
      focusPath: step.focusPath ?? null,
      highlightPaths: step.highlightPaths,
      key: Date.now(),
    });
  }, []);

  const handleTourStepChange = useCallback(
    (next) => {
      setTourStep(next);
      setQuizFeedback(null);
      applyStepToMap(tour?.steps?.[next]);
    },
    [tour, applyStepToMap]
  );

  const handleOpenFile = useCallback(
    (filePath) => {
      navigate(explorerUrl(filePath, { tab: "explorer" }));
    },
    [navigate]
  );

  const handleQuizAttempt = useCallback(
    (path) => {
      const step = tour?.steps?.[tourStep];
      if (!step?.quiz) return;
      const prefix = step.quiz.correctPathPrefix;
      const correct =
        path === prefix ||
        path.startsWith(`${prefix}/`) ||
        prefix.startsWith(path);
      setQuizFeedback(correct ? "correct" : "incorrect");
      setMapNavigation({ focusPath: path, key: Date.now() });
    },
    [tour, tourStep]
  );

  const handleCheatClick = useCallback((item) => {
    setMapNavigation({
      focusPath: item.pathPrefix,
      highlightPaths: item.highlightPaths,
      key: Date.now(),
    });
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    try {
      await generateCodebaseTour(branch);
      await refetch();
    } finally {
      setGenerating(false);
    }
  }

  function startTour() {
    setTourStep(0);
    setQuizFeedback(null);
    setTourOpen(true);
    applyStepToMap(tour?.steps?.[0]);
  }

  const hasSteps = (tour?.steps?.length ?? 0) > 0;
  const isStale = tour?.source === "heuristic";

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader
          kicker="Guided tour"
          title="Learn this codebase step by step"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={startTour}
            disabled={!hasSteps || loading}
            className="btn-trace rounded-full bg-indigo px-5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white disabled:opacity-40"
          >
            {tourOpen ? "Resume tour" : "Start tour"}
          </button>
          <button
            type="button"
            onClick={() => {
              setTourStep(0);
              setQuizFeedback(null);
              setTourOpen(true);
              applyStepToMap(tour?.steps?.[0]);
            }}
            disabled={!hasSteps}
            className="rounded-full border border-hairline px-4 py-2 text-[13px] text-ink-dim hover:text-ink disabled:opacity-40"
          >
            Replay
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-full border border-indigo/40 bg-indigo/10 px-4 py-2 text-[13px] disabled:opacity-40"
          >
            {generating ? "Generating…" : isStale ? "Regenerate with AI" : "Generate tour"}
          </button>
          {tour?.generatedAt ? (
            <span className="self-center font-mono text-[10px] text-ink-mute">
              {tour.source === "openai" || tour.source === "claude"
                ? "AI-generated"
                : tour.source === "cache"
                  ? "Cached"
                  : "Heuristic"}{" "}
              ·{" "}
              {new Date(tour.generatedAt).toLocaleString()}
            </span>
          ) : null}
        </div>
      </Panel>

      {loading && !tour ? (
        <div className="flex h-48 items-center justify-center rounded-[1.25rem] border border-hairline">
          <Spinner label="Loading tour…" />
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-danger">
          Could not load tour: {error instanceof Error ? error.message : "Unknown error"}
        </p>
      ) : null}

      {!loading && !hasSteps ? (
        <Panel>
          <p className="text-sm text-ink-dim">
            No tour yet for branch <code className="font-mono text-[12px]">{branch}</code>. Run a
            full index or click Generate tour to build one from codebase intelligence.
          </p>
        </Panel>
      ) : null}

      {hasSteps ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
          <Suspense
            fallback={
              <div className="flex h-[560px] items-center justify-center rounded-[1.25rem] border border-hairline">
                <Spinner label="Loading map…" />
              </div>
            }
          >
            <CodebaseVisualization
              branch={branch}
              tourMode
              compact
              hideWelcome
              tourDefinition={tour}
              tourOpen={tourOpen}
              tourStep={tourStep}
              onTourOpenChange={setTourOpen}
              onTourStepChange={handleTourStepChange}
              onOpenFile={handleOpenFile}
              onQuizAttempt={handleQuizAttempt}
              quizFeedback={quizFeedback}
              mapNavigation={mapNavigation}
            />
          </Suspense>

          <aside className="rounded-[1.25rem] border border-hairline bg-surface/40">
            <button
              type="button"
              onClick={() => setCheatOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
                Cheat sheet
              </span>
              <span className="text-[12px] text-ink-dim">{cheatOpen ? "−" : "+"}</span>
            </button>
            {cheatOpen ? (
              <ul className="max-h-[min(72vh,640px)] space-y-1 overflow-y-auto border-t border-hairline px-4 py-3">
                {(tour?.cheatSheet ?? []).map((item) => (
                  <li key={item.question}>
                    <button
                      type="button"
                      className="w-full rounded-lg px-2 py-2 text-left text-[13px] text-ink-dim hover:bg-indigo/5 hover:text-indigo"
                      onClick={() => handleCheatClick(item)}
                    >
                      {item.question}
                    </button>
                    <button
                      type="button"
                      className="ml-2 font-mono text-[10px] text-ink-mute hover:text-indigo"
                      onClick={() => navigate(explorerUrl(item.pathPrefix, { tab: "explorer" }))}
                    >
                      Open in explorer →
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
