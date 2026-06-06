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
        body="Jira intake, GitHub repository access, and codebase layer readiness at a glance."
      />
      <div className="grid gap-4 p-5 lg:grid-cols-3 sm:p-6">
        <JiraIntakeOverviewWidget embedded />
        <GitHubIntegrationOverviewWidget embedded />
        <CodebaseIntelligenceStatusWidget embedded showReindex={false} />
      </div>
    </Panel>
  );
}
