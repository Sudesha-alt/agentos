import { NavLink } from "react-router-dom";
import { APP_NAV } from "../../shared/config/app";

export default function MobileNav() {
  return (
    <nav className="app-glass sticky top-[4.25rem] z-10 flex gap-2 overflow-x-auto border-b border-app-border px-4 py-2.5 md:hidden">
      {APP_NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/app/settings" ? false : item.end}
          className={({ isActive }) =>
            `shrink-0 rounded-full px-3.5 py-2 text-xs font-medium transition-all ${
              isActive
                ? "bg-app-surface text-app-ink shadow-app-nav-active"
                : "text-app-ink-dim hover:bg-white/70 hover:text-app-ink"
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
