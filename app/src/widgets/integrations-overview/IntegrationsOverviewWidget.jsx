import JiraIntakeOverviewWidget from "../jira-intake-overview/JiraIntakeOverviewWidget";
import GitHubIntegrationOverviewWidget from "../github-integration-overview/GitHubIntegrationOverviewWidget";
import CodebaseIntelligenceStatusWidget from "../codebase-intelligence-status/CodebaseIntelligenceStatusWidget";
import { Panel, PanelHeader } from "../../shared/ui/Panel";

export default function IntegrationsOverviewWidget() {
  return (
    <Panel>
      <PanelHeader
        kicker="Integrations"
        title="Connected services"
      />
      <div className="flex w-full flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-stretch">
        <div className="min-w-0 flex-1">
          <JiraIntakeOverviewWidget embedded />
        </div>
        <div className="min-w-0 flex-1">
          <GitHubIntegrationOverviewWidget embedded />
        </div>
        <div className="min-w-0 flex-1">
          <CodebaseIntelligenceStatusWidget embedded showReindex={false} />
        </div>
      </div>
    </Panel>
  );
}
