import { NavLink, Outlet, useLocation } from "react-router-dom";
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
    <AnimatedAppPage className="max-w-5xl">
      <header>
        <h1 className="text-lg font-semibold text-app-ink">Settings</h1>
        <nav className="mt-4 flex gap-1 overflow-x-auto border-b border-app-border">
          {SETTINGS_NAV.map((item) => {
            const active = tabActive(item, location.pathname);
            return (
              <NavLink
                key={item.id}
                to={item.to}
                className={() =>
                  `-mb-px shrink-0 border-b-2 px-3 pb-3 pt-1 text-sm font-medium transition-colors ${
                    active
                      ? "border-indigo text-indigo"
                      : "border-transparent text-app-ink-dim hover:border-app-border hover:text-app-ink"
                  }`
                }
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </header>

      <div className="mt-6 min-w-0 rounded-xl border border-app-border bg-app-surface shadow-sm">
        <div className="p-6 sm:p-8">
          <Outlet />
        </div>
      </div>
    </AnimatedAppPage>
  );
}
