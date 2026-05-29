import { STAGE_ORDER } from "../config/app";
import { formatStageLabel } from "../lib/format";

const TONE = {
  completed: "bg-success shadow-[0_0_8px_2px_rgba(34,197,94,0.45)]",
  active: "bg-indigo animate-pulse shadow-[0_0_10px_3px_rgba(99,102,241,0.55)]",
  paused: "bg-warning animate-pulse shadow-[0_0_10px_3px_rgba(245,158,11,0.5)]",
  failed: "bg-danger shadow-[0_0_8px_2px_rgba(239,68,68,0.45)]",
  pending: "border border-hairline bg-transparent",
};

/**
 * Horizontal stage dots — readable in under one second.
 */
export default function StageRail({
  currentStage,
  status,
  compact = false,
  className = "",
}) {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);
  const isFailed = status === "FAILED";
  const isPaused = status === "PAUSED";

  return (
    <div
      className={`flex items-center gap-0 ${className}`}
      role="img"
      aria-label={`Pipeline at ${formatStageLabel(currentStage)}`}
    >
      {STAGE_ORDER.map((stage, index) => {
        let tone = TONE.pending;
        if (isFailed && index === currentIndex) tone = TONE.failed;
        else if (index < currentIndex) tone = TONE.completed;
        else if (index === currentIndex) {
          if (isPaused) tone = TONE.paused;
          else if (isFailed) tone = TONE.failed;
          else tone = TONE.active;
        }

        return (
          <div key={stage} className="flex items-center">
            <span
              className={`block rounded-full ${compact ? "size-2" : "size-2.5"} ${tone}`}
              title={formatStageLabel(stage)}
            />
            {index < STAGE_ORDER.length - 1 ? (
              <span
                className={`${compact ? "w-2" : "w-3"} h-px ${
                  index < currentIndex ? "bg-success/60" : "bg-hairline"
                }`}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
