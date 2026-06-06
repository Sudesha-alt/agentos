import { Link } from "react-router-dom";
import CodebaseVisualization from "../../features/codebase-viz/CodebaseVisualization";
import IndexProgressBar from "../../widgets/index-progress/IndexProgressBar";
import { useGitIntegrationSetup } from "../../entities/git-integration";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";

export default function CodebaseIntelligence() {
  const { data: setup } = useGitIntegrationSetup({ pollMs: 30000 });
  const git = setup?.git;
  const branch = git?.defaultBranch ?? "main";
  const connected = Boolean(setup?.connected);
  const needsRepo = Boolean(setup?.needsRepoSelection);

  return (
    <div className="mx-auto w-full max-w-[96rem] space-y-6">
      <PageIntro
        kicker="Codebase Intelligence"
        title="A living map of understanding"
        body="Five toggleable layers — structure, relationships, activity, quality, and AI-generated meaning. Built for seniors scanning heat and interns taking the guided tour."
      />
      {!connected ? (
        <Panel>
          <PanelHeader
            kicker="GitHub required"
            title={needsRepo ? "Finish GitHub setup" : "Connect a repository first"}
            body={
              needsRepo
                ? "Your GitHub App is installed but no repository is selected yet. Pick one to start indexing."
                : "Codebase intelligence indexes your connected GitHub repository. Connect GitHub, select a repo, and indexing will begin automatically."
            }
          />
          <div className="px-5 py-4 sm:px-6">
            <Link
              to="/app/git"
              className="text-[13px] text-indigo underline hover:text-ink"
            >
              Open GitHub integration →
            </Link>
          </div>
        </Panel>
      ) : (
        <IndexProgressBar branch={branch} enabled title="Building codebase map" />
      )}
      {connected ? <CodebaseVisualization /> : null}
    </div>
  );
}
