import { useEffect, useRef } from "react";
import { AgentChatAvatar } from "./AgentChatAvatar";
import { getAgentChatConfig } from "./agentChatConfig";

export function AgentChatMessages({ domain, messages, loading, compact = false }) {
  const endRef = useRef(null);
  const config = getAgentChatConfig(domain);
  const scrollClass = compact
    ? "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-4 sm:px-4"
    : "flex max-h-[min(28rem,50vh)] min-h-[10rem] flex-1 flex-col gap-4 overflow-y-auto px-3 py-4 sm:px-4";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, loading]);

  if (!messages?.length && !loading) {
    return (
      <div
        className={`flex flex-1 items-center justify-center px-4 py-8 text-center ${
          compact ? "min-h-0" : "min-h-[10rem] max-h-[min(28rem,50vh)]"
        }`}
      >
        <p className="text-[13px] leading-relaxed text-app-ink-mute">
          Ask {config.displayName} anything in their domain — mention a Jira ticket key for
          ticket-specific context.
        </p>
      </div>
    );
  }

  return (
    <div className={scrollClass}>
      {(messages ?? []).map((msg) =>
        msg.role === "user" ? (
          <div key={msg.id} className="flex justify-end">
            <div className="max-w-[85%] rounded-app-sm rounded-br-sm bg-indigo/12 px-3.5 py-2.5 text-[13px] leading-relaxed text-app-ink">
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ) : (
          <div key={msg.id} className="flex items-start gap-2.5">
            <AgentChatAvatar domain={domain} size={32} className="mt-0.5" />
            <div className="min-w-0 max-w-[90%]">
              <p className="mb-1 text-[11px] font-medium text-app-ink-mute">
                {config.displayName}
              </p>
              <div className="rounded-app-sm rounded-tl-sm border border-app-border bg-app-surface-muted/50 px-3.5 py-2.5 text-[13px] leading-relaxed text-app-ink">
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.metadata?.toolCallLog?.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1 border-t border-app-border/60 pt-2">
                    {msg.metadata.toolCallLog.map((t, i) => (
                      <span
                        key={`${t.tool}-${i}`}
                        className="rounded-full border border-app-border bg-app-surface px-2 py-0.5 text-[10px] text-app-ink-mute"
                        title={t.query}
                      >
                        {t.tool}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )
      )}
      {loading ? (
        <div className="flex items-start gap-2.5">
          <AgentChatAvatar domain={domain} size={32} className="mt-0.5 opacity-80" />
          <div className="rounded-app-sm border border-app-border bg-app-surface-muted/40 px-3.5 py-2.5 text-[13px] text-app-ink-mute">
            {config.displayName} is thinking…
          </div>
        </div>
      ) : null}
      <div ref={endRef} />
    </div>
  );
}
