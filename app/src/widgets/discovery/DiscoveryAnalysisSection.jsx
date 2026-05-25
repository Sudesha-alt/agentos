import LabelPill from "../../app/components/LabelPill";

export default function DiscoveryAnalysisSection({ ticketAnalysis }) {
  if (!ticketAnalysis) {
    return <Empty message="Ticket analysis not available for this run." />;
  }

  const { atomicRequirements = [], ambiguities = [], userPersonas = [], systemsAffected = [] } =
    ticketAnalysis;

  return (
    <div className="space-y-6">
      {systemsAffected.length > 0 ? (
        <div>
          <p className="editorial-kicker mb-2 text-ink-mute">Systems affected</p>
          <div className="flex flex-wrap gap-2">
            {systemsAffected.map((s) => (
              <LabelPill key={s} label={s} tone="muted" />
            ))}
          </div>
        </div>
      ) : null}

      {atomicRequirements.length > 0 ? (
        <div>
          <p className="editorial-kicker mb-3 text-ink-mute">
            Atomic requirements ({atomicRequirements.length})
          </p>
          <ul className="space-y-2">
            {atomicRequirements.map((req) => (
              <li
                key={req.id}
                className="rounded-[0.85rem] border border-hairline bg-canvas/30 px-3 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] text-indigo">{req.id}</span>
                  <LabelPill label={req.type} tone="muted" />
                  <LabelPill label={req.source} tone="muted" />
                  <LabelPill
                    label={req.clarity}
                    tone={
                      req.clarity === "clear"
                        ? "success"
                        : req.clarity === "ambiguous"
                          ? "warning"
                          : "muted"
                    }
                  />
                </div>
                <p className="mt-2 text-[14px] text-ink">{req.description}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {ambiguities.length > 0 ? (
        <div>
          <p className="editorial-kicker mb-3 text-ink-mute">Ambiguities</p>
          <ul className="space-y-3">
            {ambiguities.map((a, i) => (
              <li
                key={i}
                className="rounded-[0.85rem] border border-warning/25 bg-warning/5 px-3 py-3"
              >
                <div className="flex items-center gap-2">
                  <LabelPill label={a.impact} tone={impactTone(a.impact)} />
                </div>
                <p className="mt-2 text-[14px] text-ink">{a.description}</p>
                <p className="mt-2 font-mono text-[11px] text-ink-dim">
                  Q: {a.question}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {userPersonas.length > 0 ? (
        <div>
          <p className="editorial-kicker mb-3 text-ink-mute">User personas</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {userPersonas.map((p, i) => (
              <li
                key={i}
                className="rounded-[0.85rem] border border-hairline bg-canvas/30 px-3 py-3"
              >
                <p className="font-mono text-[11px] text-indigo">{p.persona}</p>
                <p className="mt-2 text-[13px] text-ink">
                  <span className="text-ink-mute">Need:</span> {p.need}
                </p>
                <p className="mt-1 text-[13px] text-ink-dim">
                  <span className="text-ink-mute">Pain:</span> {p.currentPain}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function impactTone(impact) {
  if (impact === "blocking") return "danger";
  if (impact === "high") return "warning";
  return "muted";
}

function Empty({ message }) {
  return <p className="text-[13px] text-ink-dim">{message}</p>;
}
