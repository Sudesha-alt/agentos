import { Navigate, Route, Routes } from "react-router-dom";
import SettingsLayout from "../layout/SettingsLayout";
import SettingsPlanPage from "./settings/SettingsPlanPage";
import SettingsIntegrationsPage from "./settings/SettingsIntegrationsPage";
import SettingsIntegrationDetailPage from "./settings/SettingsIntegrationDetailPage";
import SettingsPipelinePage from "./settings/SettingsPipelinePage";
import SettingsCodebaseIndexPage from "./settings/SettingsCodebaseIndexPage";
import GitIntegration from "./GitIntegration";
import JiraIntegration from "./JiraIntegration";
import CompanyIntelligence from "./CompanyIntelligence";

export default function SettingsRoutes() {
  return (
    <Routes>
      <Route element={<SettingsLayout />}>
        <Route index element={<Navigate to="integrations" replace />} />
        <Route path="plan" element={<SettingsPlanPage />} />
        <Route path="integrations/github" element={<GitIntegration embedded />} />
        <Route path="integrations/jira" element={<JiraIntegration embedded />} />
        <Route path="integrations" element={<SettingsIntegrationsPage />} />
        <Route path="integrations/:integrationId" element={<SettingsIntegrationDetailPage />} />
        <Route path="codebase-index" element={<SettingsCodebaseIndexPage />} />
        <Route path="company" element={<CompanyIntelligence embedded />} />
        <Route path="pipeline" element={<SettingsPipelinePage />} />
      </Route>
    </Routes>
  );
}
