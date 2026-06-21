import { useMemo, useState } from "react";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import { formatStageLabel, formatAuditInline, formatRelativeTime } from "../../shared/lib/format";
import { formatAuditEventLabel, formatAuditEventDetail } from "../../shared/lib/auditLabels";

function inferActionsFromStage(stage) {
  const output = stage?.output;
  if (!output || typeof output !== "object") return [];

  const actions = [];

  const toolCalls = Array.isArray(output.toolCallLog) ? output.toolCallLog : [];
  toolCalls.forEach((tool, idx) => {
    actions.push({
      id: `${stage.id}-tool-${idx}`,
      stage: stage.stage,
      title: `Tool call · ${tool.tool ?? "unknown"}`,
      kind: "tool",
      description:
        `${tool.query ? `Query: ${tool.query}. ` : ""}${typeof tool.resultsFound === "number" ? `${tool.resultsFound} results.` : ""}`.trim() ||
        "Tool call executed.",
      payload: tool,
      edits: [],
    });
  });

  const codeEdits = []
    .concat(Array.isArray(output.codeEdits) ? output.codeEdits : [])
    .concat(Array.isArray(output.fileEdits) ? output.fileEdits : [])
    .concat(Array.isArray(output.edits) ? output.edits : []);

  codeEdits.forEach((edit, idx) => {
    actions.push({
      id: `${stage.id}-edit-${idx}`,
      stage: stage.stage,
      title: `Code edit · ${edit.filePath ?? edit.path ?? `file ${idx + 1}`}`,
      kind: "code-edit",
      description: edit.summary ?? edit.reason ?? "Codebase edit applied",
      payload: edit,
      edits: [edit],
    });
  });

  if (Array.isArray(output.components) && output.components.length) {
    actions.push({
      id: `${stage.id}-components`,
      stage: stage.stage,
      title: "Implementation components planned",
      kind: "plan",
      description: `${output.components.length} components identified.`,
      payload: output.components,
      edits: [],
    });
  }

  if (Array.isArray(output.criteriaMapping) && output.criteriaMapping.length) {
    actions.push({
      id: `${stage.id}-criteria`,
      stage: stage.stage,
      title: "Acceptance criteria mapping",
      kind: "mapping",
      description: `${output.criteriaMapping.length} criteria mapped to implementation actions.`,
      payload: output.criteriaMapping,
      edits: [],
    });
  }

  return actions;
}

function inferActionsFromAudit(auditLogs = []) {
  return [...auditLogs]
    .reverse()
    .map((audit, idx) => {
      const metadata =
        audit?.metadata && typeof audit.metadata === "object" ? audit.metadata : {};

      const hasEditPayload =
        metadata.filePath ||
        metadata.path ||
        metadata.diff ||
        metadata.before ||
        metadata.after;

      const detail = formatAuditEventDetail(metadata) ?? formatAuditInline(audit);

      return {
        id: audit.id ?? `audit-${audit.timestamp}-${idx}`,
        stage: metadata.stage ?? null,
        title: formatAuditEventLabel(audit.event, metadata),
        kind: hasEditPayload ? "code-edit" : "audit",
        description: detail || `Recorded ${formatRelativeTime(audit.timestamp)}`,
        payload: metadata,
        edits: hasEditPayload ? [metadata] : [],
        timestamp: audit.timestamp,
      };
    });
}

function normalizeEdit(edit) {
  return {
    filePath: edit.filePath ?? edit.path ?? "unknown",
    summary: edit.summary ?? edit.reason ?? "Code update",
    before: edit.before ?? edit.original ?? "",
    after: edit.after ?? edit.updated ?? "",
    diff: edit.diff ?? "",
  };
}

export default function TicketActivityWidget({
  stages = [],
  auditLogs = [],
  currentStage,
}) {
  const actions = useMemo(() => {
    const fromStages = stages.flatMap(inferActionsFromStage);
    const fromAudit = inferActionsFromAudit(auditLogs);
    const merged = [...fromStages, ...fromAudit];
    return merged.length
      ? merged
      : [
          {
            id: "fallback",
            stage: currentStage ?? null,
            title: "Awaiting executable actions",
            kind: "info",
            description:
              "No actionable events emitted yet. Actions appear here as the ticket progresses.",
            payload: null,
            edits: [],
          },
        ];
  }, [stages, auditLogs, currentStage]);

  const [selectedActionId, setSelectedActionId] = useState(actions[0]?.id ?? null);
  const selected = actions.find((item) => item.id === selectedActionId) ?? actions[0];

  const stageOrder = stages.map((stage) => stage.stage);

  return (
    <Panel>
      <PanelHeader
        kicker="Interactive trace"
        title="Ticket live activity"
      />

      <div className="space-y-4 px-5 py-4 sm:px-6">
        <div className="rounded-xl border border-hairline bg-canvas/35 p-3">
          <p className="editorial-kicker text-ink-mute">Ticket position</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {stageOrder.map((stageName) => {
              const isCurrent = stageName === currentStage;
              return (
                <span
                  key={stageName}
                  className={`rounded-full border px-2.5 py-1 font-mono text-[11px] ${
                    isCurrent
                      ? "border-indigo/50 bg-indigo/10 text-ink"
                      : "border-hairline bg-surface/40 text-ink-dim"
                  }`}
                >
                  {formatStageLabel(stageName)}
                  {isCurrent ? " • now" : ""}
                </span>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-2">
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => setSelectedActionId(action.id)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                  selected?.id === action.id
                    ? "border-indigo/50 bg-indigo/10"
                    : "border-hairline bg-surface/35 hover:border-hairline-strong"
                }`}
              >
                <p className="text-[13px] text-ink">{action.title}</p>
                <p className="mt-1 text-xs text-ink-dim">
                  {action.stage ? formatStageLabel(action.stage) : "Pipeline audit"}
                  {action.timestamp ? ` · ${formatRelativeTime(action.timestamp)}` : ""}
                </p>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-hairline bg-canvas/35 p-4">
            <p className="text-[13px] font-medium text-ink">{selected?.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-dim">
              {selected?.description}
            </p>

            {selected?.edits?.length ? (
              <div className="mt-4 space-y-4">
                {selected.edits.map((edit, idx) => {
                  const normalized = normalizeEdit(edit);
                  return (
                    <div key={`${selected.id}-edit-${idx}`} className="rounded-lg border border-hairline p-3">
                      <p className="font-mono text-xs text-ink">
                        {normalized.filePath}
                      </p>
                      <p className="mt-1 text-xs text-ink-dim">{normalized.summary}</p>
                      {normalized.diff ? (
                        <pre className="mt-3 max-h-56 overflow-auto rounded bg-[#0B0B14] p-3 text-[11px] leading-relaxed text-ink-dim">
                          {normalized.diff}
                        </pre>
                      ) : null}
                      {normalized.before ? (
                        <div className="mt-3">
                          <p className="editorial-kicker text-ink-mute">Before</p>
                          <pre className="mt-1 max-h-40 overflow-auto rounded bg-[#100C0C] p-3 text-[11px] text-ink-dim">
                            {normalized.before}
                          </pre>
                        </div>
                      ) : null}
                      {normalized.after ? (
                        <div className="mt-3">
                          <p className="editorial-kicker text-ink-mute">After</p>
                          <pre className="mt-1 max-h-40 overflow-auto rounded bg-[#0B1014] p-3 text-[11px] text-ink-dim">
                            {normalized.after}
                          </pre>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <pre className="mt-4 max-h-64 overflow-auto rounded bg-[#0B0B14] p-3 text-[11px] text-ink-dim">
                {JSON.stringify(selected?.payload ?? {}, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}
