import { useState } from "react";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import { VIRIN_NAME } from "../../entities/pm-agents";

export function VirinConversationPanel({ analysis, onAnswer, onConfirm, busy, prominent = false }) {
  const status = analysis?.status;
  const pendingQuestion = analysis?.pendingQuestion;

  if (status === "AWAITING_INPUT" && pendingQuestion) {
    return (
      <VirinInputPanel
        prominent={prominent}
        kicker={`${VIRIN_NAME} asks`}
        title="One question at a time"
        prompt={pendingQuestion}
        options={analysis?.pendingQuestionOptions}
        placeholder="Type your answer…"
        submitLabel="Send answer"
        onSubmit={onAnswer}
        busy={busy}
        turnNumber={(analysis?.questionMode?.conversation?.length ?? 0) + 1}
      />
    );
  }

  if (status === "AWAITING_CONFIRMATION" && analysis?.solutioning) {
    const sol = analysis.solutioning;
    return (
      <Panel className={prominent ? "border-warning/25 shadow-lg" : ""}>
        <PanelHeader
          kicker="Gate · Stage 4"
          title="Confirm solution direction"
          body={`${VIRIN_NAME} won't write the full PRD until you align on this approach.`}
        />
        <div className="space-y-5 px-5 py-5 sm:px-6">
          <blockquote className="border-l-4 border-indigo/40 pl-4">
            <p className="text-[15px] font-medium leading-snug text-app-ink">
              {sol.problemStatement}
            </p>
          </blockquote>
          <div className="rounded-app-sm border border-app-border bg-app-surface-muted/30 p-4">
            <p className="type-kicker mb-2">Recommended approach</p>
            <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-app-ink-dim">
              {sol.recommendedApproach}
            </div>
          </div>
          {(sol.businessFit || sol.revenueImpact) && (
            <div
              className={`rounded-app-sm border p-4 ${
                sol.businessFit === "misaligned"
                  ? "border-danger/35 bg-danger/8"
                  : sol.businessFit === "weak"
                    ? "border-warning/35 bg-warning/8"
                    : "border-success/25 bg-success/5"
              }`}
            >
              <p className="type-kicker">Company validation</p>
              {sol.businessFit && (
                <p className="mt-2 text-[14px] font-medium capitalize text-app-ink">
                  Business fit: {sol.businessFit.replace(/_/g, " ")}
                </p>
              )}
              {sol.companyValidationSummary && (
                <p className="mt-1 text-[13px] leading-relaxed text-app-ink-dim">
                  {sol.companyValidationSummary}
                </p>
              )}
              {sol.revenueImpact && (
                <p className="mt-2 text-[13px] text-app-ink-dim">
                  <span className="font-medium text-app-ink">Revenue impact:</span>{" "}
                  {sol.revenueImpact}
                </p>
              )}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {sol.explicitNonGoals?.length > 0 && (
              <div className="rounded-app-sm border border-app-border p-4">
                <p className="type-kicker">Explicitly out of scope</p>
                <ul className="mt-2 space-y-1.5 text-[13px] text-app-ink-dim">
                  {sol.explicitNonGoals.map((g) => (
                    <li key={g} className="flex gap-2">
                      <span className="text-app-ink-mute">—</span>
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {sol.openRisks?.length > 0 && (
              <div className="rounded-app-sm border border-warning/30 bg-warning/5 p-4">
                <p className="type-kicker text-warning">Open risks</p>
                <ul className="mt-2 space-y-1.5 text-[13px] text-app-ink-dim">
                  {sol.openRisks.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-3 border-t border-app-border pt-4">
            <button
              type="button"
              disabled={busy}
              onClick={() => onConfirm({ confirmed: true })}
              className="app-btn-primary disabled:opacity-50"
            >
              {busy ? "Confirming…" : "Confirm → write PRD"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                onConfirm({ confirmed: false, feedback: "Please revise the approach" })
              }
              className="rounded-full border border-app-border px-5 py-2.5 text-[13px] text-app-ink-dim transition hover:border-danger/40 hover:text-danger disabled:opacity-50"
            >
              Request revision
            </button>
          </div>
        </div>
      </Panel>
    );
  }

  return null;
}

const OTHER_OPTION_ID = "__other__";

function VirinInputPanel({
  kicker,
  title,
  prompt,
  options = [],
  placeholder,
  submitLabel,
  onSubmit,
  busy,
  prominent,
  turnNumber,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [otherValue, setOtherValue] = useState("");

  const presetOptions = (options ?? []).filter(Boolean).slice(0, 4);
  const hasPresets = presetOptions.length > 0;

  const answerText =
    selectedId === OTHER_OPTION_ID
      ? otherValue.trim()
      : selectedId != null
        ? presetOptions[selectedId] ?? ""
        : "";

  const canSubmit = Boolean(answerText) && !busy;

  function resetAfterSubmit() {
    setSelectedId(null);
    setOtherValue("");
  }

  return (
    <Panel className={prominent ? "border-indigo/30 shadow-lg" : ""}>
      <PanelHeader
        kicker={kicker}
        title={title}
        right={
          turnNumber ? (
            <span className="font-mono text-[11px] text-app-ink-mute">Turn {turnNumber}</span>
          ) : null
        }
      />
      <form
        className="space-y-4 px-5 py-5 sm:px-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          onSubmit(answerText);
          resetAfterSubmit();
        }}
      >
        <div className="flex gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo/10 font-display text-sm text-indigo">
            N
          </div>
          <p className="flex-1 text-[16px] leading-relaxed text-app-ink">{prompt}</p>
        </div>

        {hasPresets ? (
          <fieldset className="space-y-2">
            <legend className="sr-only">Choose an answer</legend>
            {presetOptions.map((opt, idx) => {
              const active = selectedId === idx;
              return (
                <label
                  key={opt}
                  className={`flex cursor-pointer items-start gap-3 rounded-app-sm border px-4 py-3 transition ${
                    active
                      ? "border-indigo/40 bg-indigo/10 ring-2 ring-indigo/15"
                      : "border-app-border bg-app-surface hover:border-indigo/25"
                  }`}
                >
                  <input
                    type="radio"
                    name="neel-answer"
                    className="mt-1 shrink-0 accent-indigo"
                    checked={active}
                    onChange={() => setSelectedId(idx)}
                  />
                  <span className="text-[14px] leading-snug text-app-ink">{opt}</span>
                </label>
              );
            })}
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-app-sm border px-4 py-3 transition ${
                selectedId === OTHER_OPTION_ID
                  ? "border-indigo/40 bg-indigo/10 ring-2 ring-indigo/15"
                  : "border-app-border bg-app-surface hover:border-indigo/25"
              }`}
            >
              <input
                type="radio"
                name="neel-answer"
                className="mt-1 shrink-0 accent-indigo"
                checked={selectedId === OTHER_OPTION_ID}
                onChange={() => setSelectedId(OTHER_OPTION_ID)}
              />
              <span className="text-[14px] font-medium text-app-ink">Other</span>
            </label>
            {selectedId === OTHER_OPTION_ID && (
              <textarea
                value={otherValue}
                onChange={(e) => setOtherValue(e.target.value)}
                placeholder={placeholder}
                rows={3}
                autoFocus
                className="w-full resize-y rounded-app-sm border border-app-border bg-app-surface px-4 py-3 text-[14px] text-app-ink outline-none transition focus:border-indigo/40 focus:ring-2 focus:ring-indigo/10"
              />
            )}
          </fieldset>
        ) : (
          <textarea
            value={otherValue}
            onChange={(e) => {
              setOtherValue(e.target.value);
              setSelectedId(OTHER_OPTION_ID);
            }}
            placeholder={placeholder}
            rows={4}
            autoFocus={prominent}
            className="w-full resize-y rounded-app-sm border border-app-border bg-app-surface px-4 py-3 text-[14px] text-app-ink outline-none transition focus:border-indigo/40 focus:ring-2 focus:ring-indigo/10"
          />
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-app-ink-mute">
            {hasPresets
              ? "Options reflect your company, business context, and codebase — pick one or Other."
              : `${VIRIN_NAME} asks one question, then listens.`}
          </p>
          <button
            type="submit"
            disabled={!canSubmit}
            className="app-btn-primary disabled:opacity-50"
          >
            {busy ? "Sending…" : submitLabel}
          </button>
        </div>
      </form>
    </Panel>
  );
}

export function VirinDiscoverySection({ questionMode, expanded = false }) {
  if (!questionMode?.conversation?.length && !questionMode?.discoverySummary) {
    return (
      <Panel>
        <PanelHeader kicker="Stage 2" title="Discovery" />
        <p className="px-5 py-8 text-center text-[13px] text-app-ink-dim sm:px-6">
          Discovery conversation will appear here as {VIRIN_NAME} asks questions.
        </p>
      </Panel>
    );
  }

  const visibleTurns = expanded
    ? questionMode.conversation
    : questionMode.conversation.slice(-3);

  return (
    <Panel>
      <PanelHeader
        kicker="Stage 2"
        title="Discovery conversation"
        right={
          <span className="font-mono text-[11px] text-app-ink-mute">
            {questionMode.conversation.length} turn
            {questionMode.conversation.length === 1 ? "" : "s"}
          </span>
        }
      />
      <ol className="divide-y divide-app-border">
        {visibleTurns.map((turn, i) => {
          const globalIdx = expanded
            ? i
            : questionMode.conversation.length - visibleTurns.length + i;
          return (
            <li key={globalIdx} className="px-5 py-5 sm:px-6">
              <div className="flex gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo/10 font-mono text-[11px] font-bold text-indigo">
                  {globalIdx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-app-ink">{turn.question}</p>
                  {turn.flag && (
                    <p className="mt-2 flex items-start gap-2 rounded-app-sm border border-warning/35 bg-warning/8 px-3 py-2 text-[12px] text-warning">
                      <span aria-hidden>⚑</span>
                      {turn.flag}
                    </p>
                  )}
                  <div className="mt-3 rounded-app-sm border border-app-border/80 bg-app-surface-muted/40 px-3 py-2.5">
                    <p className="type-kicker mb-1">Your answer</p>
                    <p className="text-[14px] leading-relaxed text-app-ink-dim">{turn.answer}</p>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {questionMode.discoverySummary && (
        <div className="border-t border-app-border bg-indigo/[0.03] px-5 py-5 sm:px-6">
          <p className="type-kicker">Discovery summary</p>
          <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-app-ink-dim">
            {questionMode.discoverySummary}
          </p>
        </div>
      )}
      {questionMode.flagsRaised?.length > 0 && (
        <div className="border-t border-app-border px-5 py-4 sm:px-6">
          <p className="type-kicker">Flags raised</p>
          <ul className="mt-2 space-y-1 text-[13px] text-warning">
            {questionMode.flagsRaised.map((f) => (
              <li key={f}>• {f}</li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

export function VirinIntakeSection({ intake }) {
  if (!intake) return null;
  const typeLabel = intake.ticketType?.replace(/_/g, " ") ?? "unknown";

  return (
    <Panel>
      <PanelHeader kicker="Stage 1" title="Intake & classification" />
      <div className="space-y-4 px-5 py-5 sm:px-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-indigo/30 bg-indigo/10 px-3 py-1">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-indigo">
            {typeLabel}
          </span>
        </span>
        <div>
          <p className="type-kicker">Reasoning</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-app-ink-dim">{intake.reasoning}</p>
        </div>
        <div className="rounded-app-sm border border-app-border bg-app-surface-muted/30 p-4">
          <p className="type-kicker">Symptom vs root cause</p>
          <p className="mt-2 text-[14px] text-app-ink">{intake.symptomVsRootCause}</p>
        </div>
      </div>
    </Panel>
  );
}

export function VirinCodebaseSection({ analysis: codebaseAnalysis, expanded = false }) {
  if (!codebaseAnalysis) {
    return (
      <Panel>
        <PanelHeader kicker="Stage 3" title="Codebase analysis" />
        <p className="px-5 py-8 text-center text-[13px] text-app-ink-dim sm:px-6">
          Runs after discovery — {VIRIN_NAME} maps modules, reuse, and technical constraints.
        </p>
      </Panel>
    );
  }

  const modules = expanded
    ? codebaseAnalysis.relevantModules
    : codebaseAnalysis.relevantModules?.slice(0, 5);
  const criteria = expanded
    ? codebaseAnalysis.testableAcceptanceCriteria
    : codebaseAnalysis.testableAcceptanceCriteria?.slice(0, 6);

  return (
    <Panel>
      <PanelHeader
        kicker="Stage 3"
        title="Codebase analysis"
        right={
          <span className="rounded-full border border-app-border px-2 py-0.5 font-mono text-[10px] uppercase text-app-ink-mute">
            {codebaseAnalysis.scopeAssessment}
          </span>
        }
      />
      <div className="space-y-5 px-5 py-5 sm:px-6">
        {codebaseAnalysis.rootCauseMismatch && (
          <div className="flex gap-3 rounded-app-sm border border-warning/35 bg-warning/8 p-4">
            <span className="text-lg" aria-hidden>
              ⚠
            </span>
            <div>
              <p className="text-[13px] font-medium text-warning">Root cause mismatch</p>
              <p className="mt-1 text-[13px] text-app-ink-dim">
                {codebaseAnalysis.rootCauseMismatch}
              </p>
            </div>
          </div>
        )}

        {modules?.length > 0 && (
          <div>
            <p className="type-kicker mb-3">Relevant modules</p>
            <ul className="space-y-2">
              {modules.map((m) => (
                <li
                  key={m.path}
                  className="flex flex-col gap-1 rounded-app-sm border border-app-border bg-app-surface-muted/30 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <code className="font-mono text-[12px] text-indigo">{m.path}</code>
                  <span className="text-[12px] text-app-ink-dim">{m.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {codebaseAnalysis.reuseOpportunities?.length > 0 && (
          <div>
            <p className="type-kicker mb-2">Reuse opportunities</p>
            <ul className="list-disc space-y-1 pl-4 text-[13px] text-app-ink-dim">
              {codebaseAnalysis.reuseOpportunities.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {criteria?.length > 0 && (
          <div>
            <p className="type-kicker mb-3">Testable acceptance criteria</p>
            <ul className="space-y-2">
              {criteria.map((ac) => (
                <li
                  key={ac}
                  className="flex gap-2 rounded-app-sm border border-success/20 bg-success/5 px-3 py-2 text-[13px] text-app-ink-dim"
                >
                  <span className="text-success">✓</span>
                  {ac}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}

export function VirinHandoffPackageSection({ handoffPackage, expanded = false }) {
  if (!handoffPackage) {
    return (
      <Panel>
        <PanelHeader kicker="Stage 6" title="Engineering handoff" />
        <p className="px-5 py-8 text-center text-[13px] text-app-ink-dim sm:px-6">
          Ticket breakdown and dependency map appear after the PRD is complete.
        </p>
      </Panel>
    );
  }

  const tickets = handoffPackage.engineeringTickets ?? [];

  return (
    <Panel>
      <PanelHeader
        kicker="Stage 6"
        title="Engineering handoff package"
        right={
          <span className="font-mono text-[11px] text-app-ink-mute">
            {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
          </span>
        }
      />
      <div className="space-y-4 px-5 py-5 sm:px-6">
        <div className="grid gap-3">
          {tickets.map((t) => (
            <article
              key={t.id}
              className="rounded-app-sm border border-app-border bg-app-surface-muted/20 p-4 transition hover:border-indigo/25"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] font-semibold text-indigo">{t.id}</span>
                {t.dependsOn?.length > 0 && (
                  <span className="text-[10px] text-app-ink-mute">
                    depends on {t.dependsOn.join(", ")}
                  </span>
                )}
              </div>
              <h4 className="mt-2 text-[15px] font-medium text-app-ink">{t.title}</h4>
              <p className="mt-1 text-[13px] text-app-ink-dim">{t.description}</p>
              {t.acceptanceCriteria?.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-app-border pt-3">
                  {t.acceptanceCriteria.map((ac) => (
                    <li key={ac} className="flex gap-2 text-[12px] text-app-ink-dim">
                      <span className="text-success">✓</span>
                      {ac}
                    </li>
                  ))}
                </ul>
              )}
              {expanded && t.technicalNotes?.length > 0 && (
                <p className="mt-2 font-mono text-[11px] text-app-ink-mute">
                  {t.technicalNotes.join(" · ")}
                </p>
              )}
            </article>
          ))}
        </div>

        {handoffPackage.definitionOfDone?.length > 0 && (
          <div className="rounded-app-sm border border-success/25 bg-success/5 p-4">
            <p className="type-kicker">Definition of done</p>
            <ul className="mt-2 space-y-1">
              {handoffPackage.definitionOfDone.map((d) => (
                <li key={d} className="flex gap-2 text-[13px] text-app-ink-dim">
                  <span className="text-success">□</span>
                  {d}
                </li>
              ))}
            </ul>
          </div>
        )}

        {handoffPackage.dependencyMapMarkdown && (
          <details className="group rounded-app-sm border border-app-border">
            <summary className="cursor-pointer px-4 py-3 text-[13px] font-medium text-app-ink-dim hover:text-app-ink">
              Dependency map
            </summary>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t border-app-border bg-app-surface-muted/30 p-4 font-mono text-[11px] leading-relaxed text-app-ink-dim">
              {handoffPackage.dependencyMapMarkdown}
            </pre>
          </details>
        )}
      </div>
    </Panel>
  );
}

export function VirinPostShipSection({ postShip }) {
  if (!postShip) return null;
  return (
    <Panel>
      <PanelHeader kicker="Stage 7" title="Post-ship review" />
      <div className="space-y-4 px-5 py-5 sm:px-6">
        <p className="text-[15px] font-medium text-app-ink">{postShip.retrospectiveSummary}</p>
        <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-app-ink-dim">
          {postShip.metricsReview}
        </p>
        {postShip.outcomesVsTargets?.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-app-border type-kicker">
                  <th className="py-2 pr-4">Metric</th>
                  <th className="py-2 pr-4">Target</th>
                  <th className="py-2 pr-4">Actual</th>
                  <th className="py-2">Met</th>
                </tr>
              </thead>
              <tbody>
                {postShip.outcomesVsTargets.map((row) => (
                  <tr key={row.metric} className="border-b border-app-border/60">
                    <td className="py-2.5 pr-4 text-app-ink">{row.metric}</td>
                    <td className="py-2.5 pr-4 text-app-ink-dim">{row.target}</td>
                    <td className="py-2.5 pr-4 text-app-ink-dim">{row.actual}</td>
                    <td className="py-2.5">{row.met ? "✓" : "✗"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Panel>
  );
}
