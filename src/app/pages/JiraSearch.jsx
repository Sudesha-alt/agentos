import { Link } from "react-router-dom";
import { useState } from "react";
import { searchBoard } from "../../entities/jira-intake";
import EmptyState from "../components/EmptyState";
import Spinner from "../components/Spinner";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";

export default function JiraSearch() {
  const [keyword, setKeyword] = useState("");
  const [searchIn, setSearchIn] = useState("both");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    const q = keyword.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await searchBoard(q, searchIn);
      setResult(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[82rem] space-y-6">
      <PageIntro
        kicker="Jira intake"
        title="Board keyword search"
        body="Search the entire Jira board for keywords in summaries and descriptions. Results are grouped by board column and fetched live from Jira via the intake service."
        right={
          <Link
            to="/app/ai-worker"
            className="rounded-full border border-hairline bg-surface/60 px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-dim transition-colors hover:text-ink"
          >
            AI Worker queue
          </Link>
        }
      />

      <Panel>
        <PanelHeader kicker="Query" title="Search all sections" />
        <form onSubmit={handleSearch} className="flex flex-col gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-end sm:p-6">
          <label className="flex min-w-[200px] flex-1 flex-col gap-2">
            <span className="editorial-kicker text-ink-mute">Keyword</span>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. login, automate"
              className="rounded-[0.85rem] border border-hairline bg-canvas/50 px-4 py-2.5 text-[14px] text-ink outline-none focus:border-indigo/50"
              autoComplete="off"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="editorial-kicker text-ink-mute">Search in</span>
            <select
              value={searchIn}
              onChange={(e) => setSearchIn(e.target.value)}
              className="rounded-[0.85rem] border border-hairline bg-canvas/50 px-4 py-2.5 text-[14px] text-ink outline-none focus:border-indigo/50"
            >
              <option value="both">Summary & description</option>
              <option value="summary">Summary only</option>
              <option value="description">Description only</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={loading || !keyword.trim()}
            className="rounded-full bg-indigo px-5 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-white transition-opacity disabled:opacity-50"
          >
            {loading ? "Searching…" : "Search board"}
          </button>
        </form>
      </Panel>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : null}

      {error ? (
        <EmptyState
          title="Search failed"
          body={error.message || "Ensure agentos API is running (npm run dev) and server/.env has JIRA_* credentials."}
        />
      ) : null}

      {result && !loading ? (
        <div className="space-y-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-dim">
            Found {result.total} match(es) for &ldquo;{result.keyword}&rdquo; · {result.searchIn}
          </p>
          {!result.sections?.length ? (
            <EmptyState title="No matches" body="Try another keyword or search scope." />
          ) : (
            result.sections.map((section) => (
              <Panel key={section.status}>
                <PanelHeader
                  kicker="Section"
                  title={section.columnLabel || section.status}
                  right={
                    <span className="font-mono text-[11px] text-ink-mute">
                      {section.issues.length} ticket(s)
                    </span>
                  }
                />
                <ul className="divide-y divide-hairline">
                  {section.issues.map((issue) => (
                    <li key={issue.key} className="px-5 py-4 sm:px-6">
                      <p className="font-mono text-[12px] text-indigo">{issue.key}</p>
                      <h3 className="mt-1 text-[15px] text-ink">{issue.summary}</h3>
                      {issue.description ? (
                        <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-ink-dim">
                          {issue.description}
                        </p>
                      ) : null}
                      <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-mute">
                        {issue.status}
                        {issue.priority ? ` · ${issue.priority}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </Panel>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
