import { NavLink, useLocation, useSearchParams } from "react-router-dom";
import Logo from "../../components/Logo";
import { APP_NAV_SECTIONS, AGENT_NAV, PIPELINE_SUB_NAV } from "../../shared/config/app";
import { usePipelineList } from "../../entities/pipeline";
import { derivePipelineCounts } from "../../shared/lib/pipelineCounts";
import { useSidebarCollapsed } from "../../shared/hooks/useSidebarCollapsed";
import { useNavExpanded } from "../../shared/hooks/useNavExpanded";

const NAV_ICONS = {
  "/app": IconDashboard,
  "/app/pipelines": IconPipeline,
  "/app/pm-agents": IconProduct,
  virin: IconProduct,
  ananta: IconCodebase,
  neel: IconQa,
  "/app/codebase": IconCodebase,
  "/app/roadmap": IconRoadmap,
  "/app/qa": IconQa,
  "/app/costs": IconCosts,
  "/app/audit": IconAudit,
  "/app/settings": IconSettings,
};

export default function Sidebar() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const pipelineTab = location.pathname.startsWith("/app/pipelines")
    ? (searchParams.get("tab") ?? "active")
    : "active";
  const codebaseTab = location.pathname.startsWith("/app/codebase")
    ? (searchParams.get("tab") ?? "explorer")
    : "explorer";
  const { collapsed, toggleCollapsed } = useSidebarCollapsed();
  const { isExpanded, toggle } = useNavExpanded(location.pathname);
  const { items: pipelines } = usePipelineList(undefined, { pollMs: 12_000 });
  const counts = derivePipelineCounts(pipelines);

  function agentIsActive(agent) {
    if (agent.id === "virin") {
      return (
        location.pathname.startsWith("/app/pm-agents") ||
        location.pathname.startsWith("/app/roadmap")
      );
    }
    if (agent.id === "ananta") {
      return location.pathname.startsWith("/app/codebase");
    }
    if (agent.id === "neel") {
      return location.pathname.startsWith("/app/qa");
    }
    return false;
  }

  function subIsActive(sub, agentId) {
    if (sub.to.includes("?tab=")) {
      const tab = new URL(sub.to, "http://local").searchParams.get("tab");
      if (agentId === "ananta") {
        return location.pathname === "/app/codebase" && codebaseTab === tab;
      }
    }
    if (sub.to === "/app/roadmap") {
      return location.pathname === "/app/roadmap";
    }
    if (sub.to === "/app/pm-agents") {
      return location.pathname === "/app/pm-agents";
    }
    if (sub.to === "/app/codebase") {
      return location.pathname === "/app/codebase" && codebaseTab !== "map";
    }
    if (sub.to === "/app/qa") {
      return location.pathname === "/app/qa";
    }
    return location.pathname + location.search === sub.to;
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 hidden flex-col py-6 transition-[width,padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:flex ${
        collapsed ? "w-16 px-2" : "w-[17.5rem] px-4"
      }`}
    >
      <button
        type="button"
        onClick={toggleCollapsed}
        className="absolute -right-3 top-[4.5rem] z-40 flex size-6 items-center justify-center rounded-full border border-app-border bg-app-surface text-app-ink-dim shadow-app-card transition hover:border-indigo/30 hover:text-app-ink"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
      >
        <IconChevron collapsed={collapsed} />
      </button>

      <div className={`mb-6 ${collapsed ? "flex justify-center px-0" : "px-2"}`}>
        {collapsed ? (
          <NavLink to="/app" aria-label="AgentOS home" className="inline-flex">
            <LogoMark />
          </NavLink>
        ) : (
          <Logo variant="light" href="/app" />
        )}
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-1">
        {APP_NAV_SECTIONS.map((section, sectionIndex) => (
          <div key={section.id} className={sectionIndex > 0 ? "mt-7" : ""}>
            {!collapsed ? (
              <p className="mb-2 px-3 type-kicker">{section.label}</p>
            ) : sectionIndex > 0 ? (
              <div className="my-3 border-t border-app-border/60" aria-hidden />
            ) : null}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                if ("end" in item && item.end) {
                  const Icon = NAV_ICONS[item.to] ?? IconDashboard;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end
                        title={collapsed ? item.label : undefined}
                        className={({ isActive }) =>
                          `group flex items-center rounded-full py-2 type-nav transition-all duration-200 ease-out ${
                            collapsed ? "justify-center px-2" : "gap-2.5 px-3"
                          } ${
                            isActive
                              ? "bg-app-surface text-app-ink shadow-app-nav-active"
                              : "text-app-ink-dim hover:bg-white/50 hover:text-app-ink"
                          }`
                        }
                      >
                        <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full text-app-ink-mute group-hover:text-app-ink-dim">
                          <Icon />
                        </span>
                        {!collapsed ? <span className="min-w-0 truncate">{item.label}</span> : null}
                      </NavLink>
                    </li>
                  );
                }
                return null;
              })}

              {"pipelineGroup" in section && section.pipelineGroup ? (
                <>
                  <li>
                    {collapsed ? (
                      <NavLink
                        to="/app/pipelines"
                        title="Pipelines"
                        className={({ isActive }) =>
                          `group mt-1 flex items-center justify-center rounded-full px-2 py-2 type-nav transition-all ${
                            isActive || location.pathname.startsWith("/app/pipelines")
                              ? "bg-app-surface text-app-ink shadow-app-nav-active"
                              : "text-app-ink-dim hover:bg-white/50 hover:text-app-ink"
                          }`
                        }
                      >
                        <span className="relative flex size-7 items-center justify-center">
                          <IconPipeline />
                          {counts.review > 0 ? (
                            <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-danger ring-2 ring-app-surface" />
                          ) : null}
                        </span>
                      </NavLink>
                    ) : (
                    <button
                      type="button"
                      onClick={() => !collapsed && toggle("pipelines")}
                      title={collapsed ? "Pipelines" : undefined}
                      className={`group mt-1 flex w-full items-center rounded-full py-2 type-nav transition-all duration-200 ease-out ${
                        collapsed ? "justify-center px-2" : "gap-2.5 px-3"
                      } ${
                        location.pathname.startsWith("/app/pipelines")
                          ? "bg-app-surface text-app-ink shadow-app-nav-active"
                          : "text-app-ink-dim hover:bg-white/50 hover:text-app-ink"
                      }`}
                    >
                      <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full text-app-ink-mute group-hover:text-app-ink-dim">
                        <IconPipeline />
                        {collapsed && counts.review > 0 ? (
                          <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-danger ring-2 ring-app-surface" />
                        ) : null}
                      </span>
                      {!collapsed ? (
                        <>
                          <span className="min-w-0 flex-1 truncate text-left">Pipelines</span>
                          <IconExpandChevron open={isExpanded("pipelines")} />
                          {counts.review > 0 ? (
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-danger text-[10px] font-semibold text-white">
                              {counts.review > 9 ? "9+" : counts.review}
                            </span>
                          ) : null}
                        </>
                      ) : null}
                    </button>
                    )}
                  </li>
                  {!collapsed && isExpanded("pipelines")
                    ? PIPELINE_SUB_NAV.map((sub) => {
                        const count =
                          sub.badgeKey === "active"
                            ? counts.active
                            : sub.badgeKey === "review"
                              ? counts.review
                              : 0;
                        const isReview = sub.badgeKey === "review";
                        const active =
                          location.pathname === "/app/pipelines" && pipelineTab === sub.tab;
                        return (
                          <li key={sub.tab}>
                            <NavLink
                              to={sub.to}
                              className={`ml-6 flex items-center gap-2 rounded-full py-1.5 pl-3 pr-3 text-[13px] transition ${
                                active
                                  ? "bg-app-lavender/40 font-medium text-app-ink"
                                  : "text-app-ink-dim hover:bg-white/50 hover:text-app-ink"
                              }`}
                            >
                              <span className="text-app-ink-mute">└</span>
                              <span className="flex-1 truncate">{sub.label}</span>
                              {count > 0 && sub.badgeKey ? (
                                <span
                                  className={`flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                    isReview
                                      ? "bg-danger text-white"
                                      : "bg-app-surface-muted text-app-ink-dim"
                                  }`}
                                >
                                  {count > 9 ? "9+" : count}
                                </span>
                              ) : null}
                            </NavLink>
                          </li>
                        );
                      })
                    : null}
                </>
              ) : null}

              {"agentGroup" in section && section.agentGroup
                ? AGENT_NAV.map((agent) => {
                    const Icon = NAV_ICONS[agent.id] ?? IconProduct;
                    const active = agentIsActive(agent);
                    const expanded = isExpanded(agent.id);
                    const hasSub = agent.subNav.length > 1;
                    const showSub = !collapsed && expanded && hasSub;

                    if (!hasSub) {
                      return (
                        <li key={agent.id}>
                          <NavLink
                            to={agent.to}
                            title={collapsed ? agent.label : undefined}
                            className={({ isActive }) =>
                              `group flex items-center rounded-full py-2 type-nav transition-all duration-200 ease-out ${
                                collapsed ? "justify-center px-2" : "gap-2.5 px-3"
                              } ${
                                isActive || active
                                  ? "bg-app-surface text-app-ink shadow-app-nav-active"
                                  : "text-app-ink-dim hover:bg-white/50 hover:text-app-ink"
                              }`
                            }
                          >
                            <span
                              className={`relative flex size-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                                active
                                  ? "bg-app-lavender/60 text-app-accent"
                                  : "bg-transparent text-app-ink-mute group-hover:text-app-ink-dim"
                              }`}
                            >
                              <Icon />
                            </span>
                            {!collapsed ? (
                              <span className="min-w-0 truncate">{agent.label}</span>
                            ) : null}
                          </NavLink>
                        </li>
                      );
                    }

                    return (
                      <li key={agent.id}>
                        <button
                          type="button"
                          onClick={() => !collapsed && toggle(agent.id)}
                          title={collapsed ? agent.label : undefined}
                          className={`group flex w-full items-center rounded-full py-2 type-nav transition-all duration-200 ease-out ${
                            collapsed ? "justify-center px-2" : "gap-2.5 px-3"
                          } ${
                            active
                              ? "bg-app-surface text-app-ink shadow-app-nav-active"
                              : "text-app-ink-dim hover:bg-white/50 hover:text-app-ink"
                          }`}
                        >
                          <span
                            className={`relative flex size-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                              active
                                ? "bg-app-lavender/60 text-app-accent"
                                : "bg-transparent text-app-ink-mute group-hover:text-app-ink-dim"
                            }`}
                          >
                            <Icon />
                          </span>
                          {!collapsed ? (
                            <>
                              <span className="min-w-0 flex-1 truncate text-left">{agent.label}</span>
                              <IconExpandChevron open={expanded} />
                            </>
                          ) : null}
                        </button>
                        {showSub ? (
                          <ul className="mt-0.5 space-y-0.5">
                            {agent.subNav.map((sub) => {
                              const subActive = subIsActive(sub, agent.id);
                              return (
                                <li key={sub.to}>
                                  <NavLink
                                    to={sub.to}
                                    className={`ml-6 flex items-center gap-2 rounded-full py-1.5 pl-3 pr-3 text-[13px] transition ${
                                      subActive
                                        ? "bg-app-lavender/40 font-medium text-app-ink"
                                        : "text-app-ink-dim hover:bg-white/50 hover:text-app-ink"
                                    }`}
                                  >
                                    <span className="text-app-ink-mute">└</span>
                                    <span className="flex-1 truncate">{sub.label}</span>
                                  </NavLink>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })
                : null}

              {!("pipelineGroup" in section) &&
              !("agentGroup" in section) &&
              !section.items.every((i) => "end" in i)
                ? null
                : null}

              {section.id !== "workspace" && section.id !== "agents"
                ? section.items.map((item) => {
                    const Icon = NAV_ICONS[item.to] ?? IconSettings;
                    return (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          title={collapsed ? item.label : undefined}
                          className={({ isActive }) =>
                            `group flex items-center rounded-full py-2 type-nav transition-all duration-200 ease-out ${
                              collapsed ? "justify-center px-2" : "gap-2.5 px-3"
                            } ${
                              isActive
                                ? "bg-app-surface text-app-ink shadow-app-nav-active"
                                : "text-app-ink-dim hover:bg-white/50 hover:text-app-ink"
                            }`
                          }
                        >
                          <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full text-app-ink-mute group-hover:text-app-ink-dim">
                            <Icon />
                          </span>
                          {!collapsed ? (
                            <span className="min-w-0 truncate">{item.label}</span>
                          ) : null}
                        </NavLink>
                      </li>
                    );
                  })
                : null}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

function IconExpandChevron({ open }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      className={`shrink-0 text-app-ink-mute transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M3 4.5 L6 7.5 L9 4.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LogoMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="9" cy="16" r="2.6" fill="#8B7CF6" />
      <circle cx="16" cy="16" r="2.6" className="fill-app-ink" />
      <circle cx="23" cy="16" r="2.6" fill="#8B7CF6" />
      <path d="M11.6 16 H13.4 M18.6 16 H20.4" stroke="#8B7CF6" strokeWidth="1.2" />
    </svg>
  );
}

