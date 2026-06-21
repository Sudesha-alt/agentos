import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { usePipelineList, usePipelineLive } from "../../entities/pipeline";
import { useActivityEvents } from "../../entities/workspace";
import { deriveReviewQueueItems } from "../../shared/lib/pipelineCounts";
import { useOrgPathBuilder } from "../providers/OrgRouteProvider";
import { formatRelativeTime } from "../lib/format";
import StageRail from "./StageRail";
import StatusPill from "../../app/components/StatusPill";

/**
 * Top-bar notifications — review queue items plus recent pipeline activity.
 */
export default function NotificationCenter() {
  const orgPath = useOrgPathBuilder();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const { items: pipelines } = usePipelineList(undefined, { pollMs: 30_000 });
  const { active: liveActive } = usePipelineLive({ pollMs: 3000 });
  const { data: eventsData } = useActivityEvents({ pollMs: 12_000 });
  const reviewItems = deriveReviewQueueItems(pipelines);
  const events = eventsData?.events ?? [];
  const intakeEvents = events.filter(
    (e) => e.outcome != null || e.tone === "intake" || e.source
  );
  const pipelineEvents = events.filter(
    (e) => !(e.outcome != null || e.source) && e.tone !== "intake"
  );
  const totalCount =
    reviewItems.length +
    intakeEvents.length +
    events.filter((e) => e.live).length +
    (liveActive ? 1 : 0);

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex size-10 items-center justify-center rounded-full border border-app-border bg-app-surface text-app-ink-dim transition-colors hover:border-app-ink/12 hover:text-app-ink"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <svg width="18" height="18" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path
            d="M7 1.5a3.5 3.5 0 00-3.5 3.5v1.8l-.7 1.4a.6.6 0 00.5.9h7.4a.6.6 0 00.5-.9l-.7-1.4V5A3.5 3.5 0 007 1.5z"
            stroke="currentColor"
          />
          <path d="M5.5 11a1.5 1.5 0 003 0" stroke="currentColor" />
        </svg>
        {totalCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[1.125rem] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {totalCount > 9 ? "9+" : totalCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-app border border-app-border bg-app-surface shadow-app-float">
          <div className="border-b border-app-border px-4 py-3">
            <p className="text-sm font-semibold text-app-ink">Notifications</p>
            <p className="mt-0.5 text-xs text-app-ink-mute">Review queue and recent activity</p>
          </div>

          <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
            {liveActive ? (
              <section className="border-b border-app-border px-4 py-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-app-ink-mute">
                    Agent in progress
                  </p>
                  <StatusPill status={liveActive.status} />
                </div>
                <Link
                  to={orgPath("pipelines", liveActive.pipelineId)}
                  onClick={() => setOpen(false)}
                  className={`block rounded-app-sm border px-3 py-2.5 transition ${
                    liveActive.status === "PAUSED"
                      ? "border-warning/35 bg-warning/[0.06] hover:bg-warning/10"
                      : "border-indigo/25 bg-indigo/[0.04] hover:bg-indigo/[0.08]"
                  }`}
                >
                  {liveActive.status === "PAUSED" ? (
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-warning">
                      Blocked
                    </p>
                  ) : null}
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${
                        liveActive.status === "PAUSED"
                          ? "bg-warning"
                          : "animate-pulse bg-indigo"
                      }`}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-app-ink">
                        <span className="font-mono text-app-ink-dim">{liveActive.jiraKey}</span>{" "}
                        {liveActive.summary}
                      </p>
                      <p className="mt-1 text-[12px] leading-relaxed text-app-ink-dim">
                        <span className="font-medium text-app-ink">
                          {liveActive.currentStageLabel}
                        </span>
                        {" · "}
                        {liveActive.blockReason ?? liveActive.currentAction}
                      </p>
                      <div className="mt-2">
                        <StageRail
                          currentStage={liveActive.currentStage}
                          status={liveActive.status}
                          compact
                        />
                      </div>
                      {liveActive.recentActivity[0] ? (
                        <p className="mt-2 text-[11px] text-app-ink-mute">
                          Last update {formatRelativeTime(liveActive.recentActivity[0].timestamp)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </section>
            ) : null}

            <section className="px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-app-ink-mute">
                  Review queue
                </p>
                {reviewItems.length > 0 ? (
                  <Link
                    to={`${orgPath("pipelines")}?tab=review`}
                    onClick={() => setOpen(false)}
                    className="text-[11px] font-medium text-indigo hover:underline"
                  >
                    View all
                  </Link>
                ) : null}
              </div>
              {reviewItems.length === 0 ? (
                <p className="py-2 text-xs text-app-ink-dim">Nothing waiting for review.</p>
              ) : (
                <ul className="space-y-1.5">
                  {reviewItems.slice(0, 5).map((item) => (
                    <li key={item.id}>
                      <Link
                        to={item.actionTo}
                        onClick={() => setOpen(false)}
                        className="block rounded-app-sm border border-app-border px-3 py-2 transition hover:bg-app-surface-muted"
                      >
                        <p className="text-[13px] font-medium text-app-ink">
                          <span className="font-mono text-app-ink-dim">{item.jiraKey}</span>{" "}
                          {item.actionLabel}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-app-ink-mute">{item.reason}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="border-t border-app-border px-4 py-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-app-ink-mute">
                Intake activity
              </p>
              {intakeEvents.length === 0 ? (
                <p className="py-2 text-xs text-app-ink-dim">
                  Move a Task or Bug into the AI Worker column to start work.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {intakeEvents.slice(0, 8).map((event) => (
                    <li key={event.id}>
                      <Link
                        to={orgPath("pipelines")}
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-2 rounded-app-sm px-2 py-1.5 transition hover:bg-app-surface-muted"
                      >
                        <span
                          className={`mt-1.5 size-2 shrink-0 rounded-full ${
                            event.outcome === "failed"
                              ? "bg-danger"
                              : event.outcome === "skipped"
                                ? "bg-app-ink-mute"
                                : event.live
                                  ? "animate-pulse bg-indigo"
                                  : "bg-success"
                          }`}
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] text-app-ink">
                            <span className="font-mono text-app-ink-dim">{event.jiraKey}</span>{" "}
                            {event.message}
                          </p>
                          {event.skipReason ? (
                            <p className="truncate text-[11px] text-app-ink-mute">
                              {event.skipReason}
                            </p>
                          ) : null}
                          <p className="text-[11px] text-app-ink-mute">
                            {formatRelativeTime(event.timestamp)}
                            {event.source ? ` · ${event.source}` : ""}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="border-t border-app-border px-4 py-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-app-ink-mute">
                Recent activity
              </p>
              {pipelineEvents.length === 0 ? (
                <p className="py-2 text-xs text-app-ink-dim">No recent activity.</p>
              ) : (
                <ul className="space-y-1.5">
                  {pipelineEvents.slice(0, 6).map((event) => (
                    <li key={event.id}>
                      <Link
                        to={
                          event.pipelineId
                            ? orgPath("pipelines", event.pipelineId)
                            : orgPath("pipelines")
                        }
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-2 rounded-app-sm px-2 py-1.5 transition hover:bg-app-surface-muted"
                      >
                        <span
                          className={`mt-1.5 size-2 shrink-0 rounded-full ${
                            event.live ? "animate-pulse bg-indigo" : "bg-app-ink-mute"
                          }`}
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] text-app-ink">
                            <span className="font-mono text-app-ink-dim">{event.jiraKey}</span>{" "}
                            {event.message}
                          </p>
                          <p className="text-[11px] text-app-ink-mute">
                            {formatRelativeTime(event.timestamp)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="border-t border-app-border px-4 py-2.5">
            <Link
              to={`${orgPath("pipelines")}?tab=history`}
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-app-ink-dim hover:text-app-ink"
            >
              View pipeline history →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
