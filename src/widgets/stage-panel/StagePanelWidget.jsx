import StatusPill from "../../app/components/StatusPill";
import JsonViewer from "../../app/components/JsonViewer";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import {
  formatCompactNumber,
  formatDuration,
  formatStageLabel,
  formatUsd,
} from "../../shared/lib/format";
import ValidationPanelWidget from "../validation-panel/ValidationPanelWidget";

export default function StagePanelWidget({ stage }) {
  if (!stage) return null;

  return (
    <Panel>
      <PanelHeader
        kicker={formatStageLabel(stage.stage)}
        title={
          stage.status === "AWAITING_HUMAN"
            ? "Awaiting human override"
            : stage.status === "RUNNING"
              ? "Currently running"
              : stage.status === "PENDING"
                ? "Pending"
                : "Stage output"
        }
        right={<StatusPill status={stage.status} />}
      />

      <div className="space-y-5 px-5 py-4 sm:px-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KV
            label="Confidence"
            value={
              typeof stage.confidenceScore === "number"
                ? stage.confidenceScore.toFixed(2)
                : "—"
            }
          />
          <KV label="Tokens" value={formatCompactNumber(stage.tokenCount)} />
          <KV label="Cost" value={formatUsd(stage.costUsd)} />
          <KV
            label="Duration"
            value={formatDuration(stage.startedAt, stage.completedAt)}
          />
        </div>

        {stage.isValidationStage && stage.validationResult ? (
          <ValidationPanelWidget validation={stage.validationResult} />
        ) : null}

        {stage.output && !stage.isValidationStage ? (
          <div>
            <p className="editorial-kicker mb-2 text-ink-mute">Output</p>
            <JsonViewer value={stage.output} />
          </div>
        ) : null}

        {stage.error ? (
          <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 font-mono text-[12px] text-danger">
            {stage.error}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function KV({ label, value }) {
  return (
    <div className="rounded-2xl border border-hairline bg-canvas/35 px-3 py-3">
      <p className="editorial-kicker text-ink-mute">{label}</p>
      <p className="mt-2 font-mono text-[14px] text-ink">{value}</p>
    </div>
  );
}
