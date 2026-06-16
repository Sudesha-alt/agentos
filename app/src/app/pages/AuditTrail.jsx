import { motion } from "framer-motion";
import { usePipelineList } from "../../entities/pipeline";
import { usePipelineAudit } from "../../entities/audit";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";
import { formatRelativeTime, formatAuditInline } from "../../shared/lib/format";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";
import { motionSafe, pageStagger, sectionFadeUp } from "../../lib/motion";

export default function AuditTrail() {
  const { items: pipelines } = usePipelineList();
  const primaryId = pipelines[0]?.id;
  const { items: auditItems, loading } = usePipelineAudit(primaryId, { pollMs: 15_000 });

  const safeStagger = motionSafe(pageStagger(0.04));
  const safeSection = motionSafe(sectionFadeUp);
  const visibleItems = (auditItems ?? []).slice(0, 8);
  const restItems = (auditItems ?? []).slice(8);

  return (
    <AnimatedAppPage wide>
      <PageIntro kicker="Compliance" title="Everything the system did, in order" />

      <Panel>
        <PanelHeader
          kicker="Global feed"
          title="Recent audit events"
          subtitle={
            primaryId
              ? `Showing events for ${pipelines[0]?.jiraKey ?? primaryId}.`
              : "No pipelines yet."
          }
        />
        <motion.ul
          className="max-h-[640px] divide-y divide-app-border overflow-y-auto"
          variants={safeStagger}
          initial="hidden"
          animate="show"
        >
          {loading && !auditItems?.length ? (
            <li className="px-5 py-10 text-center text-sm text-app-ink-dim">Loading audit trail…</li>
          ) : (
            <>
              {visibleItems.map((entry, index) => (
                <motion.li
                  key={`${entry.timestamp}-${index}`}
                  variants={safeSection}
                  className="px-5 py-3.5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[13px] font-medium text-indigo">
                      {entry.event?.replaceAll("_", " ")}
                    </p>
                    <p className="text-[11px] text-app-ink-mute">
                      {formatRelativeTime(entry.timestamp)}
                    </p>
                  </div>
                  {formatAuditInline(entry) ? (
                    <p className="mt-1.5 text-[13px] text-app-ink-dim">{formatAuditInline(entry)}</p>
                  ) : null}
                </motion.li>
              ))}
              {restItems.map((entry, index) => (
                <li key={`rest-${entry.timestamp}-${index}`} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[13px] font-medium text-indigo">
                      {entry.event?.replaceAll("_", " ")}
                    </p>
                    <p className="text-[11px] text-app-ink-mute">
                      {formatRelativeTime(entry.timestamp)}
                    </p>
                  </div>
                  {formatAuditInline(entry) ? (
                    <p className="mt-1.5 text-[13px] text-app-ink-dim">{formatAuditInline(entry)}</p>
                  ) : null}
                </li>
              ))}
            </>
          )}
        </motion.ul>
      </Panel>
    </AnimatedAppPage>
  );
}
