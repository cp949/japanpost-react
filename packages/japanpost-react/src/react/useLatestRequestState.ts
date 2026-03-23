import { useCallback, useEffect, useRef, useState } from "react";
import type { JapanAddressError } from "../core/types";

type BeginRequestResult = {
  requestId: number;
  signal: AbortSignal;
};

export function useLatestRequestState<TResult>() {
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TResult | null>(null);
  const [error, setError] = useState<JapanAddressError | null>(null);

  const isCurrentRequest = useCallback((requestId: number) => {
    return isMountedRef.current && requestId === requestIdRef.current;
  }, []);

  const invalidateCurrentRequest = useCallback(() => {
    requestIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      invalidateCurrentRequest();
    };
  }, [invalidateCurrentRequest]);

  const beginRequest = useCallback((): BeginRequestResult => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);

    return {
      requestId,
      signal: abortController.signal,
    };
  }, []);

  const setSuccess = useCallback((requestId: number, result: TResult) => {
    if (isCurrentRequest(requestId)) {
      setData(result);
    }
  }, [isCurrentRequest]);

  const setFailure = useCallback(
    (requestId: number, nextError: JapanAddressError) => {
      if (isCurrentRequest(requestId)) {
        setError(nextError);
        setData(null);
      }

      return null;
    },
    [isCurrentRequest],
  );

  const finishRequest = useCallback((requestId: number) => {
    if (isCurrentRequest(requestId)) {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [isCurrentRequest]);

  const reset = useCallback(() => {
    invalidateCurrentRequest();
    setLoading(false);
    setData(null);
    setError(null);
  }, [invalidateCurrentRequest]);

  return {
    loading,
    data,
    error,
    beginRequest,
    setSuccess,
    setFailure,
    finishRequest,
    reset,
  };
}
