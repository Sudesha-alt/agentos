import { orgPath } from "../routing/orgPaths";

export function buildSettingsNav(slug) {
  return [
    { id: "plan", label: "Plan & billing", to: orgPath(slug, "settings", "plan") },
    { id: "integrations", label: "Integrations", to: orgPath(slug, "settings", "integrations") },
    {
      id: "codebase-index",
      label: "Codebase indexing",
      to: orgPath(slug, "settings", "codebase-index"),
    },
    { id: "company", label: "Company profile", to: orgPath(slug, "settings", "company") },
    { id: "pipeline", label: "Pipeline & quality", to: orgPath(slug, "settings", "pipeline") },
  ];
}

/** @deprecated Use buildSettingsNav(slug) */
export const SETTINGS_NAV = buildSettingsNav("app");
