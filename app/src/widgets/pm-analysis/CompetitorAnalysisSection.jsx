import { Panel, PanelHeader } from "../../shared/ui/Panel";

function DecisionBadge({ decision }) {
  if (!decision || decision === "pending") return null;
  const tone =
    decision === "run"
      ? "border-success/40 bg-success/10 text-success"
      : "border-app-border bg-app-surface-muted/40 text-app-ink-mute";
  return (
    <span className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase ${tone}`}>
      {decision === "run" ? "Analyzed" : "Skipped"}
    </span>
  );
}

export function CompetitorAnalysisSection({ competitorAnalysis, expanded = false }) {
  if (!competitorAnalysis) return null;

  const { decision, analyses = [], summaryMarkdown, featureSummary } = competitorAnalysis;
  const hasContent = decision === "run" && analyses.length > 0;

  if (decision === "skipped" && !expanded) return null;

  return (
    <Panel>
      <PanelHeader
        kicker="Stage 3"
        title="Competitor analysis"
        right={<DecisionBadge decision={decision} />}
      />
      <div className="space-y-5 px-5 py-5 sm:px-6">
        {featureSummary && (
          <div>
            <p className="type-kicker">Feature under review</p>
            <p className="mt-1 text-[14px] text-app-ink-dim">{featureSummary}</p>
          </div>
        )}

        {decision === "skipped" && (
          <p className="text-[14px] text-app-ink-mute">
            Competitor analysis was skipped for this ticket.
          </p>
        )}

        {summaryMarkdown && hasContent && (
          <div className="rounded-app-sm border border-app-border bg-app-surface-muted/30 p-4">
            <p className="type-kicker mb-2">Summary</p>
            <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-app-ink-dim">
              {summaryMarkdown}
            </div>
          </div>
        )}

        {hasContent && (
          <ul className="space-y-4">
            {analyses.map((a) => (
              <li
                key={`${a.competitorName}-${a.competitorWebsite}`}
                className="rounded-app-sm border border-app-border p-4"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="text-[15px] font-medium text-app-ink">{a.competitorName}</p>
                  {a.competitorWebsite && (
                    <a
                      href={a.competitorWebsite.startsWith("http") ? a.competitorWebsite : `https://${a.competitorWebsite}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[11px] text-indigo hover:underline"
                    >
                      {a.competitorWebsite}
                    </a>
                  )}
                </div>
                <p className="mt-2 text-[14px] leading-relaxed text-app-ink-dim">
                  {a.howTheySolveIt}
                </p>
                {a.strengths?.length > 0 && (
                  <div className="mt-3">
                    <p className="type-kicker text-success">Strengths</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-[13px] text-app-ink-dim">
                      {a.strengths.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {a.gaps?.length > 0 && (
                  <div className="mt-3">
                    <p className="type-kicker text-warning">Gaps / opportunities</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-[13px] text-app-ink-dim">
                      {a.gaps.map((g) => (
                        <li key={g}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {decision === "pending" && (
          <p className="text-[14px] text-app-ink-mute">
            Waiting for your decision on whether to run competitor analysis.
          </p>
        )}
      </div>
    </Panel>
  );
}
