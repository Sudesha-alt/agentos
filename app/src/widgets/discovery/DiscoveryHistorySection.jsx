import LabelPill from "../../app/components/LabelPill";

import { formatScorePercent } from "../../entities/discovery";

export default function DiscoveryHistorySection({
  historicalIntelligence,
  historicalSignalScore,
}) {
  if (!historicalIntelligence) {
    return (
      <p className="text-[13px] text-ink-dim">
        No historical intelligence — vector store had no similar tickets for this
        query.
      </p>
    );
  }

  const {
    successPatterns = [],
    knownFailures = [],
    impliedRequirements = [],
    reuseOpportunities = [],
    historicalQAIssues = [],
    historicalCoverage,
  } = historicalIntelligence;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <p className="editorial-kicker text-ink-mute">Historical coverage</p>
        <LabelPill label={historicalCoverage ?? "none"} tone="muted" />
        {typeof historicalSignalScore === "number" ? (
          <span className="font-mono text-[11px] text-ink-dim">
            Signal {formatScorePercent(historicalSignalScore)}
          </span>
        ) : null}
      </div>

      <Block title="Success patterns" items={successPatterns} render={(p) => (
        <>
          <p className="text-[14px] text-ink">{p.pattern}</p>
          <p className="mt-1 font-mono text-[10px] text-ink-mute">
            {p.source} · {p.applicability}
          </p>
        </>
      )} />

      <Block title="Known failures to avoid" items={knownFailures} render={(f) => (
        <>
          <p className="text-[14px] text-ink">{f.failure}</p>
          <p className="mt-2 text-[13px] text-ink-dim">{f.preventionSuggestion}</p>
        </>
      )} />

      <Block title="Implied requirements" items={impliedRequirements} render={(r) => (
        <>
          <p className="text-[14px] text-ink">{r.requirement}</p>
      <p className="mt-1 font-mono text-[10px] text-ink-mute">source {r.source}</p>
        </>
      )} />

      <Block title="Reuse opportunities" items={reuseOpportunities} render={(r) => (
        <>
          <p className="font-mono text-[11px] text-indigo">{r.component}</p>
          <p className="mt-1 text-[13px] text-ink-dim">{r.description}</p>
        </>
      )} />

      <Block title="Historical QA issues" items={historicalQAIssues} render={(i) => (
        <div className="flex items-start gap-2">
          <LabelPill label={i.frequency} tone="muted" />
          <p className="text-[14px] text-ink">{i.issue}</p>
        </div>
      )} />
    </div>
  );
}

function Block({ title, items, render }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="editorial-kicker mb-3 text-ink-mute">
        {title} ({items.length})
      </p>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={i}
            className="rounded-[0.85rem] border border-hairline bg-canvas/30 px-3 py-3"
          >
            {render(item)}
          </li>
        ))}
      </ul>
    </div>
  );
}
