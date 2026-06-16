import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { analyzeCodebaseImpact } from "../../entities/codebase";
import Spinner from "../../app/components/Spinner";
import { Panel, PanelHeader } from "../../shared/ui/Panel";

const RISK_COLORS = {
  low: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  medium: "text-amber-400 border-amber-500/40 bg-amber-500/10",
  high: "text-orange-400 border-orange-500/40 bg-orange-500/10",
  critical: "text-danger border-danger/40 bg-danger/10",
};

function ImpactList({ title, items, empty }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">{title}</p>
      {items?.length ? (
        <ul className="mt-2 space-y-1.5">
          {items.map((item) => (
            <li key={item.path} className="text-[13px]">
              <span className="font-mono text-indigo">{item.path}</span>
              {item.via ? (
                <span className="ml-2 text-ink-mute">via {item.via}</span>
              ) : null}
              {item.reason ? (
                <span className="ml-2 text-ink-dim">— {item.reason}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[13px] text-ink-dim">{empty}</p>
      )}
    </div>
  );
}

export default function CodebaseImpactPanel({ branch = "main" }) {
  const [pathsInput, setPathsInput] = useState("");
  const [changeDescription, setChangeDescription] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  async function handleAnalyze(e) {
    e.preventDefault();
    const filePaths = pathsInput
      .split(/[\n,]/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (!filePaths.length) {
      setError("Enter at least one file path.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await analyzeCodebaseImpact({
        filePaths,
        changeDescription,
        branchName: branch,
      });
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impact analysis failed");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  function showOnMap() {
    if (!report?.mapHighlights) return;
    const all = [
      ...report.mapHighlights.changed,
      ...report.mapHighlights.direct,
      ...report.mapHighlights.indirect,
      ...report.mapHighlights.tests,
    ];
    sessionStorage.setItem("codebase-map-highlights", JSON.stringify([...new Set(all)]));
    const next = new URLSearchParams(params);
    next.set("tab", "map");
    navigate(`/app/codebase?${next.toString()}`);
  }

  const riskClass = report?.risk?.level
    ? RISK_COLORS[report.risk.level] ?? RISK_COLORS.medium
    : "";

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader kicker="Impact analyser" title="Change risk before you ship" />
        <form onSubmit={handleAnalyze} className="space-y-4 px-5 py-5 sm:px-6">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
              Files to change (comma or newline separated)
            </label>
            <textarea
              value={pathsInput}
              onChange={(e) => setPathsInput(e.target.value)}
              rows={3}
              placeholder="server/src/payment/service.ts"
              className="mt-2 w-full rounded-xl border border-hairline bg-canvas/60 px-4 py-3 font-mono text-[13px] outline-none focus:border-indigo/40"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
              Planned change
            </label>
            <input
              value={changeDescription}
              onChange={(e) => setChangeDescription(e.target.value)}
              placeholder="Rename processPayment and change its return type"
              className="mt-2 h-11 w-full rounded-full border border-hairline bg-canvas/60 px-4 text-[13px] outline-none focus:border-indigo/40"
            />
          </div>
          {error ? <p className="text-[13px] text-danger">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-indigo px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white disabled:opacity-50"
          >
            {loading ? "Analysing…" : "Analyse impact"}
          </button>
        </form>
      </Panel>

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner label="Tracing dependencies…" />
        </div>
      ) : null}

      {report ? (
        <Panel>
          <PanelHeader
            kicker="Impact report"
            title={`Risk: ${report.risk.level}`}
            subtitle={report.risk.reasoning}
            right={
              <button
                type="button"
                onClick={showOnMap}
                className="rounded-full border border-indigo/50 bg-indigo/10 px-4 py-2 text-[12px] text-ink"
              >
                Show on map
              </button>
            }
          />
          <div className={`mx-5 mb-4 rounded-xl border px-4 py-3 sm:mx-6 ${riskClass}`}>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em]">
              {report.risk.level} risk
            </p>
            <p className="mt-1 text-[14px]">{report.changeDescription}</p>
          </div>
          <div className="grid gap-6 px-5 pb-6 sm:grid-cols-2 sm:px-6">
            <ImpactList
              title="Direct impact"
              items={report.directImpact}
              empty="No direct importers found in the index."
            />
            <ImpactList
              title="Indirect impact"
              items={report.indirectImpact}
              empty="No second-degree dependents found."
            />
            <ImpactList
              title="Test impact"
              items={report.testImpact}
              empty="No related test files detected."
            />
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
