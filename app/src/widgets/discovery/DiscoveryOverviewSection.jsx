import { formatScoreBand } from "../../shared/lib/formatScoreBand";
import { TitleWithInfo } from "../../shared/ui/InfoTip";

export default function DiscoveryOverviewSection({ parsed, scores }) {
  const analysis = parsed.ticketAnalysis;
  const gaps = parsed.gapAnalysis;
  const complexity = parsed.complexityAssessment;

  const complexityDisplay =
    typeof scores?.complexityScore === "number"
      ? scores.complexityScore
      : complexity?.overallScore;

  return (
    <div className="space-y-5">
      {analysis?.coreIntent ? (
        <div className="rounded-[1rem] border border-hairline bg-canvas/40 px-4 py-4">
          <p className="editorial-kicker text-ink-mute">Core intent</p>
          <p className="mt-2 text-[15px] leading-relaxed text-ink">{analysis.coreIntent}</p>
        </div>
      ) : null}

      {scores ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Understanding score"
            value={formatScoreBand(scores.bands?.understanding)}
            info="Ambiguities, clarity, and personas."
          />
          <Stat
            label="PRD quality score"
            value={formatScoreBand(scores.bands?.prdQuality)}
            info="Gaps, NFRs, and stories (70% gate)."
          />
          <Stat
            label="Historical signal"
            value={formatScoreBand(scores.bands?.historicalSignal)}
            info="Coverage-led RAG from past tickets."
          />
          <Stat
            label="Complexity score"
            value={
              typeof complexityDisplay === "number"
                ? `${complexityDisplay}/10`
                : "—"
            }
            info="From scope size and gaps."
          />
        </div>
      ) : (
        <p className="text-[13px] text-ink-dim">
          Computed scores are not available for this run. Re-run the pipeline to
          generate server-side scores.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {analysis?.workType ? (
          <Stat label="Work type" value={formatWorkType(analysis.workType)} />
        ) : null}
        {analysis?.roughComplexity ? (
          <Stat label="Rough size (LLM label)" value={analysis.roughComplexity} />
        ) : null}
      </div>

      {complexity?.effortEstimate ? (
        <div className="rounded-[1rem] border border-hairline bg-canvas/40 px-4 py-4">
          <p className="editorial-kicker text-ink-mute">Effort range (LLM estimate)</p>
          <p className="mt-3 font-mono text-[12px] text-ink-dim">
            {complexity.effortEstimate.optimistic}–
            {complexity.effortEstimate.pessimistic}{" "}
            {complexity.effortEstimate.unit} · realistic{" "}
            {complexity.effortEstimate.realistic}
          </p>
          {complexity.priorityAssessment?.recommendedPriority ? (
            <p className="mt-2 text-[13px] text-ink-dim">
              Suggested priority:{" "}
              <span className="text-ink">
                {complexity.priorityAssessment.recommendedPriority}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      {gaps ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Total gaps" value={String(gaps.totalGaps ?? "—")} />
          <Stat
            label="Blocking gaps"
            value={String(gaps.blockingGaps ?? "—")}
            highlight={gaps.blockingGaps > 0}
          />
          <Stat label="PRD readiness" value={gaps.readinessForPRD ?? "—"} />
        </div>
      ) : null}

      {parsed.mode === "legacy" ? (
        <p className="rounded-xl border border-hairline bg-canvas/30 px-4 py-3 text-[13px] text-ink-dim">
          Legacy single-pass run. Re-run the pipeline for full discovery and
          formula scores.
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value, info, highlight }) {
  return (
    <div
      className={`rounded-2xl border px-3 py-3 ${
        highlight ? "border-warning/40 bg-warning/5" : "border-hairline bg-canvas/35"
      }`}
    >
      <p className="editorial-kicker text-ink-mute">
        <TitleWithInfo info={info}>{label}</TitleWithInfo>
      </p>
      <p className="mt-2 font-mono text-[14px] capitalize text-ink">{value}</p>
    </div>
  );
}

function formatWorkType(type) {
  return String(type).replace(/-/g, " ");
}
