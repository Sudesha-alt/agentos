import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useGitIntegrationSetup } from "../../entities/git-integration";
import CodebaseSearchCore from "./CodebaseSearchCore";
import {
  CodebaseCommandPaletteContext,
} from "./useCodebaseCommandPalette";

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
              className="fixed inset-0 z-[200] flex items-start justify-center bg-ink/40 px-4 pt-[12vh] backdrop-blur-sm"
              onClick={closePalette}
              role="presentation"
            >
              <div
                className="editorial-panel w-full max-w-2xl rounded-[1.25rem] border border-hairline bg-surface shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Codebase search"
              >
                <header className="flex items-center justify-between border-b border-hairline px-4 py-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                      Codebase
                    </p>
                    <p className="font-display text-lg text-ink">Search or ask</p>
                  </div>
                  <kbd className="hidden rounded border border-hairline px-2 py-0.5 font-mono text-[10px] text-ink-mute sm:inline">
                    Esc
                  </kbd>
                </header>
                <div className="max-h-[min(60vh,520px)] overflow-y-auto px-4 py-4">
                  <CodebaseSearchCore
                    branch={branch}
                    compact
                    autoFocus
                    onNavigateAway={closePalette}
                  />
                </div>
                <footer className="border-t border-hairline px-4 py-2">
                  <p className="font-mono text-[10px] text-ink-mute">
                    <kbd className="rounded border border-hairline px-1">⌘K</kbd> toggle · Results
                    open in Explorer or Map
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
