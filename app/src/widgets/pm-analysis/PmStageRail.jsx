import { PM_STAGE_ORDER } from "../../entities/pm-agents";
import { PM_STAGE_LABELS } from "../../entities/pm-agents";

const TONE = {
  completed: "bg-success shadow-[0_0_6px_1px_rgba(34,197,94,0.4)]",
  active: "bg-indigo animate-pulse shadow-[0_0_8px_2px_rgba(99,102,241,0.5)]",
  failed: "bg-danger shadow-[0_0_6px_1px_rgba(239,68,68,0.4)]",
  pending: "border border-hairline bg-transparent",
};

/**
 * Compact 8-stage rail for PM agent pipeline cards.
 */
export default function PmStageRail({
  currentStage,
  status,
  stageMeta = [],
  compact = false,
  className = "",
}) {
  const currentIndex = currentStage ? PM_STAGE_ORDER.indexOf(currentStage) : -1;
  const isFailed = status === "FAILED";
  const completedCount =
    currentIndex < 0 && status === "COMPLETED"
      ? PM_STAGE_ORDER.length
      : Math.max(0, currentIndex);

  return (
    <div
      className={`flex items-center gap-0 ${className}`}
      role="img"
      aria-label={`PM pipeline at ${currentStage ? PM_STAGE_LABELS[currentStage] : "complete"}`}
    >
      {PM_STAGE_ORDER.map((stage, index) => {
        const done =
          stageMeta.some((m) => m.stage === stage && m.status === "COMPLETED") ||
          index < completedCount;
        const running = currentStage === stage && status === "RUNNING";
        const failed =
          isFailed &&
          (stageMeta.some((m) => m.stage === stage && m.status === "FAILED") ||
            index === currentIndex);

        let tone = TONE.pending;
        if (failed) tone = TONE.failed;
        else if (done) tone = TONE.completed;
        else if (running) tone = TONE.active;

        return (
          <div key={stage} className="flex items-center">
            <span
              className={`block rounded-full ${compact ? "size-2" : "size-2.5"} ${tone}`}
              title={PM_STAGE_LABELS[stage]}
            />
            {index < PM_STAGE_ORDER.length - 1 ? (
              <span
                className={`${compact ? "w-1.5" : "w-2"} h-px ${
                  done ? "bg-success/60" : "bg-hairline"
                }`}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
