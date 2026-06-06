import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Spinner from "../../app/components/Spinner";
import { askCodebase } from "../../entities/codebase";
import {
  ASK_PLACEHOLDERS,
  SEARCH_PLACEHOLDERS,
  explorerUrl,
  mapHighlightUrl,
  splitAnswerWithPaths,
} from "./codebaseSearchUtils";
import { useCodebaseUnifiedSearch } from "./useCodebaseUnifiedSearch";

function ModeToggle({ mode, onChange, compact = false }) {
  return (
    <div
      className={`inline-flex rounded-full border border-hairline p-0.5 ${compact ? "text-[10px]" : ""}`}
    >
      {["search", "ask"].map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`rounded-full px-3 py-1 font-mono uppercase tracking-[0.14em] ${
            mode === m ? "bg-indigo text-white" : "text-ink-dim hover:text-ink"
          } ${compact ? "px-2.5 py-0.5 text-[10px]" : "text-[10.5px]"}`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

function RotatingPlaceholder({ placeholders, active }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % placeholders.length), 4000);
    return () => clearInterval(id);
  }, [active, placeholders.length]);

  return placeholders[idx];
}

function FileResultRow({ hit, onOpenFile, onHighlightMap, compact }) {
  return (
    <div
      className={`group flex items-start justify-between gap-3 rounded-lg border border-transparent px-3 py-2 hover:border-hairline hover:bg-surface/60 ${
        compact ? "py-1.5" : ""
      }`}
    >
      <button type="button" onClick={() => onOpenFile(hit.path)} className="min-w-0 flex-1 text-left">
        <p className="truncate font-mono text-[11px] text-indigo group-hover:underline">{hit.path}</p>
        {hit.snippet || hit.summary ? (
          <p className={`mt-0.5 line-clamp-2 text-ink-dim ${compact ? "text-[11px]" : "text-[12px]"}`}>
            {hit.snippet || hit.summary}
          </p>
        ) : null}
        {typeof hit.score === "number" && hit.score > 0 ? (
          <p className="mt-1 font-mono text-[10px] text-ink-mute">
            relevance {(hit.score * 100).toFixed(0)}%
          </p>
        ) : null}
      </button>
      <div className="flex shrink-0 flex-col gap-1 opacity-0 transition group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onOpenFile(hit.path)}
          className="whitespace-nowrap rounded-full border border-hairline px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-dim hover:text-ink"
        >
          Explorer
        </button>
        <button
          type="button"
          onClick={() => onHighlightMap([hit.path])}
          className="whitespace-nowrap rounded-full border border-hairline px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-dim hover:text-ink"
        >
          Map
        </button>
      </div>
    </div>
  );
}

