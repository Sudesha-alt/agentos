import { useEffect, useState } from "react";

// Thin async data hook with optional polling. The caller passes a deps array
// that captures everything the fetcher closes over; we use those deps as our
// effect dependencies so the fetch re-runs when (and only when) inputs change.
export function useApi(fetcher, deps = [], { pollMs } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refetchTick, setRefetchTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function run(initial) {
      if (initial && !cancelled) setLoading(true);
      try {
        const value = await fetcher();
        if (cancelled) return;
        setData(value);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err);
      } finally {
        if (!cancelled && initial) setLoading(false);
      }
    }

    void run(true);

    if (!pollMs) {
      return () => {
        cancelled = true;
      };
    }

    const id = window.setInterval(() => run(false), pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollMs, refetchTick, ...deps]);

  return {
    data,
    error,
    loading,
    refetch: () => setRefetchTick((v) => v + 1),
  };
}
