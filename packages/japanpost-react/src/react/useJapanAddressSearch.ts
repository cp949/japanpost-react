import { useCallback, useEffect, useMemo, useRef } from "react";
import { createJapanAddressError } from "../core/errors";
import type {
  JapanAddressDataSource,
  JapanAddressRequestOptions,
  JapanAddressSearchResult,
  UseJapanAddressSearchOptions,
  UseJapanAddressSearchResult,
} from "../core/types";
import { toJapanAddressError } from "./toJapanAddressError";
import { useLatestRequestState } from "./useLatestRequestState";

function resolveAddressSearchDataSource(dataSource?: JapanAddressDataSource) {
  if (dataSource) {
    return dataSource;
  }

  throw new Error("useJapanAddressSearch requires options.dataSource");
}

/**
 * 자유 형식 키워드로 일본 주소를 검색하는 훅.
 * 디바운스를 지원하며 loading / data / error 상태와 search / reset 함수를 제공한다.
 */
export function useJapanAddressSearch(
  options: UseJapanAddressSearchOptions,
): UseJapanAddressSearchResult {
  // 클라이언트를 useMemo로 캐싱해 불필요한 재생성 방지
  const dataSource = useMemo(
    () => resolveAddressSearchDataSource(options.dataSource),
    [options.dataSource],
  );

  // debounceMs가 없거나 0이면 디바운스 없이 즉시 실행
  const debounceMs = options.debounceMs ?? 0;

  // 진행 중인 디바운스 타이머 ID
  const timeoutRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(
    null,
  );
  // 디바운스 중 Promise resolve 함수를 저장해 취소 시 null로 해소
  const pendingResolveRef = useRef<
    ((value: JapanAddressSearchResult | null) => void) | null
  >(null);

  const {
    loading,
    data,
    error,
    beginRequest,
    setSuccess,
    setFailure,
    finishRequest,
    reset: resetRequestState,
  } = useLatestRequestState<JapanAddressSearchResult>();

  /**
   * 대기 중인 디바운스 타이머를 취소하고 pending Promise를 주어진 result로 해소한다.
   * reset이나 새로운 search 호출 시 이전 디바운스를 정리하기 위해 사용한다.
   */
  const clearPendingDebounce = useCallback(
    (result: JapanAddressSearchResult | null) => {
      if (timeoutRef.current !== null) {
        globalThis.clearTimeout(timeoutRef.current); // 타이머 취소
        timeoutRef.current = null;
      }

      // 대기 중인 Promise를 null로 해소해 메모리 누수 방지
      pendingResolveRef.current?.(result);
      pendingResolveRef.current = null;
    },
    [],
  );

  useEffect(() => {
    return () => {
      clearPendingDebounce(null);
    };
  }, [clearPendingDebounce]);

  /**
   * 모든 상태를 초기화하고 진행 중인 디바운스·요청을 무효화한다.
   */
  const reset = useCallback(() => {
    clearPendingDebounce(null);
    resetRequestState();
  }, [clearPendingDebounce, resetRequestState]);

  /**
   * 실제 API 호출을 수행하는 내부 함수.
   * 마운트 상태와 요청 ID를 확인해 오래된 응답을 무시한다.
   */
  const runSearch = useCallback(async (
    requestId: number,
    signal: AbortSignal,
    query: string,
  ): Promise<JapanAddressSearchResult | null> => {
    try {
      const normalizedQuery = query.trim();

      if (!normalizedQuery) {
        throw createJapanAddressError(
          "invalid_query",
          "Address query is required",
        );
      }

      const requestOptions: JapanAddressRequestOptions = {
        signal,
      };
      const result = await dataSource.searchAddress(
        normalizedQuery,
        requestOptions,
      );
      setSuccess(requestId, result);
      return result;
    } catch (caughtError) {
      return setFailure(requestId, toJapanAddressError(caughtError));
    } finally {
      finishRequest(requestId);
    }
  }, [dataSource, finishRequest, setFailure, setSuccess]);

  /**
   * 키워드 검색을 시작한다.
   * debounceMs > 0 이면 지정된 시간만큼 지연 후 API를 호출한다.
   * 지연 중에 새 검색이 들어오면 이전 타이머는 취소된다.
   */
  const search = useCallback((query: string): Promise<JapanAddressSearchResult | null> => {
    const { requestId, signal } = beginRequest();
    // 이전 디바운스 취소
    clearPendingDebounce(null);

    // 디바운스가 없으면 즉시 API 호출
    if (debounceMs <= 0) {
      return runSearch(requestId, signal, query);
    }

    // 디바운스: 지정된 시간 후에 API 호출, 그 사이에 취소될 경우 null 반환
    return new Promise((resolve) => {
      // resolve를 ref에 저장해 clearPendingDebounce에서 접근 가능하게 함
      pendingResolveRef.current = resolve;
      timeoutRef.current = globalThis.setTimeout(() => {
        timeoutRef.current = null;
        const pendingResolve = pendingResolveRef.current;
        pendingResolveRef.current = null;
        // 디바운스 종료 후 실제 검색 실행, 결과를 저장된 resolve로 전달
        void runSearch(requestId, signal, query).then((result) => {
          pendingResolve?.(result);
        });
      }, debounceMs);
    });
  }, [beginRequest, clearPendingDebounce, debounceMs, runSearch]);

  return {
    loading,
    data,
    error,
    reset,
    search,
  };
}
