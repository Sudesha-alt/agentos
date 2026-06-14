import { useEffect, useState } from "react";
import { AgentChatPanel } from "./AgentChatPanel";
import { AgentChatAvatar } from "./AgentChatAvatar";
import { getAgentChatConfig } from "./agentChatConfig";

export function AgentPageWithChat({
  domain,
  contextKey = "",
  disabled = false,
  children,
}) {
  const [open, setOpen] = useState(false);
  const config = getAgentChatConfig(domain);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {children}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          className="fixed bottom-20 right-4 z-40 flex items-center gap-2.5 rounded-full border border-app-border bg-app-surface py-2 pl-2 pr-4 shadow-lg transition hover:border-indigo/30 hover:shadow-xl disabled:opacity-50 sm:bottom-6 sm:right-5"
          aria-label={`Chat with ${config.displayName}`}
        >
          <AgentChatAvatar domain={domain} size={36} />
          <span className="hidden text-[13px] font-medium text-app-ink sm:inline">
            Ask {config.displayName}
          </span>
        </button>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end p-4 sm:items-end sm:p-6">
          <button
            type="button"
            className="absolute inset-0 bg-ink/25 backdrop-blur-[1px]"
            aria-label="Close chat"
            onClick={() => setOpen(false)}
          />
          <div
            className="relative flex h-[calc(100vh-2rem)] w-full max-w-none flex-col overflow-hidden rounded-app border border-app-border bg-app-surface shadow-2xl sm:h-[min(32rem,calc(100vh-2rem))] sm:max-w-sm"
            role="dialog"
            aria-label={`${config.displayName} chat`}
          >
            <AgentChatPanel
              domain={domain}
              contextKey={contextKey}
              disabled={disabled}
              onClose={() => setOpen(false)}
              embedded
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
