import LabelPill from "../../app/components/LabelPill";

export default function DiscoveryGapsSection({ gapAnalysis }) {
  if (!gapAnalysis) {
    return <p className="text-[13px] text-ink-dim">Gap analysis not available.</p>;
  }

  const {
    knownKnowns = [],
    knownUnknowns = [],
    endpointGaps = [],
    dataGaps = [],
    nfrGaps = [],
  } = gapAnalysis;

  return (
    <div className="space-y-6">
      {knownKnowns.length > 0 ? (
        <ListSection title="Known knowns" count={knownKnowns.length}>
          {knownKnowns.map((k, i) => (
            <li
              key={i}
              className="rounded-[0.85rem] border border-hairline bg-canvas/30 px-3 py-3"
            >
              <p className="text-[14px] text-ink">{k.item}</p>
              <p className="mt-1 font-mono text-[10px] text-ink-mute">{k.source}</p>
            </li>
          ))}
        </ListSection>
      ) : null}

      {knownUnknowns.length > 0 ? (
        <ListSection title="Known unknowns" count={knownUnknowns.length}>
          {knownUnknowns.map((u, i) => (
            <li
              key={i}
              className="rounded-[0.85rem] border border-warning/20 bg-warning/5 px-3 py-3"
            >
              <div className="flex flex-wrap gap-2">
                <LabelPill label={u.category} tone="muted" />
                {u.resolutionRequired ? (
                  <LabelPill label="must resolve" tone="warning" />
                ) : null}
              </div>
              <p className="mt-2 text-[14px] text-ink">{u.gap}</p>
              <p className="mt-2 text-[13px] text-ink-dim">
                Default: {u.defaultAssumption}
              </p>
            </li>
          ))}
        </ListSection>
      ) : null}

      {endpointGaps.length > 0 ? (
        <ListSection title="API / endpoint gaps" count={endpointGaps.length}>
          {endpointGaps.map((e, i) => (
            <li
              key={i}
              className="rounded-[0.85rem] border border-hairline bg-canvas/30 px-3 py-3"
            >
              <p className="text-[14px] text-ink">{e.description}</p>
              <p className="mt-2 font-mono text-[11px] text-indigo">
                {e.newEndpointNeeded || e.existingEndpoint || "TBD"}
                {e.httpMethod ? ` · ${e.httpMethod}` : ""}
              </p>
              <span className="mt-2 inline-block">
                <LabelPill label={e.estimatedComplexity} tone="muted" />
              </span>
            </li>
          ))}
        </ListSection>
      ) : null}

      {dataGaps.length > 0 ? (
        <ListSection title="Data model gaps" count={dataGaps.length}>
          {dataGaps.map((d, i) => (
            <li
              key={i}
              className="rounded-[0.85rem] border border-hairline bg-canvas/30 px-3 py-3"
            >
              <p className="text-[14px] text-ink">{d.description}</p>
              {d.newFieldsNeeded?.length ? (
                <p className="mt-2 font-mono text-[11px] text-ink-dim">
                  Fields: {d.newFieldsNeeded.join(", ")}
                </p>
              ) : null}
            </li>
          ))}
        </ListSection>
      ) : null}

      {nfrGaps.length > 0 ? (
        <ListSection title="Non-functional gaps" count={nfrGaps.length}>
          {nfrGaps.map((n, i) => (
            <li
              key={i}
              className="rounded-[0.85rem] border border-hairline bg-canvas/30 px-3 py-3"
            >
              <LabelPill label={n.type} tone="muted" />
              <p className="mt-2 text-[14px] text-ink">{n.gap}</p>
              <p className="mt-1 text-[13px] text-ink-dim">
                Standard: {n.defaultStandard}
              </p>
            </li>
          ))}
        </ListSection>
      ) : null}
    </div>
  );
}

function ListSection({ title, count, children }) {
  return (
    <div>
      <p className="editorial-kicker mb-3 text-ink-mute">
        {title} ({count})
      </p>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}
