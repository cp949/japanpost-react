import { useCallback, useEffect, useRef, useState } from "react";
import type { JapanAddressError } from "../core/types";

/**
 * 개별 검색 훅에서 공통으로 사용하는 "최신 요청 우선(last request wins)" 상태 관리 훅이다.
 * 같은 훅 인스턴스 안에서 요청이 겹치면 가장 마지막 요청만 성공/실패 상태를 반영하고,
 * 이전 요청은 AbortSignal과 requestId 비교를 함께 사용해 조용히 무효화한다.
 */
type BeginRequestResult = {
  requestId: number;
  signal: AbortSignal;
};

export function useLatestRequestState<TResult>() {
  // requestId는 "어떤 요청이 최신인지"를 판별하는 논리 시계 역할을 한다.
  const requestIdRef = useRef(0);
  // 언마운트 이후 setState를 막기 위한 안전장치다.
  const isMountedRef = useRef(true);
  // 새 요청이 시작될 때 직전 요청을 취소하기 위해 현재 AbortController를 보관한다.
  const abortControllerRef = useRef<AbortController | null>(null);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TResult | null>(null);
  const [error, setError] = useState<JapanAddressError | null>(null);

  const isCurrentRequest = useCallback((requestId: number) => {
    return isMountedRef.current && requestId === requestIdRef.current;
  }, []);

  const invalidateCurrentRequest = useCallback(() => {
    // ID를 먼저 증가시켜 이후에 도착하는 오래된 응답이 현재 요청으로 오인되지 않게 한다.
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
    // 새 요청이 시작될 때마다 새 requestId를 발급해 상태 경합을 끊는다.
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    // 직전 요청이 아직 진행 중이면 취소해 서버/브라우저 자원 낭비를 줄인다.
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // 새 요청은 이전 error를 지우고 loading으로 전환하되,
    // data는 성공/실패가 확정될 때까지 유지해 화면이 깜빡이지 않도록 한다.
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
        // 실패 시에는 마지막 성공 데이터를 비워 "오래된 정상 데이터 + 최신 오류"가 섞여 보이지 않게 한다.
        setError(nextError);
        setData(null);
      }

      // 상위 훅에서 catch 결과를 그대로 반환할 수 있도록 null을 돌려준다.
      return null;
    },
    [isCurrentRequest],
  );

  const cancel = useCallback(() => {
    // cancel은 진행 중인 요청만 무효화하고, 마지막으로 settled 된 결과는 그대로 남긴다.
    invalidateCurrentRequest();
    setLoading(false);
  }, [invalidateCurrentRequest]);

  const finishRequest = useCallback((requestId: number) => {
    if (isCurrentRequest(requestId)) {
      // 최신 요청만 loading을 해제해야 오래된 요청의 finally가 현재 로딩을 끄지 않는다.
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [isCurrentRequest]);

  const reset = useCallback(() => {
    // reset은 cancel과 달리 데이터와 에러까지 비워 완전 초기 상태로 되돌린다.
    cancel();
    setData(null);
    setError(null);
  }, [cancel]);

  return {
    loading,
    data,
    error,
    beginRequest,
    setSuccess,
    setFailure,
    finishRequest,
    cancel,
    reset,
  };
}
