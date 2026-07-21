import { useEffect, useState } from 'react';
import type { Envelope } from '../types/contracts';
import { fetchData } from './client';

export interface AsyncState<T> {
  loading: boolean;
  error: Error | null;
  /** 完整外殼（含 generatedAt）。 */
  envelope: Envelope<T> | null;
  data: T | null;
  reload: () => void;
}

/** 讀取單一資料檔並暴露 loading / error / data 狀態。 */
export function useData<T>(name: string): AsyncState<T> {
  const [envelope, setEnvelope] = useState<Envelope<T> | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchData<T>(name)
      .then((env) => {
        if (!cancelled) setEnvelope(env);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err);
          setEnvelope(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [name, nonce]);

  return {
    loading,
    error,
    envelope,
    data: envelope?.data ?? null,
    reload: () => setNonce((n) => n + 1),
  };
}