function AskAnswer({ answer, highlightPaths, relatedSnippets, onOpenFile, onHighlightMap }) {
  const knownPaths = [
    ...new Set([
      ...highlightPaths,
      ...relatedSnippets.map((s) => s.path),
    ]),
  ];
  const parts = splitAnswerWithPaths(answer, knownPaths);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-hairline bg-surface/40 px-4 py-3 text-[13px] leading-relaxed text-ink">
        {parts.map((part, i) =>
          part.type === "path" ? (
            <button
              key={`${part.value}-${i}`}
              type="button"
              onClick={() => onOpenFile(part.value)}
              className="font-mono text-[12px] text-indigo hover:underline"
            >
              [{part.value}]
            </button>
          ) : (
            <span key={i}>{part.value}</span>
          )
        )}
      </div>

      {highlightPaths.length > 0 ? (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
            Referenced files
          </p>
          <ul className="mt-2 space-y-1">
            {highlightPaths.map((path) => (
              <li key={path} className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenFile(path)}
                  className="font-mono text-[11px] text-indigo hover:underline"
                >
                  {path}
                </button>
                <button
                  type="button"
                  onClick={() => onHighlightMap([path])}
                  className="font-mono text-[10px] text-ink-mute hover:text-ink"
                >
                  highlight on map
                </button>
              </li>
            ))}
          </ul>
          {highlightPaths.length > 1 ? (
            <button
              type="button"
              onClick={() => onHighlightMap(highlightPaths)}
              className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-indigo hover:underline"
            >
              Highlight all on map
            </button>
          ) : null}
        </div>
      ) : null}

      {relatedSnippets.length > 0 ? (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
            Source snippets
          </p>
          <ul className="mt-2 space-y-2">
            {relatedSnippets.map((s) => (
              <li key={s.path} className="rounded-lg border border-hairline/80 px-3 py-2">
                <button
                  type="button"
                  onClick={() => onOpenFile(s.path)}
                  className="font-mono text-[11px] text-indigo hover:underline"
                >
                  {s.path}
                  {typeof s.score === "number" ? (
                    <span className="ml-2 text-ink-mute">({(s.score * 100).toFixed(0)}%)</span>
                  ) : null}
                </button>
                {s.snippet ? (
                  <p className="mt-1 line-clamp-3 text-[12px] text-ink-dim">{s.snippet}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default function CodebaseSearchCore({
  branch = "main",
  compact = false,
  autoFocus = false,
  onNavigateAway,
  initialMode = "search",
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState(initialMode);
  const [input, setInput] = useState("");
  const [askResult, setAskResult] = useState(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState(null);

  const searchEnabled = mode === "search";
  const { data, loading, error } = useCodebaseUnifiedSearch(input, branch, {
    enabled: searchEnabled,
  });

  function openFile(path) {
    navigate(explorerUrl(path));
    onNavigateAway?.();
  }

  function highlightMap(paths) {
    navigate(mapHighlightUrl(paths));
    onNavigateAway?.();
  }

  async function submitAsk(e) {
    e?.preventDefault();
    const question = input.trim();
    if (!question) return;

    setAsking(true);
    setAskError(null);
    setAskResult(null);

    try {
      const result = await askCodebase(question, branch);
      setAskResult(result);
    } catch (err) {
      setAskError(err instanceof Error ? err.message : String(err));
    } finally {
      setAsking(false);
    }
  }

  function handleModeChange(next) {
    setMode(next);
    setAskResult(null);
    setAskError(null);
  }

  const placeholders = mode === "ask" ? ASK_PLACEHOLDERS : SEARCH_PLACEHOLDERS;
  const showEmpty = searchEnabled && !input.trim();
  const showSearchResults = searchEnabled && input.trim();

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ModeToggle mode={mode} onChange={handleModeChange} compact={compact} />
        {!compact ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
            {mode === "search" ? "Semantic + pattern tags" : "Natural language Q&A"}
          </p>
        ) : null}
      </div>

      {mode === "ask" ? (
        <form onSubmit={submitAsk} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus={autoFocus}
            placeholder={ASK_PLACEHOLDERS[0]}
            className={`w-full rounded-xl border border-hairline bg-canvas/80 px-4 py-3 font-mono text-[13px] text-ink outline-none ring-indigo/30 placeholder:text-ink-mute focus:ring-2 ${
              compact ? "py-2.5 text-[12px]" : ""
            }`}
          />
          <button
            type="submit"
            disabled={asking || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-indigo px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white disabled:opacity-40"
          >
            {asking ? "…" : "Ask"}
          </button>
        </form>
      ) : (
        <div className="relative">
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus={autoFocus}
            className={`w-full rounded-xl border border-hairline bg-canvas/80 px-4 py-3 font-mono text-[13px] text-ink outline-none ring-indigo/30 focus:ring-2 ${
              compact ? "py-2.5 text-[12px]" : ""
            }`}
          />
          {!input ? (
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-[13px] text-ink-mute">
              <RotatingPlaceholder placeholders={placeholders} active={showEmpty} />
            </span>
          ) : null}
        </div>
      )}

      {mode === "ask" && asking ? (
        <div className="flex items-center gap-2 py-4">
          <Spinner label="Thinking…" />
        </div>
      ) : null}

      {mode === "ask" && askError ? (
        <p className="text-[13px] text-danger">{askError}</p>
      ) : null}

      {mode === "ask" && askResult ? (
        <AskAnswer
          answer={askResult.answer}
          highlightPaths={askResult.highlightPaths ?? []}
          relatedSnippets={askResult.relatedSnippets ?? []}
          onOpenFile={openFile}
          onHighlightMap={highlightMap}
        />
      ) : null}

      {showSearchResults && loading ? (
        <div className="flex items-center gap-2 py-3">
          <Spinner label="Searching…" />
        </div>
      ) : null}

      {showSearchResults && error ? (
        <p className="text-[13px] text-danger">{error.message}</p>
      ) : null}

      {showSearchResults && !loading && !error ? (
        <div className="space-y-5">
          {data.files.length > 0 ? (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                  Files
                </h3>
                {data.files.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => highlightMap(data.files.map((f) => f.path))}
                    className="font-mono text-[10px] uppercase tracking-[0.1em] text-indigo hover:underline"
                  >
                    Highlight all on map
                  </button>
                ) : null}
              </div>
              <div className="divide-y divide-hairline/60 rounded-xl border border-hairline/80">
                {data.files.map((hit) => (
                  <FileResultRow
                    key={hit.path}
                    hit={hit}
                    onOpenFile={openFile}
                    onHighlightMap={highlightMap}
                    compact={compact}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {data.patterns?.length > 0 ? (
            <section>
              <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                Patterns
              </h3>
              <div className="space-y-3">
                {data.patterns.map((group) => (
                  <div
                    key={group.pattern}
                    className="rounded-xl border border-hairline/80 px-3 py-2"
                  >
                    <p className="font-mono text-[11px] text-ink">
                      <span className="rounded-full border border-hairline px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-indigo">
                        {group.pattern}
                      </span>
                    </p>
                    <ul className="mt-2 space-y-1">
                      {group.files.map((f) => (
                        <li key={f.path}>
                          <button
                            type="button"
                            onClick={() => openFile(f.path)}
                            className="font-mono text-[11px] text-indigo hover:underline"
                          >
                            {f.path}
                          </button>
                          {f.summary ? (
                            <span className="ml-2 text-[11px] text-ink-dim">— {f.summary}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {!data.files.length && !data.patterns?.length ? (
            <p className="py-4 text-center text-[13px] text-ink-dim">No matches for this query.</p>
          ) : null}
        </div>
      ) : null}

      {showEmpty && mode === "search" ? (
        <p className="text-center text-[12px] text-ink-mute">
          Search indexed files by meaning or architecture pattern tags.
        </p>
      ) : null}
    </div>
  );
}
