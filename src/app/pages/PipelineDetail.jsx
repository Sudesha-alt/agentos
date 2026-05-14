import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { usePipelineDetail } from "../../entities/pipeline";
import { usePipelineAudit } from "../../entities/audit";
import { useRunPipeline } from "../../features/run-pipeline/model/useRunPipeline";
import StageTimeline from "../components/StageTimeline";
import Spinner from "../components/Spinner";
import { EASE } from "../../lib/motion";
import StatusPill from "../components/StatusPill";
import StagePanelWidget from "../../widgets/stage-panel/StagePanelWidget";
import AuditFeedWidget from "../../widgets/audit-feed/AuditFeedWidget";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";

export default function PipelineDetail() {
  const { id } = useParams();
  const { item, loading } = usePipelineDetail(id, { pollMs: 6000 });
  const { items: auditItems } = usePipelineAudit(id, { pollMs: 9000 });
  const { run, pending: rerunning } = useRunPipeline();

  const stages = useMemo(() => item?.stages ?? [], [item]);
  const [selectedStageId, setSelectedStageId] = useState(null);

  const effectiveStageId = useMemo(() => {
    if (selectedStageId && stages.some((s) => s.id === selectedStageId)) {
      return selectedStageId;
    }
    const auto =
      stages.find(
        (s) => s.status === "RUNNING" || s.status === "AWAITING_HUMAN"
      ) ??
      stages.find((s) => s.status === "COMPLETED") ??
      stages[0];
    return auto?.id ?? null;
  }, [selectedStageId, stages]);

  if (loading && !item) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner label="Loading pipeline" />
      </div>
    );
  }
  if (!item) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-hairline bg-surface/30 px-5 py-10 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          // not found
        </p>
        <h2 className="mt-2 text-lg text-ink">Pipeline doesn't exist</h2>
        <Link
          to="/app/pipelines"
          className="mt-5 inline-flex items-center gap-2 text-sm text-ink-dim hover:text-ink transition-colors"
        >
          ← Back to pipelines
        </Link>
      </div>
    );
  }

  const selected = stages.find((s) => s.id === effectiveStageId) ?? stages[0];

  return (
    <div className="mx-auto w-full max-w-[82rem] space-y-6">
      <header className="flex flex-col gap-4">
        <Link
          to="/app/pipelines"
          className="editorial-kicker text-ink-mute transition-colors hover:text-ink"
        >
          ← pipelines
        </Link>
        <PageIntro
          kicker={item.jiraKey}
          title={item.summary}
          body="A single operational record of every stage, validation result, and human checkpoint in the orchestration flow."
          right={
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill status={item.status} />
              {item.status === "PAUSED" ? (
                <Link
                  to={`/app/pipelines/${item.id}/override`}
                  className="btn-trace inline-flex items-center gap-2 rounded-full border border-indigo/50 bg-indigo/10 px-4 py-2 text-[13px] text-ink transition-all hover:shadow-glow-indigo"
                >
                  <span className="size-1.5 rounded-full bg-warning shadow-[0_0_8px_2px_rgba(245,158,11,0.6)]" />
                  Review and override
                </Link>
              ) : null}
              <Link
                to={`/app/pipelines/${item.id}/override`}
                className="rounded-full border border-hairline bg-surface/40 px-4 py-2 text-[13px] text-ink-dim transition-colors hover:border-hairline-strong hover:text-ink"
              >
                Open override workspace
              </Link>
              <button
                type="button"
                onClick={() => run(item.ticketId)}
                disabled={rerunning}
                className="rounded-full border border-hairline bg-surface/40 px-4 py-2 text-[13px] text-ink-dim transition-colors hover:border-hairline-strong hover:text-ink disabled:opacity-50"
              >
                {rerunning ? "Re-running…" : "Re-run"}
              </button>
            </div>
          }
        />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,1.2fr)]">
        <Panel>
          <PanelHeader
            kicker="Trace"
            title="Stages"
            body="The sequence is fixed; the selected panel shows the exact output or validation decision at that checkpoint."
          />
          <div className="px-3 py-3">
            <StageTimeline
              stages={stages}
              activeStageId={selected?.id}
              onSelect={setSelectedStageId}
            />
          </div>
        </Panel>

        <div className="space-y-6">
          <motion.div
            key={selected?.id ?? "none"}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <StagePanelWidget stage={selected} />
          </motion.div>

          <AuditFeedWidget items={auditItems.length ? auditItems : item.auditLogs} />
        </div>
      </div>
    </div>
  );
}
