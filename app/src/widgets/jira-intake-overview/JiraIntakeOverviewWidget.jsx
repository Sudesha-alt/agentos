import { Link } from "react-router-dom";
import { useJiraIntakeSummary } from "../../entities/jira-intake";
import LabelPill from "../../app/components/LabelPill";
import Spinner from "../../app/components/Spinner";
import { Panel, PanelHeader } from "../../shared/ui/Panel";

export default function JiraIntakeOverviewWidget({ embedded = false }) {
  const { data, error, loading } = useJiraIntakeSummary({ pollMs: 12000 });

  const active = data?.stats?.active ?? 0;
  const inactive = data?.stats?.inactive ?? 0;
  const lastKey = data?.last?.issueKey;

  const body = (
      <div className={embedded ? "space-y-4" : "space-y-4 px-5 py-4 sm:px-6"}>
        {loading && !data ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : error ? (
          <p className="text-[13px] leading-relaxed text-ink-dim">
            Intake API unreachable. Start the server with{" "}
            <code className="font-mono text-[12px] text-ink">npm run dev</code> in{" "}
            <code className="font-mono text-[12px] text-ink">server/</code> and set{" "}
            <code className="font-mono text-[12px] text-ink">JIRA_*</code> in{" "}
            <code className="font-mono text-[12px] text-ink">.env</code>.
          </p>
        ) : (
          <>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-dim">
              {lastKey
                ? `Last webhook · ${lastKey}`
                : active > 0
                  ? "Queue loaded from intake database"
                  : "Waiting for Jira webhooks → /webhooks/jira/ai-worker"}
            </p>
            <div className="flex flex-wrap gap-4 text-[13px]">
              <Link
                to="/app/jira"
                className="text-ink-dim transition-colors hover:text-indigo"
              >
                Open AI Worker queue →
              </Link>
              <Link
                to="/app/jira-search"
                className="text-ink-dim transition-colors hover:text-indigo"
              >
                Search board →
              </Link>
            </div>
          </>
        )}
      </div>
  );

  if (embedded) {
    return (
      <div className="rounded-[1rem] border border-hairline bg-surface/30 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
            Jira intake
          </p>
          <div className="flex flex-wrap gap-2">
            <LabelPill label={`${active} active`} tone={active > 0 ? "success" : "muted"} />
            {inactive > 0 ? (
              <LabelPill label={`${inactive} inactive`} tone="muted" />
            ) : null}
          </div>
        </div>
        {body}
      </div>
    );
  }

  return (
    <Panel>
      <PanelHeader
        kicker="Jira intake"
        title="AI Worker queue"
        body="Live tickets from your Jira board column, separate from the agent pipeline ledger."
        right={
          <div className="flex flex-wrap gap-2">
            <LabelPill label={`${active} active`} tone={active > 0 ? "success" : "muted"} />
            {inactive > 0 ? (
              <LabelPill label={`${inactive} inactive`} tone="muted" />
            ) : null}
          </div>
        }
      />
      {body}
    </Panel>
  );
}
