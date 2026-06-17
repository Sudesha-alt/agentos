import { Link } from "react-router-dom";
import {
  usePipelineIntakeTickets,
  usePipelineJiraSetup,
} from "../../entities/pipeline-jira";
import LabelPill from "../../app/components/LabelPill";
import Spinner from "../../app/components/Spinner";
import { PipelineQueueSummary } from "../pipeline-queue/PipelineQueuePanel";
import { useOrgPathBuilder } from "../../shared/providers/OrgRouteProvider";
import { Panel, PanelHeader } from "../../shared/ui/Panel";

export default function JiraIntakeOverviewWidget({ embedded = false }) {
  const orgPath = useOrgPathBuilder();
  const { data: setup, error, loading } = usePipelineJiraSetup({ pollMs: 5000 });
  const intakeReady = Boolean(setup?.connected && setup?.intake?.aiWorkerColumnName);
  const { data: intake } = usePipelineIntakeTickets(intakeReady, { pollMs: 12000 });

  const count = intake?.items?.length ?? 0;
  const column = setup?.intake?.aiWorkerColumnName;
  const queue = setup?.queue;
  const running = queue?.activeJiraKey;

  const body = (
    <div className={embedded ? "space-y-4" : "space-y-4 px-5 py-4 sm:px-6"}>
      {loading && !setup ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : error ? (
        <p className="text-[13px] leading-relaxed text-ink-dim">
          Jira API unreachable. Connect pipeline Jira in Settings and set{" "}
          <code className="font-mono text-[12px] text-ink">PIPELINE_JIRA_*</code> on the server.
        </p>
      ) : (
        <>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-dim">
            {intakeReady
              ? `${count} in Jira column "${column}"`
              : setup?.connected
                ? "Pick the AI Worker intake column on the Jira page"
                : "Connect Jira to enable AI Worker intake"}
          </p>
          <PipelineQueueSummary setup={setup} />
          <div className="flex flex-wrap gap-4 text-[13px]">
            <Link to={orgPath("settings", "integrations", "jira")} className="text-ink-dim transition-colors hover:text-indigo">
              Jira pipeline setup →
            </Link>
            <Link
              to={orgPath("jira-search")}
              className="text-ink-dim transition-colors hover:text-indigo"
            >
              Search board →
            </Link>
          </div>
        </>
      )}
    </div>
  );

  const queueBadge = running
    ? `Running ${running}`
    : (queue?.queueLength ?? 0) > 0
      ? `${queue.queueLength} queued`
      : `${count} in AI Worker`;

  if (embedded) {
    return (
      <div className="min-w-0 overflow-hidden rounded-app-sm border border-app-border bg-app-surface-muted/60 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-app-ink-mute">
            Jira pipeline
          </p>
          <LabelPill
            label={queueBadge}
            tone={running ? "indigo" : (queue?.queueLength ?? 0) > 0 ? "warning" : count > 0 ? "success" : "muted"}
          />
        </div>
        {body}
      </div>
    );
  }

  return (
    <Panel>
      <PanelHeader
        kicker="Jira pipeline"
        title="AI Worker intake"
        right={
          <LabelPill
            label={queueBadge}
            tone={running ? "indigo" : (queue?.queueLength ?? 0) > 0 ? "warning" : count > 0 ? "success" : "muted"}
          />
        }
      />
      {body}
    </Panel>
  );
}
