import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Marketing from "./pages/Marketing";
import ContactPage from "./marketing/agent-team/ContactPage";
import RoiCalculatorPage from "./pages/RoiCalculatorPage";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import ForgotPassword, { ResetPassword } from "./pages/ForgotPassword";
import AppShell from "./app/layout/AppShell";
import {
  AuthProvider,
  PublicOnlyRoute,
  RequireAuth,
  RequireOnboardingComplete,
} from "./shared/providers/AuthProvider";
import { OrgRouteProvider } from "./shared/providers/OrgRouteProvider";
import AppCompatRedirect from "./shared/routing/AppCompatRedirect";
import { orgAppRouteElements } from "./shared/routing/OrgAppRoutes";

function OrgAppShell() {
  return (
    <RequireAuth>
      <RequireOnboardingComplete>
        <OrgRouteProvider>
          <AppShell />
        </OrgRouteProvider>
      </RequireOnboardingComplete>
    </RequireAuth>
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
          <Route path="/app/*" element={<AppCompatRedirect />} />
          <Route path="/:orgSlug" element={<OrgAppShell />}>
            {orgAppRouteElements}
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
