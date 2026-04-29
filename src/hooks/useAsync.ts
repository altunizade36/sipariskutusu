import { useState, useEffect, useCallback, useRef } from 'react';

export interface AsyncState<T, E = Error> {
  data: T | null;
  loading: boolean;
  error: E | null;
}

export function useAsync<T, E = Error>(
  asyncFunction: () => Promise<T>,
  immediate: boolean = true,
  dependencies: React.DependencyList = [],
): AsyncState<T, E> & { execute: () => Promise<T> } {
  const [state, setState] = useState<AsyncState<T, E>>({
    data: null,
    loading: immediate,
    error: null,
  });

  const mounted = useRef(true);

  const execute = useCallback(async () => {
    setState({ data: null, loading: true, error: null });

    try {
      const result = await asyncFunction();
      if (mounted.current) {
        setState({ data: result, loading: false, error: null });
      }
      return result;
    } catch (error) {
      const err = error as E;
      if (mounted.current) {
        setState({ data: null, loading: false, error: err });
      }
      throw err;
    }
  }, [asyncFunction]);

  useEffect(() => {
    if (immediate) {
      execute();
    }

    return () => {
      mounted.current = false;
    };
  }, [execute, immediate, ...dependencies]);

  return { ...state, execute };
}

export function useFetch<T, E = Error>(
  url: string,
  options: {
    immediate?: boolean;
    retry?: number;
    retryDelay?: number;
    cache?: number; // milliseconds
  } = {},
): AsyncState<T, E> & { refetch: () => Promise<void> } {
  const [state, setState] = useState<AsyncState<T, E>>({
    data: null,
    loading: options.immediate !== false,
    error: null,
  });

  const cacheRef = useRef<{ data: T; timestamp: number } | null>(null);
  const retryCountRef = useRef(0);
  const mounted = useRef(true);

  const fetch = useCallback(async () => {
    // Check cache
    if (options.cache && cacheRef.current) {
      const age = Date.now() - cacheRef.current.timestamp;
      if (age < options.cache) {
        setState({ data: cacheRef.current.data, loading: false, error: null });
        return;
      }
    }

    setState({ data: null, loading: true, error: null });

    try {
      const response = await globalThis.fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as T;

      if (mounted.current) {
        cacheRef.current = { data, timestamp: Date.now() };
        setState({ data, loading: false, error: null });
      }

      retryCountRef.current = 0;
    } catch (error) {
      const err = error as E;

      if (retryCountRef.current < (options.retry || 0)) {
        retryCountRef.current++;
        const delay = (options.retryDelay || 1000) * retryCountRef.current;
        setTimeout(fetch, delay);
      } else if (mounted.current) {
        setState({ data: null, loading: false, error: err });
      }
    }
  }, [url, options]);

  useEffect(() => {
    if (options.immediate !== false) {
      fetch();
    }

    return () => {
      mounted.current = false;
    };
  }, [fetch, options.immediate]);

  const refetch = useCallback(async () => {
    retryCountRef.current = 0;
    cacheRef.current = null;
    await fetch();
  }, [fetch]);

  return { ...state, refetch };
}

export function usePagination<T>(
  fetchPage: (page: number) => Promise<T[]>,
  options: { pageSize?: number } = {},
) {
  const [allData, setAllData] = useState<T[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const pageSize = options.pageSize || 20;

  const loadPage = useCallback(
    async (page: number) => {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchPage(page);
        setAllData((prev) => (page === 1 ? data : [...prev, ...data]));
        setCurrentPage(page);
        setHasMore(data.length === pageSize);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    },
    [fetchPage, pageSize],
  );

  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      loadPage(currentPage + 1);
    }
  }, [currentPage, hasMore, loading, loadPage]);

  const reset = useCallback(() => {
    setAllData([]);
    setCurrentPage(1);
    setHasMore(true);
    loadPage(1);
  }, [loadPage]);

  return {
    data: allData,
    currentPage,
    loading,
    error,
    hasMore,
    loadMore,
    reset,
    loadPage,
  };
}

export function useDebounced<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
