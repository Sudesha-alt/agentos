import { Link } from "react-router-dom";
import { useState } from "react";
import { searchBoard } from "../../entities/jira-intake";
import EmptyState from "../components/EmptyState";
import Spinner from "../components/Spinner";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";
import { useOrg } from "../../shared/providers/OrgRouteProvider";

export default function JiraSearch() {
  const { orgPath } = useOrg();
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
    <AnimatedAppPage wide>
      <PageIntro
        kicker="Jira intake"
        title="Board keyword search"
        right={
          <Link
            to={orgPath("settings", "integrations", "jira")}
            className="rounded-full border border-app-border bg-app-surface px-3.5 py-1.5 text-[12px] text-app-ink-dim transition-colors hover:text-app-ink"
          >
            AI Worker queue
          </Link>
        }
      />

      <Panel>
        <PanelHeader kicker="Query" title="Search all sections" />
        <form onSubmit={handleSearch} className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end sm:px-6">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <span className="type-kicker">Keyword</span>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. login, automate"
              className="rounded-app-sm border border-app-border bg-app-surface px-3 py-2 text-sm text-app-ink outline-none focus:border-indigo/40 focus:ring-2 focus:ring-indigo/10"
              autoComplete="off"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="type-kicker">Search in</span>
            <select
              value={searchIn}
              onChange={(e) => setSearchIn(e.target.value)}
              className="rounded-app-sm border border-app-border bg-app-surface px-3 py-2 text-sm text-app-ink outline-none focus:border-indigo/40"
            >
              <option value="both">Summary & description</option>
              <option value="summary">Summary only</option>
              <option value="description">Description only</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={loading || !keyword.trim()}
            className="app-btn-primary disabled:opacity-50"
          >
            {loading ? "Searching…" : "Search board"}
          </button>
        </form>
      </Panel>

      {loading ? (
        <div className="flex justify-center py-10">
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
        <div className="space-y-5">
          <p className="type-kicker">
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
                    <span className="text-[11px] text-app-ink-mute">
                      {section.issues.length} ticket(s)
                    </span>
                  }
                />
                <ul className="divide-y divide-app-border">
                  {section.issues.map((issue) => (
                    <li key={issue.key} className="px-5 py-3.5 sm:px-6">
                      <p className="text-[12px] font-medium text-indigo">{issue.key}</p>
                      <h3 className="mt-0.5 text-sm font-medium text-app-ink">{issue.summary}</h3>
                      {issue.description ? (
                        <p className="mt-1.5 line-clamp-3 type-body text-app-ink-dim">
                          {issue.description}
                        </p>
                      ) : null}
                      <p className="mt-1.5 type-kicker">
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
    </AnimatedAppPage>
  );
}
