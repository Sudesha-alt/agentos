import { useEffect, useState } from "react";

export function useResource(fetcher, deps = [], { pollMs } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

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
  }, [tick, pollMs, ...deps]);

  return {
    data,
    error,
    loading,
    refetch: () => setTick((v) => v + 1),
  };
}
