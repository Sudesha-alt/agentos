import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useActivityEvents } from "../../entities/workspace";
import { useOrgPathBuilder } from "../providers/OrgRouteProvider";

const SEEN_STORAGE_KEY = "agentos-intake-toast-seen";

function loadSeenIds() {
  try {
    const raw = sessionStorage.getItem(SEEN_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSeenIds(ids) {
  try {
    sessionStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify([...ids].slice(-80)));
  } catch {
    /* ignore */
  }
}

/** Toast when a Task/Bug lands in AI Worker and the pipeline starts or queues. */
export default function IntakeAssignmentListener() {
  const orgPath = useOrgPathBuilder();
  const mountedAt = useRef(new Date().toISOString());
  const seenIds = useRef(loadSeenIds());
  const [toast, setToast] = useState(null);
  const { data } = useActivityEvents({ pollMs: 8000 });

  useEffect(() => {
    const events = data?.events ?? [];
    const fresh = events.filter(
      (event) =>
        event.tone === "intake" &&
        event.timestamp > mountedAt.current &&
        !seenIds.current.has(event.id)
    );
    if (!fresh.length) return undefined;

    const latest = fresh.sort(
      (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)
    )[0];

    for (const event of fresh) {
      seenIds.current.add(event.id);
    }
    saveSeenIds(seenIds.current);

    setToast(latest);
    const timer = window.setTimeout(() => setToast(null), 9000);
    return () => window.clearTimeout(timer);
  }, [data]);

  if (!toast) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[100] w-[min(22rem,calc(100vw-2rem))] rounded-app border border-indigo/30 bg-app-surface p-4 shadow-app-float"
      role="status"
      aria-live="polite"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo">
        New work assigned
      </p>
      <p className="mt-1.5 text-sm font-medium text-app-ink">
        <span className="font-mono text-indigo">{toast.jiraKey}</span>
        {toast.summary ? (
          <span className="mt-0.5 block truncate text-app-ink-dim">{toast.summary}</span>
        ) : null}
      </p>
      <p className="mt-2 text-[13px] text-app-ink-dim">{toast.message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to={orgPath("pipelines")}
          className="rounded-app-sm bg-indigo px-3 py-1.5 text-[12px] font-medium text-white hover:bg-indigo/90"
          onClick={() => setToast(null)}
        >
          View pipeline
        </Link>
        <button
          type="button"
          className="rounded-app-sm border border-app-border px-3 py-1.5 text-[12px] text-app-ink-dim hover:text-app-ink"
          onClick={() => setToast(null)}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
