import { useState } from "react";

export function AgentChatComposer({
  placeholder,
  suggestions = [],
  onSend,
  busy,
  disabled,
}) {
  const [text, setText] = useState("");

  function submit(value) {
    const trimmed = (value ?? text).trim();
    if (!trimmed || busy || disabled) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <div className="shrink-0 border-t border-app-border bg-app-surface/80 px-3 py-3 backdrop-blur-sm">
      {suggestions.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy || disabled}
              onClick={() => submit(s)}
              className="rounded-full border border-app-border bg-app-surface-muted/50 px-2.5 py-1 text-[11px] text-app-ink-dim transition hover:border-indigo/30 hover:text-app-ink disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          rows={2}
          value={text}
          disabled={busy || disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          className="min-h-[2.5rem] flex-1 resize-none rounded-app-sm border border-app-border bg-app-surface px-3 py-2 text-[13px] text-app-ink placeholder:text-app-ink-mute focus:border-indigo/40 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || disabled || !text.trim()}
          className="app-btn-primary shrink-0 px-4 py-2 text-[12px] disabled:opacity-50"
        >
          {busy ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
