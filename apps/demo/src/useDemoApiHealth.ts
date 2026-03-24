import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { readDemoApiHealth, type DemoApiHealth } from "./demoApi";
import {
  getDemoApiStatusView,
  type DemoApiStatusView,
} from "./demoApiStatusView";

/**
 * 데모 앱에서 GET /health 상태를 추적하는 전용 훅이다.
 * 주소 검색 로딩과는 별도로 서버 준비 상태를 관리해 버튼 활성화와 안내 문구를 안정적으로 제어한다.
 */
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
  // 언마운트 이후 느리게 끝난 health 체크가 setState 하지 않도록 막는다.
  const isMountedRef = useRef(true);
  // baseUrl 변경이나 재시도 시 최신 health 체크만 반영하기 위한 논리 시계다.
  const requestIdRef = useRef(0);
  const [apiHealth, setApiHealth] = useState<DemoApiHealth | null>(null);
  const [apiHealthError, setApiHealthError] = useState<string | null>(null);
  const [apiHealthLoading, setApiHealthLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  const loadApiHealth = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    // effect 정리 직후 이어지는 오래된 비동기 흐름을 한 번 더 차단한다.
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

      // 실패 시 이전 성공 결과를 비워 검색 가능 상태가 잘못 남지 않게 한다.
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
      // cleanup 이후 끝난 요청이 최신 결과를 덮지 못하게 requestId를 폐기한다.
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
      // 명시적 재시도는 현재 health 흐름을 supersede하고 상태 문구를 재시도 모드로 전환한다.
      requestIdRef.current += 1;
      setApiHealthLoading(true);
      setRetrying(true);
      void loadApiHealth();
    },
  };
}
