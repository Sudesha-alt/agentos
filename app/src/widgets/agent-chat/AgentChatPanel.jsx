import { useCallback, useEffect, useState } from "react";
import {
  clearAgentChatThread,
  ensureAgentChatThread,
  sendAgentChatMessage,
} from "../../entities/agent-chat";
import { getAgentChatConfig } from "./agentChatConfig";
import { AgentChatAvatar } from "./AgentChatAvatar";
import { AgentChatComposer } from "./AgentChatComposer";
import { AgentChatMessages } from "./AgentChatMessages";

export function AgentChatPanel({
  domain,
  contextKey = "",
  disabled = false,
  onClose,
  embedded = false,
}) {
  const config = getAgentChatConfig(domain);
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const loadThread = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const t = await ensureAgentChatThread(domain, contextKey);
      setThread(t);
      setMessages(t.messages ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chat");
    } finally {
      setLoading(false);
    }
  }, [domain, contextKey]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  async function handleSend(content) {
    if (!thread?.id || sending) return;
    setSending(true);
    setError(null);
    const optimisticUser = {
      id: `pending-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    try {
      const result = await sendAgentChatMessage(thread.id, content);
      setMessages((prev) => {
        const withoutPending = prev.filter((m) => m.id !== optimisticUser.id);
        return [
          ...withoutPending,
          result.userMessage ?? optimisticUser,
          result.assistantMessage,
        ];
      });
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id));
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  async function handleClear() {
    if (!thread?.id) return;
    try {
      await clearAgentChatThread(thread.id);
      setMessages([]);
      await loadThread();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clear failed");
    }
  }

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden bg-app-surface ${
        embedded ? "" : "min-h-[28rem] rounded-app border border-app-border shadow-sm"
      }`}
    >
      <div className="shrink-0 border-b border-app-border px-4 py-3">
        <div className="flex items-center gap-3">
          <AgentChatAvatar domain={domain} size={44} />
          <div className="min-w-0 flex-1">
            <p className="type-kicker">{config.role}</p>
            <h3 className="text-[15px] font-semibold leading-tight text-app-ink">
              {config.displayName}
            </h3>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-app-sm px-2 py-1 text-[18px] leading-none text-app-ink-mute hover:bg-app-surface-muted hover:text-app-ink"
              aria-label="Close chat"
            >
              ×
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-app-ink-mute">{config.welcome}</p>
        {contextKey ? (
          <p className="mt-1 truncate text-[11px] text-app-ink-mute">Context: {contextKey}</p>
        ) : null}
      </div>

      {error ? (
        <p className="shrink-0 border-b border-danger/20 bg-danger/5 px-3 py-2 text-[12px] text-danger">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-[13px] text-app-ink-mute">
          Loading chat…
        </div>
      ) : (
        <AgentChatMessages messages={messages} loading={sending} />
      )}

      <AgentChatComposer
        placeholder={config.placeholder}
        suggestions={messages.length === 0 ? config.suggestions : []}
        onSend={handleSend}
        busy={sending}
        disabled={disabled || loading}
      />

      {messages.length > 0 ? (
        <div className="shrink-0 border-t border-app-border px-3 py-1.5 text-right">
          <button
            type="button"
            onClick={handleClear}
            className="text-[11px] text-app-ink-mute hover:text-app-ink"
          >
            Clear thread
          </button>
        </div>
      ) : null}
    </div>
  );
}