function IconChevron({ collapsed }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d={collapsed ? "M4 2.5 L7.5 6 L4 9.5" : "M8 2.5 L4.5 6 L8 9.5"}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconDashboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="4.5" height="6" rx="1" stroke="currentColor" />
      <rect x="1.5" y="9" width="4.5" height="3.5" rx="1" stroke="currentColor" />
      <rect x="8" y="1.5" width="4.5" height="3.5" rx="1" stroke="currentColor" />
      <rect x="8" y="6.5" width="4.5" height="6" rx="1" stroke="currentColor" />
    </svg>
  );
}
function IconPipeline() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="3" cy="7" r="1.5" stroke="currentColor" />
      <circle cx="11" cy="7" r="1.5" stroke="currentColor" />
      <circle cx="7" cy="7" r="1.5" stroke="currentColor" />
      <path d="M4.5 7 H5.5 M8.5 7 H9.5" stroke="currentColor" />
    </svg>
  );
}
function IconProduct() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="4.5" r="2" stroke="currentColor" />
      <path d="M3 12c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" />
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="2" stroke="currentColor" />
      <path
        d="M7 1.5v1.4M7 11.1v1.4M1.5 7h1.4M11.1 7h1.4M3.2 3.2l1 1M9.8 9.8l1 1M9.8 4.2l1-1M3.2 10.8l1-1"
        stroke="currentColor"
      />
    </svg>
  );
}
function IconCodebase() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M4 4L2 7l2 3M10 4l2 3-2 3" stroke="currentColor" />
    </svg>
  );
}
function IconRoadmap() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="2" y="3" width="10" height="8" rx="1" stroke="currentColor" />
      <path d="M4.5 6.5h5M4.5 8.5h3" stroke="currentColor" />
    </svg>
  );
}
function IconQa() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 2v4M5 9h4M7 11v1" stroke="currentColor" />
      <circle cx="7" cy="7" r="5" stroke="currentColor" />
    </svg>
  );
}
function IconCosts() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 10V6M5 10V4M8 10V7M11 10V2" stroke="currentColor" />
    </svg>
  );
}
function IconAudit() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="3" y="2" width="8" height="10" rx="1" stroke="currentColor" />
      <path d="M5 5h4M5 7.5h4M5 10h2" stroke="currentColor" />
    </svg>
  );
}
