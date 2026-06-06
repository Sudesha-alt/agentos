import JiraIntakeOverviewWidget from "../jira-intake-overview/JiraIntakeOverviewWidget";
import GitHubIntegrationOverviewWidget from "../github-integration-overview/GitHubIntegrationOverviewWidget";
import { Panel, PanelHeader } from "../../shared/ui/Panel";

export default function IntegrationsOverviewWidget() {
  return (
    <Panel>
      <PanelHeader
        kicker="Integrations"
        title="Connected services"
        body="Jira intake and GitHub repository access at a glance."
      />
      <div className="grid gap-4 p-5 lg:grid-cols-2 sm:p-6">
        <JiraIntakeOverviewWidget embedded />
        <GitHubIntegrationOverviewWidget embedded />
      </div>
    </Panel>
  );
}
