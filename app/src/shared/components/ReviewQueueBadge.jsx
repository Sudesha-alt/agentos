import { Link } from "react-router-dom";
import { useOrgPathBuilder } from "../providers/OrgRouteProvider";

/**
 * Global review-queue indicator — visible from every screen.
 */
export default function ReviewQueueBadge({ count, className = "" }) {
  const orgPath = useOrgPathBuilder();
  if (!count) return null;

  return (
    <Link
      to={`${orgPath("pipelines")}?tab=review`}
      className={`inline-flex items-center gap-2 rounded-full border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger/15 ${className}`}
      title={`${count} pipeline${count === 1 ? "" : "s"} need review`}
    >
      <span className="flex size-5 items-center justify-center rounded-full bg-danger text-[11px] font-semibold text-white">
        {count > 9 ? "9+" : count}
      </span>
      Review queue
    </Link>
  );
}
