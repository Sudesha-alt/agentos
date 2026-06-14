import { useEffect, useRef } from "react";

export function AgentChatMessages({ messages, loading }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (!messages?.length && !loading) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-8 text-center">
        <p className="text-[13px] leading-relaxed text-app-ink-mute">
          Start a conversation — use a suggestion below or type your question.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
      {(messages ?? []).map((msg) => (
        <div
          key={msg.id}
          className={`max-w-[95%] rounded-app-sm px-3 py-2.5 text-[13px] leading-relaxed ${
            msg.role === "user"
              ? "ml-auto bg-indigo/12 text-app-ink"
              : "mr-auto border border-app-border bg-app-surface-muted/40 text-app-ink-dim"
          }`}
        >
          <p className="whitespace-pre-wrap">{msg.content}</p>
          {msg.role === "assistant" && msg.metadata?.toolCallLog?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {msg.metadata.toolCallLog.map((t, i) => (
                <span
                  key={`${t.tool}-${i}`}
                  className="rounded-full border border-app-border bg-app-surface px-2 py-0.5 text-[10px] text-app-ink-mute"
                >
                  {t.tool}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
      {loading ? (
        <div className="mr-auto rounded-app-sm border border-app-border bg-app-surface-muted/40 px-3 py-2.5 text-[13px] text-app-ink-mute">
          Thinking…
        </div>
      ) : null}
      <div ref={endRef} />
    </div>
  );
}
