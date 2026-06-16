import JiraIntakeOverviewWidget from "../jira-intake-overview/JiraIntakeOverviewWidget";
import GitHubIntegrationOverviewWidget from "../github-integration-overview/GitHubIntegrationOverviewWidget";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import { Link } from "react-router-dom";

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
      </div>
      <div className="border-t border-app-border px-5 py-3 sm:px-6">
        <Link
          to="/app/settings/codebase-index"
          className="text-[13px] font-medium text-indigo hover:underline"
        >
          Codebase indexing → Settings
        </Link>
      </div>
    </Panel>
  );
}
