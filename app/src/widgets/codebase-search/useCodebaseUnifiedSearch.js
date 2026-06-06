import { useMemo } from "react";
import { codebaseAdapter } from "../../entities/codebase";
import { useResource } from "../../shared/lib/useResource";
import { useDebouncedValue } from "./useDebouncedValue";

const EMPTY = { query: "", files: [], patterns: [], results: [] };

export function useCodebaseUnifiedSearch(query, branch = "main", { enabled = true } = {}) {
  const debouncedQuery = useDebouncedValue(query, 300);
  const effectiveQuery = enabled ? debouncedQuery?.trim() : "";

  const { data, loading, error, refetch } = useResource(
    () =>
      effectiveQuery
        ? codebaseAdapter.search(effectiveQuery, branch)
        : Promise.resolve(EMPTY),
    [effectiveQuery, branch],
    { pollMs: 0 }
  );

  const normalized = useMemo(() => {
    if (!data) return EMPTY;
    return {
      query: data.query ?? effectiveQuery,
      files: data.files ?? data.results ?? [],
      patterns: data.patterns ?? [],
      results: data.results ?? data.files ?? [],
      concepts: data.concepts,
    };
  }, [data, effectiveQuery]);

  return {
    data: normalized,
    loading: Boolean(effectiveQuery && loading),
    error,
    refetch,
  };
}
