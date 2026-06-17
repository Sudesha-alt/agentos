import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  buildAgentNav,
  buildAppNav,
  buildAppNavSections,
  buildPipelineSubNav,
} from "../config/app";
import { orgPathMatches } from "../routing/orgPaths";
import { useOrg } from "../providers/OrgRouteProvider";

export function useOrgNavigation() {
  const { orgSlug, orgPath } = useOrg();
  const location = useLocation();

  const sections = useMemo(() => buildAppNavSections(orgSlug), [orgSlug]);
  const pipelineSubNav = useMemo(() => buildPipelineSubNav(orgSlug), [orgSlug]);
  const agentNav = useMemo(() => buildAgentNav(orgSlug), [orgSlug]);
  const appNav = useMemo(() => buildAppNav(orgSlug), [orgSlug]);

  const pathMatches = (...segments) =>
    orgPathMatches(location.pathname, orgSlug, ...segments);

  return {
    orgSlug,
    orgPath,
    sections,
    pipelineSubNav,
    agentNav,
    appNav,
    pathMatches,
    location,
  };
}
