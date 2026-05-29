import { NavLink } from "react-router-dom";
import Logo from "../../components/Logo";
import { APP_NAV_SECTIONS } from "../../shared/config/app";
import { usePipelineList } from "../../entities/pipeline";

const NAV_ICONS = {
  "/app": IconDashboard,
  "/app/pipelines": IconPipeline,
  "/app/codebase": IconCodebase,
  "/app/qa": IconQa,
  "/app/costs": IconCosts,
  "/app/audit": IconAudit,
  "/app/jira": IconAiWorker,
  "/app/jira-search": IconSearch,
  "/app/settings": IconSettings,
};

export default function Sidebar() {
  const { items: pipelines } = usePipelineList(undefined, { pollMs: 12_000 });
  const reviewCount = pipelines.filter((p) => p.status === "PAUSED").length;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-hairline bg-canvas/95 backdrop-blur-md md:flex">
      <div className="flex h-16 items-center border-b border-hairline px-5">
        <Logo />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {APP_NAV_SECTIONS.map((section, sectionIndex) => (
          <div
            key={section.id}
            className={sectionIndex > 0 ? "mt-8 border-t border-hairline/60 pt-6" : ""}
          >
            <p className="mb-2 px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = NAV_ICONS[item.to] ?? IconDashboard;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 rounded-[1rem] px-3 py-2.5 text-[13px] transition-colors duration-150 ${
                          isActive
                            ? "bg-surface text-ink shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]"
                            : "text-ink-dim hover:bg-surface/60 hover:text-ink"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={`flex size-5 items-center justify-center ${
                              isActive
                                ? "text-indigo"
                                : "text-ink-mute group-hover:text-ink"
                            }`}
                          >
                            <Icon />
                          </span>
                          {item.label}
                          {item.to === "/app/pipelines" && reviewCount > 0 ? (
                            <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-danger text-[10px] font-semibold text-canvas">
                              {reviewCount > 9 ? "9+" : reviewCount}
                            </span>
                          ) : null}
                          {isActive && (
                            <span className="ml-auto size-1.5 rounded-full bg-indigo shadow-[0_0_8px_2px_rgba(99,102,241,0.7)]" />
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mx-3 mb-4 rounded-[1rem] border border-hairline bg-surface/40 p-3">
        <div className="flex items-center justify-between">
          <span className="editorial-kicker text-ink-mute">System</span>
          <span className="size-1.5 rounded-full bg-success shadow-[0_0_8px_2px_rgba(34,197,94,0.6)]" />
        </div>
        <p className="mt-3 font-display text-[1.4rem] leading-none tracking-tight text-ink">
          Operational
        </p>
        <p className="mt-1 font-mono text-[11px] text-ink-dim">
          Editorial shell · v0.8.0
        </p>
      </div>
    </aside>
  );
}

function IconDashboard() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="4.5" height="6" rx="1" stroke="currentColor" />
      <rect x="1.5" y="9" width="4.5" height="3.5" rx="1" stroke="currentColor" />
      <rect x="8" y="1.5" width="4.5" height="3.5" rx="1" stroke="currentColor" />
      <rect x="8" y="6.5" width="4.5" height="6" rx="1" stroke="currentColor" />
    </svg>
  );
}
function IconPipeline() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="3" cy="7" r="1.5" stroke="currentColor" />
      <circle cx="11" cy="7" r="1.5" stroke="currentColor" />
      <circle cx="7" cy="7" r="1.5" stroke="currentColor" />
      <path d="M4.5 7 H5.5 M8.5 7 H9.5" stroke="currentColor" />
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="2" stroke="currentColor" />
      <path
        d="M7 1.5v1.4M7 11.1v1.4M1.5 7h1.4M11.1 7h1.4M3.2 3.2l1 1M9.8 9.8l1 1M9.8 4.2l1-1M3.2 10.8l1-1"
        stroke="currentColor"
      />
    </svg>
  );
}
function IconAiWorker() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="2" y="3" width="10" height="8" rx="1" stroke="currentColor" />
      <path d="M4.5 6.5h5M4.5 8.5h3" stroke="currentColor" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="6" cy="6" r="3.5" stroke="currentColor" />
      <path d="M8.5 8.5L12 12" stroke="currentColor" />
    </svg>
  );
}
function IconCodebase() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M4 4L2 7l2 3M10 4l2 3-2 3" stroke="currentColor" />
    </svg>
  );
}
function IconQa() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 2v4M5 9h4M7 11v1" stroke="currentColor" />
      <circle cx="7" cy="7" r="5" stroke="currentColor" />
    </svg>
  );
}
function IconCosts() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 10V6M5 10V4M8 10V7M11 10V2" stroke="currentColor" />
    </svg>
  );
}
function IconAudit() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="3" y="2" width="8" height="10" rx="1" stroke="currentColor" />
      <path d="M5 5h4M5 7.5h4M5 10h2" stroke="currentColor" />
    </svg>
  );
}
