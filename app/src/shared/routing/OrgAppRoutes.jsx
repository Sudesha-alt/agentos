import { lazy } from "react";
import { Navigate, Route, useParams, useSearchParams } from "react-router-dom";
import Dashboard from "../../app/pages/Dashboard";
import Pipelines from "../../app/pages/Pipelines";
import { useOrg } from "../providers/OrgRouteProvider";

const PipelineDetail = lazy(() => import("../../app/pages/PipelineDetail"));
const Override = lazy(() => import("../../app/pages/Override"));
const SettingsRoutes = lazy(() => import("../../app/pages/SettingsRoutes"));
const AnantaWorkspace = lazy(() => import("../../app/pages/AnantaWorkspace"));
const QaCenter = lazy(() => import("../../app/pages/QaCenter"));
const CostIntelligence = lazy(() => import("../../app/pages/CostIntelligence"));
const AuditTrail = lazy(() => import("../../app/pages/AuditTrail"));
const PrdViewer = lazy(() => import("../../app/pages/PrdViewer"));
const JiraSearch = lazy(() => import("../../app/pages/JiraSearch"));
const PmAgents = lazy(() => import("../../app/pages/PmAgents"));
const Roadmap = lazy(() => import("../../app/pages/Roadmap"));
const CodebaseIntelligence = lazy(() => import("../../app/pages/CodebaseIntelligence"));
const OrgNotFound = lazy(() => import("../../app/pages/OrgNotFound"));

function RedirectTo({ segments }) {
  const { orgPath } = useOrg();
  return <Navigate to={orgPath(...segments)} replace />;
}

export function EngineeringRedirect() {
  const { pipelineId } = useParams();
  const { orgPath } = useOrg();
  const [searchParams] = useSearchParams();
  const pipeline = searchParams.get("pipeline") || pipelineId;
  const target = pipeline
    ? `${orgPath("ananta")}?pipeline=${encodeURIComponent(pipeline)}`
    : orgPath("ananta");
  return <Navigate to={target} replace />;
}

export const orgAppRouteElements = (
  <>
    <Route index element={<Dashboard />} />
    <Route path="pipelines" element={<Pipelines />} />
    <Route path="pipelines/:id" element={<PipelineDetail />} />
    <Route path="pm-agents" element={<PmAgents />} />
    <Route path="ananta" element={<AnantaWorkspace />} />
    <Route path="engineering" element={<EngineeringRedirect />} />
    <Route path="engineering/:pipelineId" element={<EngineeringRedirect />} />
    <Route path="pipelines/:id/prd" element={<PrdViewer />} />
    <Route path="pipelines/:id/override" element={<Override />} />
    <Route path="codebase" element={<CodebaseIntelligence />} />
    <Route path="qa" element={<QaCenter />} />
    <Route path="roadmap" element={<Roadmap />} />
    <Route path="org-intelligence" element={<RedirectTo segments={["roadmap"]} />} />
    <Route path="company-intelligence" element={<RedirectTo segments={["settings", "company"]} />} />
    <Route path="costs" element={<CostIntelligence />} />
    <Route path="audit" element={<AuditTrail />} />
    <Route path="git" element={<RedirectTo segments={["settings", "integrations", "github"]} />} />
    <Route path="github" element={<RedirectTo segments={["settings", "integrations", "github"]} />} />
    <Route path="jira" element={<RedirectTo segments={["settings", "integrations", "jira"]} />} />
    <Route path="jira-search" element={<JiraSearch />} />
    <Route path="settings/*" element={<SettingsRoutes />} />
    <Route path="*" element={<OrgNotFound />} />
  </>
);
