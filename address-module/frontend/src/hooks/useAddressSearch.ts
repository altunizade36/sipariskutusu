import { useEffect, useMemo, useState } from 'react';
import { locationApi } from '../api/locationApi';
import { AddressSearchResult } from '../types/address';

export function useAddressSearch(query: string) {
  const [results, setResults] = useState<AddressSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebouncedValue(query, 300);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (debouncedQuery.trim().length < 3) {
        setResults([]);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await locationApi.searchAddress(debouncedQuery, 10);
        if (alive) setResults(response.results);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        if (alive) setIsLoading(false);
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, [debouncedQuery]);

  return useMemo(
    () => ({
      results,
      isLoading,
      error,
      hasQuery: debouncedQuery.trim().length >= 3,
    }),
    [results, isLoading, error, debouncedQuery],
  );
}

function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
