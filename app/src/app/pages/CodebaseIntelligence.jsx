import { lazy, Suspense, useState } from "react";
import { useSearchParams } from "react-router-dom";
import IndexProgressBar from "../../widgets/index-progress/IndexProgressBar";
import CodebaseInsightsPanel from "../../widgets/codebase-insights/CodebaseInsightsPanel";
import CodebaseExplorer from "../../widgets/codebase-explorer/CodebaseExplorer";
import CodebaseSearchPanel from "../../widgets/codebase-search/CodebaseSearchPanel";
import CodebaseTourExperience from "../../widgets/codebase-tour/CodebaseTourExperience";
import CodebaseImpactPanel from "../../widgets/codebase-impact/CodebaseImpactPanel";
import CodebaseHealthPanel from "../../widgets/codebase-health/CodebaseHealthPanel";
import CodebaseKnowledgePanel from "../../widgets/codebase-knowledge/CodebaseKnowledgePanel";
import CodebaseIntelligenceStatusWidget from "../../widgets/codebase-intelligence-status/CodebaseIntelligenceStatusWidget";
import { useGitIntegrationSetup } from "../../entities/git-integration";
import Spinner from "../components/Spinner";
import { PageIntro } from "../../shared/ui/Panel";

const CodebaseVisualization = lazy(
  () => import("../../features/codebase-viz/CodebaseVisualization")
);

const TABS = [
  { id: "explorer", label: "Explorer" },
  { id: "insights", label: "Insights" },
  { id: "map", label: "Map" },
  { id: "search", label: "Search" },
  { id: "tour", label: "Tour" },
  { id: "impact", label: "Impact" },
  { id: "health", label: "Health" },
  { id: "knowledge", label: "Knowledge" },
];

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] ${
        active
          ? "bg-indigo text-white"
          : "border border-hairline text-ink-dim hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export default function CodebaseIntelligence() {
  const { data: setup } = useGitIntegrationSetup({ pollMs: 30000 });
  const git = setup?.git;
  const branch = git?.defaultBranch ?? "main";
  const connected = Boolean(setup?.connected);
  const [indexRunId, setIndexRunId] = useState(null);
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "explorer";

  function setTab(id) {
    const next = new URLSearchParams(params);
    next.set("tab", id);
    setParams(next, { replace: true });
  }

  return (
    <div className="mx-auto w-full max-w-[96rem] space-y-6">
      <PageIntro
        kicker="Codebase Intelligence"
        title="Insights from your repository"
        body="Browse indexed files by directory, read per-file intelligence, and open the map when you need the full visualization."
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

      {connected ? (
        <>
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <TabButton key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label}
              </TabButton>
            ))}
          </div>

          {tab === "explorer" ? <CodebaseExplorer branch={branch} /> : null}
          {tab === "insights" ? <CodebaseInsightsPanel branch={branch} /> : null}
          {tab === "map" ? (
            <div className="space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-mute">
                Heavy visualization — loads layout data on demand
              </p>
              <Suspense
                fallback={
                  <div className="flex h-48 items-center justify-center rounded-[1.25rem] border border-hairline">
                    <Spinner label="Loading map…" />
                  </div>
                }
              >
                <CodebaseVisualization branch={branch} refreshOnOpen />
              </Suspense>
            </div>
          ) : null}
          {tab === "search" ? <CodebaseSearchPanel branch={branch} /> : null}
          {tab === "tour" ? <CodebaseTourExperience branch={branch} /> : null}
          {tab === "impact" ? <CodebaseImpactPanel branch={branch} /> : null}
          {tab === "health" ? <CodebaseHealthPanel branch={branch} /> : null}
          {tab === "knowledge" ? <CodebaseKnowledgePanel branch={branch} /> : null}
        </>
      ) : null}
    </div>
  );
}
