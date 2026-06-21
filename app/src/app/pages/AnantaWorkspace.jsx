import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useEngineeringRuns } from "../../entities/engineering-agent";
import { usePmAnalyses } from "../../entities/pm-agents";
import { AGENT_NAMES } from "../../shared/config/app";
import AnantaTicketWorkspace from "../../widgets/ananta/AnantaTicketWorkspace";
import { AgentPageWithChat } from "../../widgets/agent-chat/AgentPageWithChat";
import { AgentPageHeader } from "../../widgets/agent-chat/AgentPageHeader";
import AgentPipelineLiveStatus from "../../shared/components/AgentPipelineLiveStatus";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";
import { useOrg } from "../../shared/providers/OrgRouteProvider";

function resolvePipelineId(jiraKey, pipelineParam, engineeringRuns) {
  if (pipelineParam) return pipelineParam;
  if (!jiraKey) return null;
  const matches = engineeringRuns.filter((r) => r.jiraKey === jiraKey);
  if (!matches.length) return null;
  const running = matches.find((r) => r.status === "RUNNING");
  return (running ?? matches[0]).pipelineId;
}

function buildTicketList(pmItems, engineeringRuns) {
  const byKey = new Map();

  for (const item of pmItems) {
    if (item.status !== "COMPLETED") continue;
    byKey.set(item.jiraKey, {
      jiraKey: item.jiraKey,
      summary: item.summary ?? "Ticket analysis",
      status: "handoff",
      recommendation: item.recommendation,
    });
  }

  for (const run of engineeringRuns) {
    const existing = byKey.get(run.jiraKey);
    byKey.set(run.jiraKey, {
      jiraKey: run.jiraKey,
      summary: run.summary ?? existing?.summary ?? "Engineering run",
      status: run.status,
      pipelineId: run.pipelineId,
      currentStageLabel: run.currentStageLabel,
      recommendation: existing?.recommendation,
    });
  }

  return [...byKey.values()].sort((a, b) => {
    if (a.status === "RUNNING" && b.status !== "RUNNING") return -1;
    if (b.status === "RUNNING" && a.status !== "RUNNING") return 1;
    return a.jiraKey.localeCompare(b.jiraKey);
  });
}

export default function AnantaWorkspace() {
  const { orgPath } = useOrg();
  const [searchParams, setSearchParams] = useSearchParams();
  const ticketFromUrl = searchParams.get("ticket")?.trim().toUpperCase() || "";
  const pipelineFromUrl = searchParams.get("pipeline")?.trim() || "";

  const [activeKey, setActiveKey] = useState(ticketFromUrl);

  const { data: pmList } = usePmAnalyses({ pollMs: 12_000 });
  const { items: engineeringRuns, loading: runsLoading } = useEngineeringRuns({
    pollMs: 8_000,
  });

  const tickets = useMemo(
    () => buildTicketList(pmList?.items ?? [], engineeringRuns),
    [pmList?.items, engineeringRuns]
  );

  const pipelineId = useMemo(
    () => resolvePipelineId(activeKey, pipelineFromUrl, engineeringRuns),
    [activeKey, pipelineFromUrl, engineeringRuns]
  );

  const handoffPending =
    Boolean(activeKey) &&
    !pipelineId &&
    tickets.some((t) => t.jiraKey === activeKey && t.status === "handoff");

  useEffect(() => {
    if (ticketFromUrl) {
      setActiveKey(ticketFromUrl);
      return;
    }
    if (pipelineFromUrl && engineeringRuns.length) {
      const run = engineeringRuns.find((r) => r.pipelineId === pipelineFromUrl);
      if (run?.jiraKey) setActiveKey(run.jiraKey);
    }
  }, [ticketFromUrl, pipelineFromUrl, engineeringRuns]);

  useEffect(() => {
    if (!pipelineFromUrl && activeKey && engineeringRuns.length) {
      const resolved = resolvePipelineId(activeKey, "", engineeringRuns);
      if (resolved) {
        const next = new URLSearchParams(searchParams);
        next.set("ticket", activeKey);
        next.set("pipeline", resolved);
        setSearchParams(next, { replace: true });
      }
    }
  }, [activeKey, engineeringRuns, pipelineFromUrl, searchParams, setSearchParams]);

  function selectTicket(jiraKey) {
    const key = jiraKey.trim().toUpperCase();
    setActiveKey(key);
    const run = engineeringRuns.find((r) => r.jiraKey === key);
    const next = new URLSearchParams();
    next.set("ticket", key);
    if (run?.pipelineId) next.set("pipeline", run.pipelineId);
    setSearchParams(next, { replace: true });
  }

  function clearSelection() {
    setActiveKey("");
    setSearchParams({}, { replace: true });
  }

  return (
    <AnimatedAppPage wide>
      <AgentPageWithChat domain="ananta" contextKey={activeKey ?? ""}>
        <AgentPageHeader domain="ananta" />

        <AgentPipelineLiveStatus agentKey="ananta" />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <aside className="w-full shrink-0 lg:w-64">
            <Panel>
              <PanelHeader kicker="Tickets" title={`${AGENT_NAMES.ANANTA} queue`} />
              <div className="max-h-[28rem] overflow-y-auto px-2 py-2">
                {runsLoading && !tickets.length ? (
                  <p className="px-3 py-4 text-sm text-app-ink-dim">Loading…</p>
                ) : tickets.length === 0 ? (
                  <p className="px-3 py-4 text-[13px] leading-relaxed text-app-ink-dim">
                    No handoffs yet. Complete a Virin analysis and start the coding pipeline.
                  </p>
                ) : (
                  <ul className="divide-y divide-app-border">
                    {tickets.map((ticket) => {
                      const active = ticket.jiraKey === activeKey;
                      return (
                        <li key={ticket.jiraKey}>
                          <button
                            type="button"
                            onClick={() => selectTicket(ticket.jiraKey)}
                            className={`flex w-full flex-col items-start px-3 py-3 text-left transition ${
                              active ? "bg-indigo/5" : "hover:bg-app-surface-muted/60"
                            }`}
                          >
                            <span className="font-mono text-[11px] text-indigo">
                              {ticket.jiraKey}
                            </span>
                            <span className="mt-0.5 line-clamp-2 text-[13px] text-app-ink">
                              {ticket.summary}
                            </span>
                            <span className="mt-1 text-[10px] uppercase tracking-wider text-app-ink-mute">
                              {ticket.status === "handoff"
                                ? "Handoff ready"
                                : ticket.status === "FAILED"
                                  ? `Failed · ${ticket.currentStageLabel ?? "engineering"}`
                                  : ticket.status.replaceAll("_", " ")}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="border-t border-app-border px-4 py-3">
                <Link
                  to={orgPath("pm-agents")}
                  className="text-[12px] font-medium text-indigo hover:underline"
                >
                  Open Virin →
                </Link>
              </div>
            </Panel>
          </aside>

          <div className="min-w-0 flex-1">
            <AnantaTicketWorkspace
              pipelineId={pipelineId}
              jiraKey={activeKey}
              handoffPending={handoffPending}
              onClearSelection={clearSelection}
            />
          </div>
        </div>
      </AgentPageWithChat>
    </AnimatedAppPage>
  );
}
