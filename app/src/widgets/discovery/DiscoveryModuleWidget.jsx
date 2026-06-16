import { useMemo, useState } from "react";
import JsonViewer from "../../app/components/JsonViewer";
import StatusPill from "../../app/components/StatusPill";
import { getDiscoveryScores } from "../../entities/discovery";
import { formatScoreBand } from "../../shared/lib/formatScoreBand";
import LabelPill from "../../app/components/LabelPill";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import { TitleWithInfo } from "../../shared/ui/InfoTip";
import {
  formatCompactNumber,
  formatDuration,
  formatUsd,
} from "../../shared/lib/format";
import DiscoverySectionNav from "./DiscoverySectionNav";
import DiscoveryOverviewSection from "./DiscoveryOverviewSection";
import DiscoveryAnalysisSection from "./DiscoveryAnalysisSection";
import DiscoveryHistorySection from "./DiscoveryHistorySection";
import DiscoveryGapsSection from "./DiscoveryGapsSection";
import DiscoveryPrdSection from "./DiscoveryPrdSection";

export default function DiscoveryModuleWidget({ parsed, stage, rawOutput }) {
  const [section, setSection] = useState("overview");
  const [showRaw, setShowRaw] = useState(false);
  const scores = useMemo(() => getDiscoveryScores(parsed), [parsed]);

  const availableSections = useMemo(() => {
    const ids = ["overview"];
    if (parsed.ticketAnalysis) ids.push("analysis");
    if (parsed.historicalIntelligence) ids.push("history");
    if (parsed.gapAnalysis) ids.push("gaps");
    ids.push("prd");
    return ids;
  }, [parsed]);

  return (
    <Panel>
      <PanelHeader
        kicker="Discovery engine"
        title={
          stage.status === "RUNNING"
            ? "Running discovery pipeline"
            : stage.status === "AWAITING_HUMAN"
              ? "Paused — clarification needed"
              : "Discovery complete"
        }
        right={
          <div className="flex flex-wrap items-center gap-2">
            {scores?.recommendation ? (
              <LabelPill
                label={scores.recommendation}
                tone={
                  scores.recommendation === "proceed"
                    ? "success"
                    : scores.recommendation === "review"
                      ? "warning"
                      : "danger"
                }
              />
            ) : null}
            <StatusPill status={stage.status} />
          </div>
        }
      />

      {scores && !scores.passesGate && scores.gateFailureReasons?.length ? (
        <div className="border-b border-warning/30 bg-warning/5 px-5 py-3 sm:px-6">
          <p className="editorial-kicker text-warning">Below PRD gate (70%)</p>
          <ul className="mt-2 space-y-1 text-[13px] text-ink-dim">
            {scores.gateFailureReasons.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 border-b border-hairline px-5 py-4 sm:grid-cols-4 sm:px-6">
        <Metric
          label="Understanding"
          value={formatScoreBand(scores?.bands?.understanding)}
          info="Ticket clarity from ambiguities, personas, and scope."
        />
        <Metric
          label="PRD quality"
          value={formatScoreBand(scores?.bands?.prdQuality)}
          info="Build-readiness from gaps, NFRs, and stories (70% gate)."
        />
        <Metric label="Tokens" value={formatCompactNumber(stage.tokenCount)} />
        <Metric label="Cost" value={formatUsd(stage.costUsd)} />
      </div>

      <div className="grid grid-cols-2 gap-3 border-b border-hairline px-5 pb-4 sm:grid-cols-3 sm:px-6">
        <Metric
          label="Historical signal"
          value={formatScoreBand(scores?.bands?.historicalSignal)}
          info="Coverage-led RAG strength from past tickets."
        />
        <Metric
          label="Complexity"
          value={
            typeof scores?.complexityScore === "number"
              ? `${scores.complexityScore}/10`
              : "—"
          }
          info="Derived from scope size and gap count."
        />
        <Metric
          label="Duration"
          value={formatDuration(stage.startedAt, stage.completedAt)}
        />
      </div>

      <DiscoverySectionNav
        active={section}
        onChange={setSection}
        available={availableSections}
      />

      <div className="px-5 py-5 sm:px-6">
        {section === "overview" ? (
          <DiscoveryOverviewSection parsed={parsed} scores={scores} />
        ) : null}
        {section === "analysis" ? (
          <DiscoveryAnalysisSection ticketAnalysis={parsed.ticketAnalysis} />
        ) : null}
        {section === "history" ? (
          <DiscoveryHistorySection
            historicalIntelligence={parsed.historicalIntelligence}
            historicalSignalScore={scores?.historicalSignalScore}
          />
        ) : null}
        {section === "gaps" ? (
          <DiscoveryGapsSection gapAnalysis={parsed.gapAnalysis} />
        ) : null}
        {section === "prd" ? (
          <DiscoveryPrdSection parsed={parsed} scores={scores} />
        ) : null}
      </div>

      <div className="border-t border-hairline px-5 py-4 sm:px-6">
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim hover:text-ink"
        >
          {showRaw ? "Hide raw JSON" : "View raw stage output"}
        </button>
        {showRaw && rawOutput ? (
          <div className="mt-3">
            <JsonViewer value={rawOutput} />
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function Metric({ label, value, info }) {
  return (
    <div className="rounded-2xl border border-hairline bg-canvas/35 px-3 py-3">
      <p className="editorial-kicker text-ink-mute">
        <TitleWithInfo info={info}>{label}</TitleWithInfo>
      </p>
      <p className="mt-2 font-mono text-[14px] text-ink">{value}</p>
    </div>
  );
}
