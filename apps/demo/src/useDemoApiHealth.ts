import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { readDemoApiHealth, type DemoApiHealth } from "./demoApi";
import {
  getDemoApiStatusView,
  type DemoApiStatusView,
} from "./demoApiStatusView";

export type UseDemoApiHealthResult = {
  apiHealth: DemoApiHealth | null;
  apiHealthError: string | null;
  apiHealthLoading: boolean;
  apiReady: boolean;
  apiStatusView: DemoApiStatusView;
  retryHealthCheck: () => void;
};

export function useDemoApiHealth(
  baseUrl: string,
  searchLoading: boolean,
): UseDemoApiHealthResult {
  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const [apiHealth, setApiHealth] = useState<DemoApiHealth | null>(null);
  const [apiHealthError, setApiHealthError] = useState<string | null>(null);
  const [apiHealthLoading, setApiHealthLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  const loadApiHealth = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    if (!isMountedRef.current || requestId !== requestIdRef.current) {
      return;
    }

    setApiHealthLoading(true);

    try {
      const health = await readDemoApiHealth(baseUrl);

      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setApiHealth(health);
      setApiHealthError(null);
    } catch (error) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setApiHealth(null);
      setApiHealthError(
        error instanceof Error
          ? error.message
          : "Demo API server is unreachable",
      );
    } finally {
      if (isMountedRef.current && requestId === requestIdRef.current) {
        setApiHealthLoading(false);
        setRetrying(false);
      }
    }
  }, [baseUrl]);

  useEffect(() => {
    isMountedRef.current = true;
    void loadApiHealth();

    return () => {
      isMountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, [loadApiHealth]);

  const apiStatusView = useMemo(
    () =>
      getDemoApiStatusView({
        loading: apiHealthLoading,
        health: apiHealth,
        error: apiHealthError,
        searchLoading,
        retrying,
      }),
    [
      apiHealthLoading,
      apiHealth,
      apiHealthError,
      searchLoading,
      retrying,
    ],
  );

  return {
    apiHealth,
    apiHealthError,
    apiHealthLoading,
    apiReady: apiHealth?.ok === true,
    apiStatusView,
    retryHealthCheck() {
      requestIdRef.current += 1;
      setApiHealthLoading(true);
      setRetrying(true);
      void loadApiHealth();
    },
  };
}
