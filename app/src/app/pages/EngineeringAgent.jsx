import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useEngineeringRuns } from "../../entities/engineering-agent";
import EngineeringAgentWorkspace from "../../widgets/engineering-agent/EngineeringAgentWorkspace";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";

export default function EngineeringAgent() {
  const { pipelineId: routeId } = useParams();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(routeId ?? null);
  const { items: runs, loading } = useEngineeringRuns({ pollMs: 15_000 });

  const activeId = routeId ?? selectedId;

  function handleSelect(id) {
    setSelectedId(id);
    if (id) navigate(`/app/engineering/${id}`);
    else navigate("/app/engineering");
  }

  return (
    <AnimatedAppPage wide className="space-y-4">
      {!activeId && runs.length > 0 ? (
        <section className="app-card border border-app-border p-4">
          <p className="type-kicker">Select a run</p>
          <ul className="mt-3 divide-y divide-app-border">
            {loading && !runs.length ? (
              <li className="py-4 text-sm text-app-ink-dim">Loading…</li>
            ) : (
              runs.map((run) => (
                <li key={run.pipelineId}>
                  <button
                    type="button"
                    onClick={() => handleSelect(run.pipelineId)}
                    className="flex w-full items-center justify-between py-3 text-left transition hover:text-indigo"
                  >
                    <span>
                      <span className="font-mono text-xs text-app-ink-mute">{run.jiraKey}</span>
                      <span className="ml-2 text-sm font-medium text-app-ink">{run.summary}</span>
                    </span>
                    <span className="text-xs text-app-ink-dim">{run.status}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
          <p className="mt-3 text-xs text-app-ink-mute">
            Or open from{" "}
            <Link to="/app/pipelines" className="text-indigo hover:underline">
              Pipelines
            </Link>
            .
          </p>
        </section>
      ) : null}

      <EngineeringAgentWorkspace
        pipelineId={activeId}
        onSelectPipeline={handleSelect}
      />
    </AnimatedAppPage>
  );
}
