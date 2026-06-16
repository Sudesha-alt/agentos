import { useCodebaseInsights } from "../../entities/codebase";
import Spinner from "../../app/components/Spinner";
import { Panel, PanelHeader } from "../../shared/ui/Panel";

export default function CodebaseInsightsPanel({ branch = "main" }) {
  const { data, error, loading } = useCodebaseInsights({ branch, pollMs: 60_000 });

  if (loading && !data) {
    return (
      <Panel>
        <PanelHeader kicker="Insights" title="Loading codebase insights…" />
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      </Panel>
    );
  }

  if (error && !data) {
    return (
      <Panel>
        <PanelHeader
          kicker="Insights"
          title="Insights unavailable"
          subtitle={error instanceof Error ? error.message : "Could not load insights"}
        />
      </Panel>
    );
  }

  if (!data?.totals?.files) {
    return (
      <Panel>
        <PanelHeader kicker="Insights" title="No indexed files yet" />
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader
          kicker="Overview"
          title="Codebase insights"
          subtitle={`${data.totals.files} indexed files · ${data.totals.withSummary} with AI summaries`}
        />
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3 sm:px-6">
          <InsightCard label="Languages" items={data.languages.map((l) => `${l.language} (${l.count})`)} />
          <InsightCard
            label="Top folders"
            items={data.topDirectories.map((d) => `${d.path}/ (${d.fileCount})`)}
          />
          <InsightCard label="Patterns" items={data.patterns.map((p) => `${p.pattern} (${p.count})`)} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader kicker="File intelligence" title="Recent summaries" />
        <ul className="divide-y divide-hairline px-5 sm:px-6">
          {data.highlights.map((file) => (
            <li key={file.path} className="py-4 first:pt-2">
              <p className="font-mono text-[12px] text-indigo">{file.path}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-dim">
                {file.summary ?? "No summary — re-index with OPENAI_API_KEY set."}
              </p>
              {file.patterns?.length ? (
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
                  {file.patterns.join(" · ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function InsightCard({ label, items }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface/40 px-3 py-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-mute">{label}</p>
      <ul className="mt-2 space-y-1 text-[13px] text-ink-dim">
        {(items.length ? items : ["—"]).slice(0, 8).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
