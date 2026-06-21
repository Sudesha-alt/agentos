import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import Marketing from "./pages/Marketing";
import {
  AuthProvider,
  PublicOnlyRoute,
  RequireAuth,
  RequireOnboardingComplete,
} from "./shared/providers/AuthProvider";
import { OrgRouteProvider } from "./shared/providers/OrgRouteProvider";
import AppCompatRedirect from "./shared/routing/AppCompatRedirect";
import { orgAppRouteElements } from "./shared/routing/OrgAppRoutes";
import AppBootstrapGate from "./shared/ui/AppBootstrapGate";
import AppPageFallback from "./shared/ui/AppPageFallback";

const Login = lazy(() => import("./pages/Login"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPasswordPage = lazy(() =>
  import("./pages/ForgotPassword").then((m) => ({ default: m.ResetPassword }))
);
const ContactPage = lazy(() => import("./marketing/agent-team/ContactPage"));
const RoiCalculatorPage = lazy(() => import("./pages/RoiCalculatorPage"));
const AppShell = lazy(() => import("./app/layout/AppShell"));

function OrgAppShell() {
  return (
    <RequireAuth>
      <RequireOnboardingComplete>
        <OrgRouteProvider>
          <Suspense fallback={<AppPageFallback />}>
            <AppShell />
          </Suspense>
        </OrgRouteProvider>
      </RequireOnboardingComplete>
    </RequireAuth>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppBootstrapGate>
          <Suspense fallback={<AppPageFallback />}>
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
                  <ResetPasswordPage />
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
        </Suspense>
        </AppBootstrapGate>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
