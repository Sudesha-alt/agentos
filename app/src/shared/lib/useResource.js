import { useEffect, useMemo, useRef, useState } from "react";

function stableKey(deps) {
  try {
    return JSON.stringify(deps ?? []);
  } catch {
    return String(deps?.[0] ?? "");
  }
}

export function useResource(fetcher, deps = [], { pollMs, skip = false } = {}) {
  const resourceKey = useMemo(() => stableKey(deps), [deps]);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [isValidating, setIsValidating] = useState(false);
  const [tick, setTick] = useState(0);
  const dataKeyRef = useRef(null);

  const isStale = data != null && dataKeyRef.current !== resourceKey;

  useEffect(() => {
    if (skip) return undefined;

    let cancelled = false;
    const keyAtStart = resourceKey;
    const isInitialForKey = dataKeyRef.current !== resourceKey;

    async function run(initial) {
      if (initial && !cancelled) setLoading(true);
      else if (!cancelled) setIsValidating(true);

      try {
        const value = await fetcher();
        if (cancelled || keyAtStart !== resourceKey) return;
        setData(value);
        dataKeyRef.current = resourceKey;
        setError(null);
      } catch (err) {
        if (cancelled || keyAtStart !== resourceKey) return;
        setError(err);
      } finally {
        if (!cancelled && keyAtStart === resourceKey) {
          if (initial) setLoading(false);
          setIsValidating(false);
        }
      }
    }

    void run(isInitialForKey);

    if (!pollMs) {
      return () => {
        cancelled = true;
      };
    }

    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      run(false);
    }, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, tick, pollMs, resourceKey]);

  return {
    data,
    error,
    loading,
    isValidating,
    isStale,
    resourceKey,
    refetch: () => setTick((v) => v + 1),
  };
}
