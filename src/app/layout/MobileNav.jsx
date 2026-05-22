import { NavLink } from "react-router-dom";
import { APP_NAV } from "../../shared/config/app";

export default function MobileNav() {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-hairline bg-canvas/90 px-3 py-2 md:hidden">
      {APP_NAV.filter((item) => item.to !== "/app/settings").map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `shrink-0 rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
              isActive
                ? "bg-surface text-indigo shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
                : "text-ink-dim hover:text-ink"
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
