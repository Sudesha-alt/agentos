import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { AgentChatPanel } from "./AgentChatPanel";
import { AgentChatAvatar } from "./AgentChatAvatar";
import { getAgentChatConfig } from "./agentChatConfig";

/**
 * Floating corner widget — click to open a discussion popup.
 * Portaled to document.body so position:fixed works on animated pages.
 */
export function AgentPageWithChat({
  domain,
  contextKey = "",
  disabled = false,
  children,
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const config = getAgentChatConfig(domain);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const widget = mounted
    ? createPortal(
        <>
          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              disabled={disabled}
              className="fixed bottom-20 right-4 z-[60] flex items-center gap-2.5 rounded-full border border-app-border bg-app-surface py-2 pl-2 pr-4 shadow-lg transition hover:border-indigo/30 hover:shadow-xl disabled:opacity-50 sm:bottom-6 sm:right-6"
              aria-label={`Chat with ${config.displayName}`}
            >
              <AgentChatAvatar domain={domain} size={36} />
              <span className="hidden text-[13px] font-medium text-app-ink sm:inline">
                Ask {config.displayName}
              </span>
            </button>
          ) : null}

          {open ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-[60] bg-ink/20 backdrop-blur-[1px] sm:bg-ink/10"
                aria-label="Close chat"
                onClick={() => setOpen(false)}
              />
              <div
                className="fixed bottom-20 right-4 z-[70] flex w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-app border border-app-border bg-app-surface shadow-2xl sm:bottom-6 sm:right-6"
                style={{ height: "min(32rem, calc(100dvh - 6rem))" }}
                role="dialog"
                aria-label={`${config.displayName} discussion`}
              >
                <AgentChatPanel
                  domain={domain}
                  contextKey={contextKey}
                  disabled={disabled}
                  onClose={() => setOpen(false)}
                  layout="popup"
                />
              </div>
            </>
          ) : null}
        </>,
        document.body
      )
    : null;

  return (
    <>
      {children}
      {widget}
    </>
  );
}
