import { Link } from "react-router-dom";
import StatusPill from "../../app/components/StatusPill";
import Spinner from "../../app/components/Spinner";
import { useOrgPathBuilder } from "../../shared/providers/OrgRouteProvider";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import { formatStageLabel } from "../../shared/lib/format";

export default function RecentPipelinesWidget({ items, loading }) {
  const orgPath = useOrgPathBuilder();
  return (
    <Panel>
      <PanelHeader
        kicker="Recent activity"
        title="Pipelines"
        right={
          <Link
            to={orgPath("pipelines")}
            className="editorial-kicker text-ink-dim transition-colors hover:text-ink"
          >
            View all →
          </Link>
        }
      />
      <div className="divide-y divide-hairline">
        {loading && items.length === 0 ? (
          <div className="px-5 py-8">
            <Spinner label="Loading pipelines" />
          </div>
        ) : (
          items.slice(0, 6).map((item) => (
            <Link
              key={item.id}
              to={`/app/pipelines/${item.id}`}
              className="group flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-canvas/35"
            >
              <div className="min-w-0">
                <span className="editorial-kicker text-ink-mute">{item.jiraKey}</span>
                <p className="mt-2 truncate text-[15px] text-ink transition-colors group-hover:text-indigo">
                  {item.summary}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden max-w-[12rem] text-right font-mono text-[11px] text-ink-mute md:inline">
                  {formatStageLabel(item.currentStage)}
                </span>
                <StatusPill status={item.status} />
              </div>
            </Link>
          ))
        )}
      </div>
    </Panel>
  );
}
