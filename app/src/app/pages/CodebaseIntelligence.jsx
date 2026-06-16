import { lazy, Suspense, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
import { useCodebaseLayerStatus } from "../../entities/codebase";
import Spinner from "../components/Spinner";
import { AppTabButton } from "../../shared/ui/AppChrome";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";
import { AgentPageWithChat } from "../../widgets/agent-chat/AgentPageWithChat";
import { AgentPageHeader } from "../../widgets/agent-chat/AgentPageHeader";
import { tabPanelFade, motionSafe } from "../../lib/motion";

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

function renderTabContent(tab, branch) {
  switch (tab) {
    case "explorer":
      return <CodebaseExplorer branch={branch} />;
    case "insights":
      return <CodebaseInsightsPanel branch={branch} />;
    case "map":
      return (
        <div className="space-y-2">
          <p className="type-kicker">Heavy visualization — loads on demand</p>
          <Suspense
            fallback={
              <div className="flex h-48 items-center justify-center rounded-app border border-app-border">
                <Spinner label="Loading map…" />
              </div>
            }
          >
            <CodebaseVisualization branch={branch} refreshOnOpen />
          </Suspense>
        </div>
      );
    case "search":
      return <CodebaseSearchPanel branch={branch} />;
    case "tour":
      return <CodebaseTourExperience branch={branch} />;
    case "impact":
      return <CodebaseImpactPanel branch={branch} />;
    case "health":
      return <CodebaseHealthPanel branch={branch} />;
    case "knowledge":
      return <CodebaseKnowledgePanel branch={branch} />;
    default:
      return <CodebaseExplorer branch={branch} />;
  }
}

export default function CodebaseIntelligence() {
  const { data: setup } = useGitIntegrationSetup({ pollMs: 30000 });
  const git = setup?.git;
  const gitBranch = git?.defaultBranch ?? "main";
  const { data: layerStatus } = useCodebaseLayerStatus({ branch: gitBranch, pollMs: 30000 });
  const branch = layerStatus?.repo?.defaultBranch ?? gitBranch;
  const connected =
    Boolean(setup?.connected) ||
    Boolean(layerStatus?.connected) ||
    Boolean(layerStatus?.ready);
  const [indexRunId, setIndexRunId] = useState(null);
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "explorer";

  function setTab(id) {
    const next = new URLSearchParams(params);
    next.set("tab", id);
    setParams(next, { replace: true });
  }

  return (
    <AnimatedAppPage wide>
      <AgentPageWithChat domain="ananta" contextKey={branch}>
      <AgentPageHeader domain="ananta" />
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
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((t) => (
              <AppTabButton key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label}
              </AppTabButton>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              variants={motionSafe(tabPanelFade)}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              {renderTabContent(tab, branch)}
            </motion.div>
          </AnimatePresence>
        </>
      ) : null}
      </AgentPageWithChat>
    </AnimatedAppPage>
  );
}
