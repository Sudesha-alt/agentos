import LabelPill from "../../app/components/LabelPill";

/** Renders generated PRD (full) or legacy PrdOutput shape. */
import { formatScorePercent } from "../../entities/discovery";

export default function DiscoveryPrdSection({ parsed, scores }) {
  const prd = parsed.generatedPrd ?? adaptLegacyPrd(parsed.prd);

  if (!prd) {
    return <p className="text-[13px] text-ink-dim">PRD not generated yet.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[1rem] border border-indigo/25 bg-indigo/5 px-4 py-4">
        <p className="font-display text-[1.25rem] text-ink">{prd.title}</p>
        <p className="mt-2 font-mono text-[11px] text-ink-dim">
          {prd.version ?? "v1.0"} · {prd.status ?? "Draft"} · {prd.effortEstimate ?? "—"}
          {scores ? ` · quality ${formatScorePercent(scores.prdQualityScore)}` : ""}
        </p>
      </div>

      <ProseBlock label="Problem" text={prd.problemStatement} />
      <ProseBlock label="Solution" text={prd.proposedSolution} />
      {prd.successDefinition ? (
        <ProseBlock label="Definition of done" text={prd.successDefinition} />
      ) : null}

      {prd.userStories?.length > 0 ? (
        <div>
          <p className="editorial-kicker mb-3 text-ink-mute">User stories</p>
          <ul className="space-y-4">
            {prd.userStories.map((story) => (
              <li
                key={story.id ?? story.story}
                className="rounded-[0.85rem] border border-hairline bg-canvas/30 px-3 py-3"
              >
                <div className="flex flex-wrap gap-2">
                  {story.id ? (
                    <span className="font-mono text-[10px] text-indigo">{story.id}</span>
                  ) : null}
                  {story.priority ? (
                    <LabelPill label={story.priority} tone="muted" />
                  ) : null}
                </div>
                <p className="mt-2 text-[14px] text-ink">
                  {typeof story === "string" ? story : story.story}
                </p>
                {story.acceptanceCriteria?.length ? (
                  <ul className="mt-3 space-y-1.5 border-t border-hairline pt-3">
                    {story.acceptanceCriteria.map((ac, i) => (
                      <li
                        key={i}
                        className="font-mono text-[11px] leading-relaxed text-ink-dim"
                      >
                        ✓ {ac}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {prd.technicalRequirements?.endpoints?.length > 0 ? (
        <div>
          <p className="editorial-kicker mb-3 text-ink-mute">API endpoints</p>
          <ul className="space-y-2">
            {prd.technicalRequirements.endpoints.map((e, i) => (
              <li key={i} className="rounded-[0.85rem] border border-hairline bg-canvas/30 px-3 py-3">
                <p className="font-mono text-[12px] text-indigo">
                  {e.method} {e.path}
                </p>
                <p className="mt-1 text-[13px] text-ink-dim">{e.description}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {prd.outOfScope?.length > 0 ? (
        <BulletList label="Out of scope" items={prd.outOfScope} />
      ) : null}

      {prd.openQuestions?.length > 0 ? (
        <div>
          <p className="editorial-kicker mb-3 text-ink-mute">Open questions</p>
          <ul className="space-y-2">
            {prd.openQuestions.map((q, i) => (
              <li
                key={i}
                className="rounded-[0.85rem] border border-hairline bg-canvas/30 px-3 py-3 text-[13px] text-ink"
              >
                {typeof q === "string" ? (
                  q
                ) : (
                  <>
                    <p>{q.question}</p>
                    <p className="mt-1 text-ink-dim">Default: {q.defaultAssumption}</p>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {prd.risks?.length > 0 ? (
        <div>
          <p className="editorial-kicker mb-3 text-ink-mute">Risks</p>
          <ul className="space-y-2">
            {prd.risks.map((r, i) => (
              <li key={i} className="rounded-[0.85rem] border border-hairline bg-canvas/30 px-3 py-3">
                <LabelPill label={r.probability} tone="warning" />
                <p className="mt-2 text-[14px] text-ink">{r.risk}</p>
                <p className="mt-1 text-[13px] text-ink-dim">{r.mitigation}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {parsed.prd?.confidenceReason ? (
        <p className="text-[13px] italic text-ink-dim">{parsed.prd.confidenceReason}</p>
      ) : null}
    </div>
  );
}

function adaptLegacyPrd(legacy) {
  if (!legacy) return null;
  return {
    title: legacy.title,
    problemStatement: legacy.problemStatement,
    proposedSolution: legacy.proposedSolution,
    effortEstimate: null,
    userStories: (legacy.userStories ?? []).map((s, i) => ({
      id: `US-${String(i + 1).padStart(3, "0")}`,
      story: s,
      acceptanceCriteria: i === 0 ? legacy.acceptanceCriteria ?? [] : [],
      priority: "must-have",
    })),
    outOfScope: legacy.outOfScope,
    openQuestions: legacy.openQuestions,
    risks: (legacy.edgeCases ?? []).map((e) => ({
      risk: e,
      probability: "medium",
      mitigation: "See engineering plan",
    })),
  };
}

function ProseBlock({ label, text }) {
  if (!text) return null;
  return (
    <div>
      <p className="editorial-kicker text-ink-mute">{label}</p>
      <p className="mt-2 text-[14px] leading-relaxed text-ink">{text}</p>
    </div>
  );
}

function BulletList({ label, items }) {
  return (
    <div>
      <p className="editorial-kicker mb-2 text-ink-mute">{label}</p>
      <ul className="list-inside list-disc space-y-1 text-[14px] text-ink-dim">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
