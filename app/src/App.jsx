import { lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import Marketing from "./pages/Marketing";
import ContactPage from "./marketing/agent-team/ContactPage";
import RoiCalculatorPage from "./pages/RoiCalculatorPage";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import ForgotPassword, { ResetPassword } from "./pages/ForgotPassword";
import AppShell from "./app/layout/AppShell";
import Dashboard from "./app/pages/Dashboard";
import Pipelines from "./app/pages/Pipelines";
import {
  AuthProvider,
  PublicOnlyRoute,
  RequireAuth,
  RequireOnboardingComplete,
} from "./shared/providers/AuthProvider";

const PipelineDetail = lazy(() => import("./app/pages/PipelineDetail"));
const Override = lazy(() => import("./app/pages/Override"));
const SettingsRoutes = lazy(() => import("./app/pages/SettingsRoutes"));
const AnantaWorkspace = lazy(() => import("./app/pages/AnantaWorkspace"));
const QaCenter = lazy(() => import("./app/pages/QaCenter"));
const CostIntelligence = lazy(() => import("./app/pages/CostIntelligence"));
const AuditTrail = lazy(() => import("./app/pages/AuditTrail"));
const PrdViewer = lazy(() => import("./app/pages/PrdViewer"));
const JiraSearch = lazy(() => import("./app/pages/JiraSearch"));
const PmAgents = lazy(() => import("./app/pages/PmAgents"));
const Roadmap = lazy(() => import("./app/pages/Roadmap"));
function EngineeringRedirect() {
  const { pipelineId } = useParams();
  return (
    <Navigate
      to={pipelineId ? `/app/ananta?pipeline=${encodeURIComponent(pipelineId)}` : "/app/ananta"}
      replace
    />
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Marketing />} />
          <Route path="/roi" element={<RoiCalculatorPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <Login />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PublicOnlyRoute>
                <ForgotPassword />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/reset-password"
            element={
              <PublicOnlyRoute>
                <ResetPassword />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/onboarding"
            element={
              <RequireAuth>
                <Onboarding />
              </RequireAuth>
            }
          />
          <Route
            path="/app"
            element={
              <RequireAuth>
                <RequireOnboardingComplete>
                  <AppShell />
                </RequireOnboardingComplete>
              </RequireAuth>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="pipelines" element={<Pipelines />} />
            <Route path="pipelines/:id" element={<PipelineDetail />} />
            <Route path="pm-agents" element={<PmAgents />} />
            <Route path="ananta" element={<AnantaWorkspace />} />
            <Route path="engineering" element={<EngineeringRedirect />} />
            <Route path="engineering/:pipelineId" element={<EngineeringRedirect />} />
            <Route path="pipelines/:id/prd" element={<PrdViewer />} />
            <Route path="pipelines/:id/override" element={<Override />} />
            <Route path="codebase" element={<Navigate to="/app/ananta" replace />} />
            <Route path="codebase/*" element={<Navigate to="/app/ananta" replace />} />
            <Route path="qa" element={<QaCenter />} />
            <Route path="roadmap" element={<Roadmap />} />
            <Route path="org-intelligence" element={<Navigate to="/app/roadmap" replace />} />
            <Route path="company-intelligence" element={<Navigate to="/app/settings/company" replace />} />
            <Route path="costs" element={<CostIntelligence />} />
            <Route path="audit" element={<AuditTrail />} />
            <Route path="git" element={<Navigate to="/app/settings/integrations/github" replace />} />
            <Route path="github" element={<Navigate to="/app/settings/integrations/github" replace />} />
            <Route path="jira" element={<Navigate to="/app/settings/integrations/jira" replace />} />
            <Route path="jira-search" element={<JiraSearch />} />
            <Route path="settings/*" element={<SettingsRoutes />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
