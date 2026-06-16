import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Spinner from "../../app/components/Spinner";
import { globalSearch } from "../../entities/global-search";
import { formatAuditInline, formatRelativeTime } from "../../shared/lib/format";
import { useDebouncedValue } from "../codebase-search/useDebouncedValue";
import { explorerUrl, mapHighlightUrl } from "../codebase-search/codebaseSearchUtils";

const STATIC_PAGES = [
  { label: "Audit Trail", href: "/app/audit", keywords: ["audit", "compliance", "log", "trail"] },
  { label: "Pipelines", href: "/app/pipelines", keywords: ["pipeline", "ticket", "queue", "review"] },
  { label: "Codebase Explorer", href: "/app/codebase", keywords: ["codebase", "explorer", "files", "code"] },
  { label: "GitHub integration", href: "/app/settings/integrations/github", keywords: ["github", "git", "repo", "repository"] },
  { label: "Jira integration", href: "/app/settings/integrations/jira", keywords: ["jira", "ticket", "board"] },
  { label: "Settings", href: "/app/settings", keywords: ["settings", "integrations", "billing", "plan"] },
];

function Section({ title, children, count }) {
  if (!children) return null;
  return (
    <section className="border-t border-app-border pt-4 first:border-t-0 first:pt-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-app-ink-mute">{title}</h3>
        {typeof count === "number" ? (
          <span className="text-[11px] text-app-ink-mute">{count}</span>
        ) : null}
      </div>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function ResultButton({ onClick, title, subtitle, meta, compact }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-app-surface-muted/70 ${
        compact ? "py-2" : ""
      }`}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-app-ink">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 block line-clamp-2 text-[13px] text-app-ink-dim">{subtitle}</span>
        ) : null}
      </span>
      {meta ? <span className="shrink-0 text-[11px] text-app-ink-mute">{meta}</span> : null}
    </button>
  );
}

export default function GlobalSearchCore({
  branch = "main",
  compact = false,
  autoFocus = false,
  onNavigateAway,
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const debouncedQuery = useDebouncedValue(query, 280);

  const pageMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return STATIC_PAGES.filter((page) =>
      page.label.toLowerCase().includes(q) ||
      page.keywords.some((word) => word.includes(q) || q.includes(word))
    ).slice(0, 4);
  }, [query]);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q) {
      setResults(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    globalSearch(q, branch)
      .then((data) => {
        if (!cancelled) setResults(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Search failed");
          setResults(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, branch]);

  function go(path) {
    navigate(path);
    onNavigateAway?.();
  }

  const tickets = results?.tickets ?? [];
  const audit = results?.audit ?? [];
  const files = results?.codebase?.files ?? results?.codebase?.results ?? [];
  const hasResults =
    tickets.length > 0 || audit.length > 0 || files.length > 0 || pageMatches.length > 0;
  const showEmpty = debouncedQuery.trim() && !loading && !error && !hasResults;

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="sr-only">Search</span>
        <div className="flex items-center gap-3 rounded-xl border border-app-border bg-app-surface px-4 py-3 shadow-sm">
          <svg width="18" height="18" viewBox="0 0 14 14" fill="none" aria-hidden className="shrink-0 text-app-ink-mute">
            <circle cx="6" cy="6" r="3.5" stroke="currentColor" />
            <path d="M8.5 8.5L12 12" stroke="currentColor" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tickets, codebase, audit events…"
            className="min-w-0 flex-1 bg-transparent text-sm text-app-ink outline-none placeholder:text-app-ink-mute"
            autoFocus={autoFocus}
            autoComplete="off"
          />
          {loading ? <Spinner /> : null}
        </div>
      </label>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {showEmpty ? (
        <p className="rounded-lg border border-app-border bg-app-surface-muted/40 px-4 py-3 text-sm text-app-ink-dim">
          No matches for <span className="font-medium text-app-ink">"{debouncedQuery.trim()}"</span>.
        </p>
      ) : null}

      {hasResults ? (
        <div className="space-y-4">
          {pageMatches.length > 0 ? (
            <Section title="Pages" count={pageMatches.length}>
              {pageMatches.map((page) => (
                <ResultButton
                  key={page.href}
                  title={page.label}
                  subtitle="Open page"
                  onClick={() => go(page.href)}
                  compact={compact}
                />
              ))}
            </Section>
          ) : null}

          {tickets.length > 0 ? (
            <Section title="Tickets" count={tickets.length}>
              {tickets.map((ticket) => (
                <ResultButton
                  key={ticket.id}
                  title={ticket.jiraKey}
                  subtitle={ticket.summary}
                  meta={ticket.currentStage?.replaceAll("_", " ")}
                  onClick={() => go(`/app/pipelines/${ticket.id}`)}
                  compact={compact}
                />
              ))}
            </Section>
          ) : null}

          {files.length > 0 ? (
            <Section title="Codebase" count={files.length}>
              {files.slice(0, 8).map((hit) => (
                <div
                  key={hit.path}
                  className="group flex items-start justify-between gap-3 rounded-lg px-3 py-2 hover:bg-app-surface-muted/70"
                >
                  <button
                    type="button"
                    onClick={() => go(explorerUrl(hit.path))}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate font-mono text-[12px] text-indigo group-hover:underline">{hit.path}</p>
                    {hit.snippet || hit.summary ? (
                      <p className="mt-0.5 line-clamp-2 text-[12px] text-app-ink-dim">
                        {hit.snippet || hit.summary}
                      </p>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => go(mapHighlightUrl([hit.path]))}
                    className="shrink-0 rounded-md border border-app-border px-2 py-1 text-[10px] font-medium text-app-ink-dim hover:text-app-ink"
                  >
                    Map
                  </button>
                </div>
              ))}
            </Section>
          ) : null}

          {audit.length > 0 ? (
            <Section title="Audit" count={audit.length}>
              {audit.map((entry) => (
                <ResultButton
                  key={entry.id}
                  title={entry.event?.replaceAll("_", " ")}
                  subtitle={`${entry.jiraKey} · ${formatAuditInline(entry) || entry.summary}`}
                  meta={formatRelativeTime(entry.timestamp)}
                  onClick={() => go(`/app/pipelines/${entry.pipelineId}`)}
                  compact={compact}
                />
              ))}
            </Section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
