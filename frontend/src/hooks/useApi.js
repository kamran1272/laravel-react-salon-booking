import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useApi(fn, deps) — run an async API call, track loading/error/data.
 * `fn` should be a zero-arg async function closing over the current deps.
 */
export function useApi(fn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current();
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fnRef.current();
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refetch: load, setData };
}

export function apiErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  const data = err.response?.data;
  if (data?.message) return data.message;
  if (err.message) return err.message;
  return fallback;
}
