import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { usePipelineDetail } from "../../entities/pipeline";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";
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
  const prd = prdStage?.output?.prd ?? prdStage?.output;
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

  return (
    <div className="mx-auto flex w-full max-w-[90rem] gap-6">
      <aside className="hidden w-56 shrink-0 lg:block">
        <nav className="sticky top-24 space-y-1">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={`block w-full rounded-lg px-3 py-2 text-left text-[13px] ${
                activeSection === section.id
                  ? "bg-indigo/10 text-ink"
                  : "text-ink-dim hover:text-ink"
              }`}
            >
              {section.label}
            </button>
          ))}
        </nav>
        <div
          className="mt-8 flex size-20 items-center justify-center rounded-full border-4 font-display text-xl"
          style={{ borderColor: band.color }}
        >
          {(score <= 1 ? score * 100 : score).toFixed(0)}%
        </div>
        <p className="mt-2 font-mono text-[10px] text-ink-mute">PRD gate score</p>
      </aside>

      <div className="min-w-0 flex-1 space-y-6">
        <Link
          to={`/app/pipelines?selected=${id}`}
          className="editorial-kicker text-ink-mute hover:text-ink"
        >
          ← pipeline explorer
        </Link>
        <PageIntro
          kicker={item?.jiraKey ?? "PRD"}
          title={prd?.title ?? item?.summary ?? "Product requirements"}
          body="Document-style PRD with inline editing and gate feedback."
        />

        <Panel>
          <PanelHeader kicker="Document" title={SECTIONS.find((s) => s.id === activeSection)?.label} />
          <div className="prose prose-invert max-w-none px-6 py-6">
            <PrdSection active={activeSection} prd={prd} />
          </div>
        </Panel>

        <aside className="rounded-xl border border-hairline bg-surface/30 p-5 lg:hidden">
          <p className="font-mono text-[10px] uppercase text-ink-mute">Actions</p>
          <div className="mt-4 flex flex-col gap-2">
            <button type="button" className="btn-trace rounded-full bg-indigo/15 px-4 py-2 text-[13px]">
              Approve and continue
            </button>
            <button type="button" className="rounded-full border border-hairline px-4 py-2 text-[13px]">
              Request revisions
            </button>
          </div>
        </aside>
      </div>

      <aside className="hidden w-64 shrink-0 xl:block">
        <div className="sticky top-24 rounded-xl border border-hairline bg-surface/35 p-5">
          <p className="font-mono text-[10px] uppercase text-ink-mute">Gate</p>
          <p className="mt-2 font-display text-3xl" style={{ color: band.color }}>
            {(score <= 1 ? score * 100 : score).toFixed(0)}%
          </p>
          <p className="mt-1 text-[12px] text-ink-dim">{band.label}</p>
          <div className="mt-6 space-y-2">
            <button type="button" className="btn-trace w-full rounded-full bg-indigo/15 py-2 text-[13px]">
              Approve and continue
            </button>
            <button type="button" className="w-full rounded-full border border-hairline py-2 text-[13px]">
              Request revisions
            </button>
            <button type="button" className="w-full rounded-full border border-warning/40 py-2 text-[13px] text-warning">
              Override and force
            </button>
          </div>
        </div>
      </aside>
    </div>
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
    return <p className="text-ink-dim">PRD output will appear after the Product Agent completes.</p>;
  }

  if (active === "problem") {
    return <p className="text-ink leading-relaxed">{prd.problemStatement ?? "—"}</p>;
  }
  if (active === "solution") {
    return <p className="text-ink leading-relaxed">{prd.proposedSolution ?? "—"}</p>;
  }
  if (active === "stories") {
    const stories = prd.userStories ?? [];
    return (
      <ul className="space-y-4">
        {stories.map((story) => (
          <li key={story.id ?? story.story} className="border-l-2 border-indigo/40 pl-4">
            <p className="text-ink">{story.story}</p>
            <ul className="mt-2 space-y-1 text-[13px] text-ink-dim">
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
      <div className="space-y-3">
        {endpoints.map((ep) => (
          <div key={ep.path} className="rounded-lg border border-hairline bg-canvas/40 p-4 font-mono text-[12px]">
            <span className="rounded bg-indigo/20 px-2 py-0.5 text-indigo">{ep.method}</span>{" "}
            {ep.path}
            <p className="mt-2 font-sans text-[13px] text-ink-dim">{ep.description}</p>
          </div>
        ))}
      </div>
    );
  }
  if (active === "questions") {
    return (
      <ul className="space-y-3">
        {(prd.openQuestions ?? []).map((q) => (
          <li key={q.question} className="rounded-lg border border-hairline p-4">
            <p className="text-ink">{q.question}</p>
            <p className="mt-2 text-[12px] text-ink-dim">
              Default assumption: {q.defaultAssumption ?? q.assumption ?? "—"}
            </p>
          </li>
        ))}
      </ul>
    );
  }
  return null;
}
