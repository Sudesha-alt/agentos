import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useGitIntegrationSetup } from "../../entities/git-integration";
import GlobalSearchCore from "../global-search/GlobalSearchCore";
import { CodebaseCommandPaletteContext } from "../codebase-search/useCodebaseCommandPalette";

export function CodebaseCommandPaletteProvider({ children }) {
  const [open, setOpen] = useState(false);
  const { data: setup } = useGitIntegrationSetup({ pollMs: 60_000 });
  const branch = setup?.git?.defaultBranch ?? "main";

  const openPalette = useCallback(() => setOpen(true), []);
  const closePalette = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onKeyDown(e) {
      const isK = e.key === "k" || e.key === "K";
      if ((e.metaKey || e.ctrlKey) && isK) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <CodebaseCommandPaletteContext.Provider value={{ open, openPalette, closePalette }}>
      {children}
      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-start justify-center bg-app-ink/30 px-4 pt-[10vh] backdrop-blur-sm"
              onClick={closePalette}
              role="presentation"
            >
              <div
                className="w-full max-w-3xl rounded-2xl border border-app-border bg-app-surface shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Global search"
              >
                <header className="flex items-center justify-between border-b border-app-border px-5 py-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-app-ink-mute">
                      Search
                    </p>
                    <p className="text-lg font-semibold text-app-ink">Tickets, codebase, audit</p>
                  </div>
                  <kbd className="hidden rounded-md border border-app-border bg-app-surface-muted px-2 py-0.5 font-mono text-[10px] text-app-ink-mute sm:inline">
                    Esc
                  </kbd>
                </header>
                <div className="max-h-[min(68vh,640px)] overflow-y-auto px-5 py-4">
                  <GlobalSearchCore
                    branch={branch}
                    compact
                    autoFocus
                    onNavigateAway={closePalette}
                  />
                </div>
                <footer className="border-t border-app-border px-5 py-2.5">
                  <p className="text-[11px] text-app-ink-mute">
                    <kbd className="rounded border border-app-border px-1">⌘K</kbd> toggle · Results open
                    pipelines, codebase explorer, or audit context
                  </p>
                </footer>
              </div>
            </div>,
            document.body
          )
        : null}
    </CodebaseCommandPaletteContext.Provider>
  );
}
