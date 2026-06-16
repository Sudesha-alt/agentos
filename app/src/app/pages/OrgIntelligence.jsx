import { useState } from "react";
import { Link } from "react-router-dom";
import { useOrgIntelligence } from "../../entities/org-intelligence";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";
import Spinner from "../components/Spinner";

const SOURCE_LABELS = {
  PRD: "Product",
  ENGINEERING: "Engineering",
  QA_FAILURE: "QA",
  CANARY: "Canary",
  OVERRIDE: "Override",
  PIPELINE_COMPLETE: "Complete",
  COMPANY_PROFILE: "Company profile",
};

export default function OrgIntelligence() {
  const [sourceFilter, setSourceFilter] = useState("");
  const { data, loading } = useOrgIntelligence({
    sourceType: sourceFilter || undefined,
    limit: 100,
    pollMs: 30_000,
  });

  const items = data?.items ?? [];

  return (
    <AnimatedAppPage wide>
      <PageIntro
        kicker="Learning"
        title="Organizational intelligence"
      />

      <div className="flex flex-wrap gap-2">
        <FilterChip active={!sourceFilter} onClick={() => setSourceFilter("")}>
          All
        </FilterChip>
        {Object.entries(SOURCE_LABELS).map(([id, label]) => (
          <FilterChip key={id} active={sourceFilter === id} onClick={() => setSourceFilter(id)}>
            {label}
          </FilterChip>
        ))}
      </div>

      <Panel>
        <PanelHeader kicker="Timeline" title="Recent learnings" />
        {loading && !items.length ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner label="Loading learnings" />
          </div>
        ) : items.length === 0 ? (
          <p className="px-5 py-8 text-[13px] text-app-ink-dim">
            No organizational intelligence records yet. Complete a pipeline run to start learning.
          </p>
        ) : (
          <ul className="divide-y divide-app-border">
            {items.map((item) => (
              <li key={item.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-indigo/30 bg-indigo/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo">
                    {SOURCE_LABELS[item.sourceType] ?? item.sourceType}
                  </span>
                  <Link
                    to={`/app/jira-search?q=${encodeURIComponent(item.jiraKey)}`}
                    className="font-mono text-[12px] text-indigo hover:underline"
                  >
                    {item.jiraKey}
                  </Link>
                  {item.component ? (
                    <span className="type-kicker">{item.component}</span>
                  ) : null}
                  <span className="ml-auto text-[11px] text-app-ink-mute">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-2 text-[13px] text-app-ink">{item.signal}</p>
                {item.pipelineId ? (
                  <Link
                    to={`/app/pipelines/${item.pipelineId}`}
                    className="mt-2 inline-block text-[12px] text-indigo hover:underline"
                  >
                    View pipeline →
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AnimatedAppPage>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[12px] transition ${
        active
          ? "border-indigo/40 bg-indigo/10 text-indigo"
          : "border-app-border text-app-ink-dim hover:text-app-ink"
      }`}
    >
      {children}
    </button>
  );
}
