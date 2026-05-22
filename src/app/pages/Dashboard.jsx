import { Link } from "react-router-dom";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { usePipelineList } from "../../entities/pipeline";
import DashboardOverviewWidget from "../../widgets/dashboard-overview/DashboardOverviewWidget";
import JiraIntakeOverviewWidget from "../../widgets/jira-intake-overview/JiraIntakeOverviewWidget";
import RecentPipelinesWidget from "../../widgets/recent-pipelines/RecentPipelinesWidget";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";
import { fadeUp, stagger, viewportOnce } from "../../lib/motion";

export default function Dashboard() {
  const { items, loading } = usePipelineList(undefined, { pollMs: 8000 });

  const summary = useMemo(() => {
    return {
      running: items.filter((item) => item.status === "RUNNING").length,
      paused: items.filter((item) => item.status === "PAUSED").length,
      completed: items.filter((item) => item.status === "COMPLETED").length,
      failed: items.filter((item) => item.status === "FAILED").length,
    };
  }, [items]);

  return (
    <div className="mx-auto w-full max-w-[82rem] space-y-8">
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
        variants={stagger()}
        className="flex flex-col gap-3"
      >
        <motion.div variants={fadeUp}>
          <PageIntro
            kicker="Workspace overview"
            title={`${greeting()}. ${
              items.length === 0
                ? "Quiet day on the pipeline."
                : `Tracking ${items.length} pipelines.`
            }`}
            body="A document-style view of the current operating state across Product, Engineering, and QA handoffs."
          />
        </motion.div>
      </motion.div>

      <DashboardOverviewWidget
        running={summary.running}
        paused={summary.paused}
        completed={summary.completed}
        failed={summary.failed}
      />

      <JiraIntakeOverviewWidget />

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <RecentPipelinesWidget items={items} loading={loading} />

        <Panel>
          <PanelHeader
            kicker="Telemetry"
            title="Cost and confidence"
            body="Signals that explain whether the automation is producing trustworthy requirements, plans, and tests."
          />
          <div className="space-y-5 px-5 py-4 sm:px-6">
            <Telemetry label="Avg pipeline cost" value="$0.17" detail="last 24h" trend="-12%" />
            <Telemetry label="Avg PRD confidence" value="0.81" detail="claude-sonnet-4" trend="+0.03" />
            <Telemetry label="Avg time-to-spec" value="41s" detail="median wall clock" />
            <Telemetry label="Gates auto-passed" value="78%" detail="last 100 runs" />
            <Link
              to="/app/pipelines"
              className="inline-flex text-[13px] text-ink-dim transition-colors hover:text-ink"
            >
              Review every active run →
            </Link>
          </div>
        </Panel>
      </section>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function Telemetry({ label, value, detail, trend }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-mute">
          {label}
        </p>
        <p className="mt-1 text-sm text-ink-dim">{detail}</p>
      </div>
      <div className="text-right">
        <p className="font-mono text-xl text-ink">{value}</p>
        {trend && (
          <p
            className={`font-mono text-[10.5px] ${
              trend.startsWith("-") ? "text-success" : "text-warning"
            }`}
          >
            {trend}
          </p>
        )}
      </div>
    </div>
  );
}
