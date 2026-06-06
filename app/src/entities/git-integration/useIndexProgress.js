import { useEffect, useState } from "react";
import { apiPath } from "../../shared/config/apiBase";

function parseSseChunk(buffer, onEvent) {
  const parts = buffer.split("\n\n");
  const remainder = parts.pop() ?? "";
  for (const part of parts) {
    const line = part
      .split("\n")
      .find((row) => row.startsWith("data: "));
    if (!line) continue;
    try {
      onEvent(JSON.parse(line.slice(6)));
    } catch {
      // ignore malformed chunks
    }
  }
  return remainder;
}

/**
 * Subscribe to codebase index progress via SSE (falls back to polling on error).
 */
export function useIndexProgress({ runId, branch, enabled = true } = {}) {
  const [state, setState] = useState({
    loading: enabled,
    active: false,
    progress: null,
    runId: runId ?? null,
    branchName: branch ?? null,
    error: null,
  });

  useEffect(() => {
    if (!enabled) {
      setState((prev) => ({ ...prev, loading: false }));
      return undefined;
    }

    let cancelled = false;
    const params = new URLSearchParams();
    if (runId) params.set("runId", runId);
    if (branch) params.set("branch", branch);
    const qs = params.toString();
    const query = qs ? `?${qs}` : "";
    const sseUrl = apiPath("/git-integration", `/index/progress${query}`);
    const statusUrl = apiPath("/git-integration", `/index/status${query}`);

    async function pollStatus() {
      while (!cancelled) {
        try {
          const res = await fetch(statusUrl, { credentials: "include" });
          if (!res.ok) throw new Error(`status ${res.status}`);
          const data = await res.json();
          if (cancelled) return;
          setState({
            loading: false,
            active: Boolean(data.active),
            progress: data.progress ?? null,
            runId: data.runId ?? runId ?? null,
            branchName: data.branchName ?? branch ?? null,
            error: null,
          });
          if (!data.active) return;
        } catch (err) {
          if (cancelled) return;
          setState((prev) => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err.message : "progress_unavailable",
          }));
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    async function connectSse() {
      try {
        const res = await fetch(sseUrl, {
          credentials: "include",
          headers: { Accept: "text/event-stream" },
        });
        if (!res.ok || !res.body) {
          await pollStatus();
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          buffer = parseSseChunk(buffer, (payload) => {
            if (cancelled) return;
            setState({
              loading: false,
              active: Boolean(payload.active),
              progress: payload.progress ?? null,
              runId: payload.runId ?? runId ?? null,
              branchName: payload.branchName ?? branch ?? null,
              error: payload.error ?? null,
            });
          });
        }
      } catch {
        if (!cancelled) await pollStatus();
      }
    }

    void connectSse();
    return () => {
      cancelled = true;
    };
  }, [runId, branch, enabled]);

  return state;
}

export async function fetchIndexStatus({ runId, branch } = {}) {
  const params = new URLSearchParams();
  if (runId) params.set("runId", runId);
  if (branch) params.set("branch", branch);
  const qs = params.toString();
  const res = await fetch(
    apiPath("/git-integration", `/index/status${qs ? `?${qs}` : ""}`),
    { credentials: "include" }
  );
  if (!res.ok) throw new Error(`Index status ${res.status}`);
  return res.json();
}
