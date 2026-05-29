import { Link } from "react-router-dom";

/**
 * Global review-queue indicator — visible from every screen.
 */
export default function ReviewQueueBadge({ count, className = "" }) {
  if (!count) return null;

  return (
    <Link
      to="/app/pipelines?tab=review"
      className={`inline-flex items-center gap-2 rounded-full border border-danger/40 bg-danger/10 px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-danger transition-colors hover:bg-danger/15 ${className}`}
      title={`${count} pipeline${count === 1 ? "" : "s"} need review`}
    >
      <span className="flex size-5 items-center justify-center rounded-full bg-danger text-[11px] font-semibold text-canvas">
        {count > 9 ? "9+" : count}
      </span>
      Review queue
    </Link>
  );
}
