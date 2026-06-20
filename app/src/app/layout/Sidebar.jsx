import { NavLink, useLocation, useSearchParams } from "react-router-dom";
import Logo from "../../components/Logo";
import { usePipelineList } from "../../entities/pipeline";
import { derivePipelineCounts } from "../../shared/lib/pipelineCounts";
import { useSidebarCollapsed } from "../../shared/hooks/useSidebarCollapsed";
import { useNavExpanded } from "../../shared/hooks/useNavExpanded";
import { useOrgNavigation } from "../../shared/routing/useOrgNavigation";
import SidebarUserCard from "./SidebarUserCard";

function navItemClass(active, collapsed, { isGroupHeader = false, childActive = false } = {}) {
  const showActiveBg = Boolean(active && (collapsed || !isGroupHeader || !childActive));
  return [
    "group flex w-full items-center text-[13px] font-medium transition-colors duration-150",
    collapsed ? "justify-center rounded-md px-2 py-1.5" : "gap-2 rounded-md px-2.5 py-1.5",
    showActiveBg
      ? "bg-app-surface-muted text-app-ink"
      : active && isGroupHeader && childActive
        ? "text-app-ink"
        : "text-app-ink-dim hover:bg-app-surface-muted/60 hover:text-app-ink",
  ].join(" ");
}

function subNavItemClass(active) {
  return [
    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors",
    active
      ? "bg-app-surface-muted text-app-ink"
      : "text-app-ink-dim hover:bg-app-surface-muted/60 hover:text-app-ink",
  ].join(" ");
}

function sectionLabelClass(collapsed) {
  return collapsed ? "sr-only" : "mb-1 px-2.5 text-[11px] font-semibold text-app-ink-mute";
}

const NAV_ICONS = {
  dashboard: IconDashboard,
  pipelines: IconPipeline,
  virin: IconProduct,
  ananta: IconCodebase,
  neel: IconQa,
  roadmap: IconRoadmap,
  costs: IconCosts,
  audit: IconAudit,
  settings: IconSettings,
};

export default function Sidebar() {
  const { orgPath, sections, pipelineSubNav, agentNav, pathMatches } = useOrgNavigation();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const pipelineTab = pathMatches("pipelines")
    ? (searchParams.get("tab") ?? "active")
    : "active";
  const { collapsed, toggleCollapsed } = useSidebarCollapsed();
  const { isExpanded, toggle } = useNavExpanded(location.pathname);
  const { items: pipelines } = usePipelineList(undefined, { pollMs: 30_000 });
  const counts = derivePipelineCounts(pipelines);

  function agentIsActive(agent) {
    if (agent.id === "virin") {
      return pathMatches("pm-agents") || pathMatches("roadmap");
    }
    if (agent.id === "ananta") {
      return pathMatches("ananta");
    }
    if (agent.id === "neel") {
      return pathMatches("qa");
    }
    return false;
  }

  function subIsActive(sub) {
    return location.pathname + location.search === sub.to;
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-app-border bg-app-surface transition-[width,padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:flex ${
        collapsed ? "w-14 px-1.5" : "w-[13.75rem] px-2"
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

      <div className={`shrink-0 py-3 ${collapsed ? "flex justify-center px-0" : "px-1"}`}>
        {collapsed ? (
          <NavLink to={orgPath()} aria-label="AgentOS home" className="inline-flex">
            <LogoMark />
          </NavLink>
        ) : (
          <Logo variant="light" href={orgPath()} />
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-0.5 py-1">
        {sections.map((section, sectionIndex) => (
          <div key={section.id} className={sectionIndex > 0 ? "mt-4" : ""}>
            <p className={sectionLabelClass(collapsed)}>{section.label}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                if ("end" in item && item.end) {
                  const Icon = NAV_ICONS.dashboard ?? IconDashboard;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end
                        title={collapsed ? item.label : undefined}
                        className={({ isActive }) =>
                          navItemClass(isActive, collapsed)
                        }
                      >
                        <span className="flex size-5 shrink-0 items-center justify-center text-app-ink-mute group-hover:text-app-ink">
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
                        to={orgPath("pipelines")}
                        title="Pipelines"
                        className={({ isActive }) =>
                          navItemClass(
                            isActive || pathMatches("pipelines"),
                            true
                          )
                        }
                      >
                        <span className="relative flex size-5 items-center justify-center">
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
                      className={navItemClass(
                        pathMatches("pipelines"),
                        collapsed,
                        {
                          isGroupHeader: true,
                          childActive:
                            !collapsed &&
                            isExpanded("pipelines") &&
                            pathMatches("pipelines"),
                        }
                      )}
                    >
                      <span className="relative flex size-5 shrink-0 items-center justify-center text-app-ink-mute group-hover:text-app-ink">
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
                  {!collapsed && isExpanded("pipelines") ? (
                    <ul className="mt-0.5 space-y-0.5">
                      {pipelineSubNav.map((sub) => {
                        const count =
                          sub.badgeKey === "active"
                            ? counts.active
                            : sub.badgeKey === "review"
                              ? counts.review
                              : 0;
                        const isReview = sub.badgeKey === "review";
                        const active = pathMatches("pipelines") && pipelineTab === sub.tab;
                        return (
                          <li key={sub.tab}>
                            <NavLink to={sub.to} className={subNavItemClass(active)}>
                              <span className="flex size-5 shrink-0 items-center justify-center" aria-hidden>
                                <span className="size-1 rounded-full bg-current opacity-40" />
                              </span>
                              <span className="min-w-0 flex-1 truncate">{sub.label}</span>
                              {count > 0 && sub.badgeKey ? (
                                <span
                                  className={`flex min-w-[1.1rem] shrink-0 items-center justify-center rounded-full px-1 py-0.5 text-[9px] font-semibold ${
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
                      })}
                    </ul>
                  ) : null}
                </>
              ) : null}

              {"agentGroup" in section && section.agentGroup
                ? agentNav.map((agent) => {
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
                              navItemClass(isActive || active, collapsed)
                            }
                          >
                            <span className="flex size-5 shrink-0 items-center justify-center text-app-ink-mute group-hover:text-app-ink">
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
                          className={navItemClass(active, collapsed, {
                            isGroupHeader: true,
                            childActive:
                              !collapsed &&
                              showSub &&
                              agent.subNav.some((sub) => subIsActive(sub, agent.id)),
                          })}
                        >
                          <span className="flex size-5 shrink-0 items-center justify-center text-app-ink-mute group-hover:text-app-ink">
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
                                  <NavLink to={sub.to} className={subNavItemClass(subActive)}>
                                    <span
                                      className="flex size-5 shrink-0 items-center justify-center"
                                      aria-hidden
                                    >
                                      <span className="size-1 rounded-full bg-current opacity-40" />
                                    </span>
                                    <span className="min-w-0 flex-1 truncate">{sub.label}</span>
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
                          className={({ isActive }) => navItemClass(isActive, collapsed)}
                        >
                          <span className="flex size-5 shrink-0 items-center justify-center text-app-ink-mute group-hover:text-app-ink">
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
      <SidebarUserCard collapsed={collapsed} />
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
