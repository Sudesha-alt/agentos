import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { usePipelineArtifacts, usePipelineDetail } from "../../entities/pipeline";
import { usePipelineAudit } from "../../entities/audit";
import { useRunPipeline } from "../../features/run-pipeline/model/useRunPipeline";
import StageTimeline from "../components/StageTimeline";
import Spinner from "../components/Spinner";
import { EASE } from "../../lib/motion";
import StatusPill from "../components/StatusPill";
import StagePanelWidget from "../../widgets/stage-panel/StagePanelWidget";
import AuditFeedWidget from "../../widgets/audit-feed/AuditFeedWidget";
import TicketActivityWidget from "../../widgets/ticket-activity/TicketActivityWidget";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";
import { useOrg } from "../../shared/providers/OrgRouteProvider";

export default function PipelineDetail() {
  const { orgPath } = useOrg();
  const { id } = useParams();
  const { item, loading } = usePipelineDetail(id, { pollMs: 6000 });
  const { artifacts } = usePipelineArtifacts(id, { pollMs: 8000 });
  const { items: auditItems } = usePipelineAudit(id, { pollMs: 9000 });
  const { run, pending: rerunning } = useRunPipeline();

  const stages = useMemo(() => item?.stages ?? [], [item]);
  const [selectedStageId, setSelectedStageId] = useState(null);
  const [mainTab, setMainTab] = useState("stages");

  const productPackage = useMemo(() => {
    const productStage = stages.find((s) => s.stage === "PRODUCT_AGENT");
    const output = productStage?.outputJson ?? productStage?.output;
    if (!output || typeof output !== "object") return null;
    if (output.source !== "pm_agents") return null;
    return {
      prdTitle: output.generatedPrd?.title ?? output.prd?.title ?? null,
      systemDesign: output.systemDesign ?? null,
      taskBreakdown: output.taskBreakdown ?? null,
    };
  }, [stages]);

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
          to={orgPath("pipelines")}
          className="mt-5 inline-flex items-center gap-2 text-sm text-ink-dim hover:text-ink transition-colors"
        >
          ← Back to pipelines
        </Link>
      </div>
    );
  }

  const selected = stages.find((s) => s.id === effectiveStageId) ?? stages[0];

  return (
    <AnimatedAppPage wide>
      <header className="flex flex-col gap-3">
        <Link
          to={orgPath("pipelines")}
          className="type-kicker transition-colors hover:text-app-ink"
        >
          ← pipelines
        </Link>
        <PageIntro
          kicker={item.jiraKey}
          title={item.summary}
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

      {productPackage ? (
        <Panel>
          <PanelHeader
            kicker="Virin"
            title="Product package (read-only)"
          />
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-3 sm:px-6">
            <div className="rounded-app-sm border border-hairline bg-surface/30 p-4">
              <p className="type-kicker">PRD</p>
              <p className="mt-1 text-[13px] text-ink">{productPackage.prdTitle ?? "—"}</p>
            </div>
            <div className="rounded-app-sm border border-hairline bg-surface/30 p-4">
              <p className="type-kicker">System design</p>
              <p className="mt-1 text-[13px] text-ink-dim">
                {productPackage.systemDesign?.fileList?.length
                  ? `${productPackage.systemDesign.fileList.length} files`
                  : "Not generated"}
              </p>
            </div>
            <div className="rounded-app-sm border border-hairline bg-surface/30 p-4">
              <p className="type-kicker">Tasks</p>
              <p className="mt-1 text-[13px] text-ink-dim">
                {Array.isArray(productPackage.taskBreakdown)
                  ? `${productPackage.taskBreakdown.length} tasks`
                  : productPackage.taskBreakdown?.tasks?.length
                    ? `${productPackage.taskBreakdown.tasks.length} tasks`
                    : "Not generated"}
              </p>
            </div>
          </div>
        </Panel>
      ) : null}

      <div className="flex gap-2">
        {[
          { id: "stages", label: "Stages" },
          { id: "artifacts", label: "Artifacts (Eng/QA)" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMainTab(tab.id)}
            className={`rounded-full px-4 py-2 text-[13px] transition ${
              mainTab === tab.id
                ? "border border-indigo/40 bg-indigo/10 text-ink"
                : "border border-hairline text-ink-dim hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mainTab === "artifacts" ? (
        <Panel>
          <PanelHeader
            kicker="MetaGPT"
            title="Pipeline artifacts"
          />
          {artifacts.length === 0 ? (
            <p className="px-5 py-8 text-[13px] text-ink-dim sm:px-6">
              No engineering or QA artifacts yet — they appear after the implementation and QA stages complete.
            </p>
          ) : (
            <ul className="divide-y divide-hairline">
              {artifacts.map((artifact) => (
                <li key={artifact.id} className="px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-indigo">{artifact.type}</span>
                    <span className="text-[14px] font-medium text-ink">{artifact.title}</span>
                    <span className="text-[11px] text-ink-mute">{artifact.producer}</span>
                  </div>
                  <pre className="mt-3 max-h-48 overflow-auto rounded-app-sm border border-hairline bg-surface/30 p-3 text-[11px] text-ink-dim">
                    {JSON.stringify(artifact.payload, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,1.2fr)]">
        <Panel>
          <PanelHeader
            kicker="Trace"
            title="Stages"
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

          <TicketActivityWidget
            stages={stages}
            auditLogs={auditItems.length ? auditItems : item.auditLogs}
            currentStage={item.currentStage}
          />

          <AuditFeedWidget items={auditItems.length ? auditItems : item.auditLogs} />
        </div>
      </div>
      )}
    </AnimatedAppPage>
  );
}
