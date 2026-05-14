import { useMemo, useState } from "react";
import { usePipelineList } from "../../entities/pipeline";
import PipelineTableWidget from "../../widgets/pipeline-table/PipelineTableWidget";
import { PageIntro } from "../../shared/ui/Panel";

export default function Pipelines() {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  const { items: pipelines, loading } = usePipelineList(undefined, {
    pollMs: 10_000,
  });

  const items = useMemo(() => {
    let list = pipelines;
    if (filter !== "all") list = list.filter((p) => p.status === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (p) =>
          p.ticket?.jiraKey?.toLowerCase().includes(q) ||
          p.ticket?.normalizedData?.summary?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [pipelines, filter, query]);

  return (
    <div className="mx-auto w-full max-w-[82rem] space-y-6">
      <PageIntro
        kicker="Pipelines"
        title="Every ticket the system has touched."
        body="Search, filter, and inspect the current orchestration ledger without coupling the screen to backend implementation details."
      />

      <PipelineTableWidget
        items={items}
        loading={loading}
        filter={filter}
        onFilterChange={setFilter}
        query={query}
        onQueryChange={setQuery}
      />
    </div>
  );
}
