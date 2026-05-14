import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Marketing from "./pages/Marketing";
import AppShell from "./app/layout/AppShell";
import Dashboard from "./app/pages/Dashboard";
import Pipelines from "./app/pages/Pipelines";
import PipelineDetail from "./app/pages/PipelineDetail";
import Override from "./app/pages/Override";
import Settings from "./app/pages/Settings";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Marketing />} />
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="pipelines" element={<Pipelines />} />
          <Route path="pipelines/:id" element={<PipelineDetail />} />
          <Route path="pipelines/:id/override" element={<Override />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
