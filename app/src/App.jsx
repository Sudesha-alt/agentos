import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Marketing from "./pages/Marketing";
import Login from "./pages/Login";
import AppShell from "./app/layout/AppShell";
import Dashboard from "./app/pages/Dashboard";
import Pipelines from "./app/pages/Pipelines";
import PipelineDetail from "./app/pages/PipelineDetail";
import Override from "./app/pages/Override";
import Settings from "./app/pages/Settings";
import CodebaseIntelligence from "./app/pages/CodebaseIntelligence";
import QaCenter from "./app/pages/QaCenter";
import CostIntelligence from "./app/pages/CostIntelligence";
import AuditTrail from "./app/pages/AuditTrail";
import PrdViewer from "./app/pages/PrdViewer";
import GitIntegration from "./app/pages/GitIntegration";
import JiraIntegration from "./app/pages/JiraIntegration";
import JiraSearch from "./app/pages/JiraSearch";
import {
  AuthProvider,
  PublicOnlyRoute,
  RequireAuth,
} from "./shared/providers/AuthProvider";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Marketing />} />
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <Login />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/app"
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="pipelines" element={<Pipelines />} />
            <Route path="pipelines/:id" element={<PipelineDetail />} />
            <Route path="pipelines/:id/prd" element={<PrdViewer />} />
            <Route path="pipelines/:id/override" element={<Override />} />
            <Route path="codebase" element={<CodebaseIntelligence />} />
            <Route path="qa" element={<QaCenter />} />
            <Route path="costs" element={<CostIntelligence />} />
            <Route path="audit" element={<AuditTrail />} />
            <Route path="git" element={<GitIntegration />} />
            <Route path="jira" element={<JiraIntegration />} />
            <Route path="ai-worker" element={<JiraIntegration />} />
            <Route path="jira-search" element={<JiraSearch />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
