import { lazy, Suspense, useState } from "react";
import IndexProgressBar from "../../widgets/index-progress/IndexProgressBar";
import CodebaseInsightsPanel from "../../widgets/codebase-insights/CodebaseInsightsPanel";
import CodebaseIntelligenceStatusWidget from "../../widgets/codebase-intelligence-status/CodebaseIntelligenceStatusWidget";
import { useGitIntegrationSetup } from "../../entities/git-integration";
import Spinner from "../components/Spinner";
import { PageIntro } from "../../shared/ui/Panel";

const CodebaseVisualization = lazy(
  () => import("../../features/codebase-viz/CodebaseVisualization")
);

export default function CodebaseIntelligence() {
  const { data: setup } = useGitIntegrationSetup({ pollMs: 30000 });
  const git = setup?.git;
  const branch = git?.defaultBranch ?? "main";
  const connected = Boolean(setup?.connected);
  const [indexRunId, setIndexRunId] = useState(null);
  const [showMap, setShowMap] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[96rem] space-y-6">
      <PageIntro
        kicker="Codebase Intelligence"
        title="Insights from your repository"
        body="Summaries, patterns, and readiness for ticket workflows — without loading the entire codebase into the browser."
      />
      <CodebaseIntelligenceStatusWidget
        branch={branch}
        onIndexStarted={({ runId }) => setIndexRunId(runId)}
      />
      {connected ? (
        <IndexProgressBar
          runId={indexRunId ?? undefined}
          branch={branch}
          enabled
          title="Building codebase map"
        />
      ) : null}
      {connected ? <CodebaseInsightsPanel branch={branch} /> : null}
      {connected ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowMap((v) => !v)}
            className="rounded-full border border-indigo/50 bg-indigo/10 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink transition-all hover:shadow-glow-indigo"
          >
            {showMap ? "Hide interactive map" : "Open interactive map (heavy)"}
          </button>
          {showMap ? (
            <Suspense
              fallback={
                <div className="flex h-48 items-center justify-center rounded-[1.25rem] border border-hairline">
                  <Spinner label="Loading map…" />
                </div>
              }
            >
              <CodebaseVisualization branch={branch} refreshOnOpen />
            </Suspense>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
