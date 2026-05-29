import { usePipelineList } from "../../entities/pipeline";
import { usePipelineAudit } from "../../entities/audit";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";
import { formatRelativeTime, formatAuditInline } from "../../shared/lib/format";

export default function AuditTrail() {
  const { items: pipelines } = usePipelineList();
  const primaryId = pipelines[0]?.id;
  const { items: auditItems, loading } = usePipelineAudit(primaryId, { pollMs: 15_000 });

  return (
    <div className="mx-auto w-full max-w-[82rem] space-y-8">
      <PageIntro
        kicker="Compliance"
        title="Everything the system did, in order"
        body="Immutable, searchable audit log across pipelines — what happened and why."
      />

      <Panel>
        <PanelHeader
          kicker="Global feed"
          title="Recent audit events"
          body={
            primaryId
              ? `Showing events for ${pipelines[0]?.jiraKey ?? primaryId}. Full cross-pipeline search ships with /api/audit.`
              : "No pipelines yet."
          }
        />
        <ul className="max-h-[640px] divide-y divide-hairline overflow-y-auto">
          {loading && !auditItems?.length ? (
            <li className="px-5 py-10 text-center text-sm text-ink-dim">Loading audit trail…</li>
          ) : (
            (auditItems ?? []).map((entry, index) => (
              <li key={`${entry.timestamp}-${index}`} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-[12px] text-indigo">
                    {entry.event?.replaceAll("_", " ")}
                  </p>
                  <p className="font-mono text-[10.5px] text-ink-mute">
                    {formatRelativeTime(entry.timestamp)}
                  </p>
                </div>
                {formatAuditInline(entry) ? (
                  <p className="mt-2 text-[13px] text-ink-dim">{formatAuditInline(entry)}</p>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </Panel>
    </div>
  );
}
