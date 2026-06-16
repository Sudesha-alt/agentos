import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { usePipelineDetail } from "../../entities/pipeline";
import { AGENT_NAMES } from "../../shared/config/app";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";
import Spinner from "../components/Spinner";

const SECTIONS = [
  { id: "problem", label: "Problem Statement" },
  { id: "solution", label: "Proposed Solution" },
  { id: "stories", label: "User Stories" },
  { id: "technical", label: "Technical Requirements" },
  { id: "questions", label: "Open Questions" },
];

export default function PrdViewer() {
  const { id } = useParams();
  const { item, loading } = usePipelineDetail(id);
  const [activeSection, setActiveSection] = useState("problem");

  const prdStage = item?.stages?.find((s) => s.stage === "PRODUCT_AGENT");
  const stageOutput = prdStage?.output ?? {};
  const prd =
    stageOutput.generatedPrd ??
    stageOutput.discovery?.generatedPrd ??
    stageOutput.prd ??
    stageOutput;
  const gate = item?.stages?.find((s) => s.stage === "PRD_VALIDATION");
  const score =
    gate?.validationResult?.score ??
    prd?.confidenceScore ??
    prdStage?.confidenceScore ??
    0.72;

  if (loading && !item) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner label="Loading PRD" />
      </div>
    );
  }

  const band = prdGateBand(score);
  const scorePct = (score <= 1 ? score * 100 : score).toFixed(0);

  return (
    <AnimatedAppPage wide className="max-w-[90rem]">
      <div className="flex w-full gap-5">
        <aside className="hidden w-52 shrink-0 lg:block">
          <nav className="sticky top-24 space-y-0.5">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`block w-full rounded-app-sm px-2.5 py-1.5 text-left text-[13px] ${
                  activeSection === section.id
                    ? "bg-indigo/10 text-app-ink"
                    : "text-app-ink-dim hover:text-app-ink"
                }`}
              >
                {section.label}
              </button>
            ))}
          </nav>
          <div
            className="type-metric mt-6 flex size-16 items-center justify-center rounded-full border-[3px] text-lg"
            style={{ borderColor: band.color }}
          >
            {scorePct}%
          </div>
          <p className="type-kicker mt-1.5">PRD gate score</p>
        </aside>

        <div className="min-w-0 flex-1 space-y-5">
          <Link
            to={`/app/pipelines?selected=${id}`}
            className="type-kicker hover:text-app-ink"
          >
            ← pipeline explorer
          </Link>
          <PageIntro
            kicker={item?.jiraKey ?? "PRD"}
            title={prd?.title ?? item?.summary ?? "Product requirements"}
          />

          <Panel>
            <PanelHeader kicker="Document" title={SECTIONS.find((s) => s.id === activeSection)?.label} />
            <div className="max-w-none px-5 py-5 sm:px-6">
              <PrdSection active={activeSection} prd={prd} />
            </div>
          </Panel>

          <aside className="rounded-app border border-app-border bg-app-surface-muted/40 p-4 lg:hidden">
            <p className="type-kicker">Actions</p>
            <div className="mt-3 flex flex-col gap-2">
              <button type="button" className="app-btn-primary text-[13px]">
                Approve and continue
              </button>
              <button type="button" className="rounded-full border border-app-border px-4 py-2 text-[13px]">
                Request revisions
              </button>
            </div>
          </aside>
        </div>

        <aside className="hidden w-56 shrink-0 xl:block">
          <div className="sticky top-24 rounded-app border border-app-border bg-app-surface-muted/40 p-4">
            <p className="type-kicker">Gate</p>
            <p className="type-metric mt-1.5" style={{ color: band.color }}>
              {scorePct}%
            </p>
            <p className="mt-0.5 text-[12px] text-app-ink-dim">{band.label}</p>
            <div className="mt-5 space-y-2">
              <button type="button" className="app-btn-primary w-full text-[13px]">
                Approve and continue
              </button>
              <button type="button" className="w-full rounded-full border border-app-border py-2 text-[13px]">
                Request revisions
              </button>
              <button type="button" className="w-full rounded-full border border-warning/40 py-2 text-[13px] text-warning">
                Override and force
              </button>
            </div>
          </div>
        </aside>
      </div>
    </AnimatedAppPage>
  );
}

function prdGateBand(score) {
  const pct = score <= 1 ? score * 100 : score;
  if (pct >= 80) return { color: "#22c55e", label: "Ready to ship" };
  if (pct >= 70) return { color: "#f59e0b", label: "Review recommended" };
  return { color: "#ef4444", label: "Below gate threshold" };
}

function PrdSection({ active, prd }) {
  if (!prd || typeof prd !== "object") {
    return <p className="text-app-ink-dim">PRD output will appear after {AGENT_NAMES.VIRIN} completes.</p>;
  }

  if (active === "problem") {
    return <p className="type-body text-app-ink">{prd.problemStatement ?? "—"}</p>;
  }
  if (active === "solution") {
    return <p className="type-body text-app-ink">{prd.proposedSolution ?? "—"}</p>;
  }
  if (active === "stories") {
    const stories = prd.userStories ?? [];
    return (
      <ul className="space-y-3">
        {stories.map((story) => (
          <li key={story.id ?? story.story} className="border-l-2 border-indigo/40 pl-3">
            <p className="text-app-ink">{story.story}</p>
            <ul className="mt-1.5 space-y-1 text-[13px] text-app-ink-dim">
              {(story.acceptanceCriteria ?? []).map((ac) => (
                <li key={ac} className="flex gap-2">
                  <span className="text-success">✓</span>
                  {ac}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    );
  }
  if (active === "technical") {
    const endpoints = prd.technicalRequirements?.endpoints ?? [];
    return (
      <div className="space-y-2">
        {endpoints.map((ep) => (
          <div key={ep.path} className="rounded-app-sm border border-app-border bg-app-surface-muted/40 p-3 font-mono text-[11px]">
            <span className="rounded bg-indigo/20 px-1.5 py-0.5 text-indigo">{ep.method}</span>{" "}
            {ep.path}
            <p className="mt-1.5 font-sans text-[13px] text-app-ink-dim">{ep.description}</p>
          </div>
        ))}
      </div>
    );
  }
  if (active === "questions") {
    return (
      <ul className="space-y-2">
        {(prd.openQuestions ?? []).map((q) => (
          <li key={q.question} className="rounded-app-sm border border-app-border p-3">
            <p className="text-app-ink">{q.question}</p>
            <p className="mt-1.5 text-[12px] text-app-ink-dim">
              Default assumption: {q.defaultAssumption ?? q.assumption ?? "—"}
            </p>
          </li>
        ))}
      </ul>
    );
  }
  return null;
}
