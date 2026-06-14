import { NavLink, Outlet, useLocation } from "react-router-dom";
import { PageIntro } from "../../shared/ui/Panel";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";
import { SETTINGS_NAV } from "../../shared/config/settingsNav";

function tabActive(item, pathname) {
  if (pathname === item.to) return true;
  if (item.id === "integrations" && pathname.startsWith("/app/settings/integrations")) {
    return true;
  }
  if (item.id === "company" && pathname.startsWith("/app/settings/company")) {
    return true;
  }
  return false;
}

export default function SettingsLayout() {
  const location = useLocation();

  return (
    <AnimatedAppPage wide>
      <PageIntro
        kicker="Settings"
        title="Workspace settings"
        body="Plan, integrations, company context, and pipeline quality — everything that configures how AgentOS runs for your team."
      />

      <nav className="flex flex-wrap gap-1.5 border-b border-app-border pb-3">
        {SETTINGS_NAV.map((item) => {
          const active = tabActive(item, location.pathname);
          return (
            <NavLink
              key={item.id}
              to={item.to}
              className={() =>
                `rounded-full px-3.5 py-1.5 text-[13px] transition ${
                  active
                    ? "bg-indigo/12 font-medium text-app-ink"
                    : "text-app-ink-dim hover:bg-app-surface-muted hover:text-app-ink"
                }`
              }
            >
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-5 min-w-0">
        <Outlet />
      </div>
    </AnimatedAppPage>
  );
}
