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

/**
 * 키워드 검색 훅에서 사용할 data source를 강제한다.
 * search 실행 시점까지 미루지 않고 훅 초기화 단계에서 실패시켜 계약 위반을 빨리 드러낸다.
 */
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
  // data source가 안정적이어야 debounce 중에도 같은 업스트림 계약으로 요청을 보낸다.
  const dataSource = useMemo(
    () => resolveAddressSearchDataSource(options.dataSource),
    [options.dataSource],
  );

  // 0 이하면 "검색 버튼/엔터 즉시 호출" 모드로 간주한다.
  const debounceMs = options.debounceMs ?? 0;

  // 아직 실제 네트워크 요청으로 승격되지 않은 디바운스 타이머를 추적한다.
  const timeoutRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(
    null,
  );
  // search는 항상 Promise를 반환하므로, 디바운스 중 취소된 호출도 resolve 경로를 가져야 한다.
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
   * reset이나 새로운 search 호출 시 이전 디바운스를 정리하기 위해 사용하며,
   * resolve를 호출해 두어 호출자 Promise가 영원히 대기 상태로 남지 않게 한다.
   */
  const clearPendingDebounce = useCallback(
    (result: JapanAddressSearchResult | null) => {
      if (timeoutRef.current !== null) {
        globalThis.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // 디바운스가 취소되어도 호출자 입장에서는 "취소됨(null)"으로 종료되게 맞춘다.
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
   * 빈 문자열은 서버 호출 전에 차단하고, 실제 상태 반영은 useLatestRequestState가 최신 요청에만 허용한다.
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
      // searchAddress 역시 통일된 pager 계약을 유지하기 위해 첫 페이지/rowsPerPage를 명시한다.
      const request = {
        freeword: normalizedQuery,
        pageNumber: 0,
        rowsPerPage: 100,
      };
      const result = await dataSource.searchAddress(
        request,
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
   * 지연 중에 새 검색이 들어오면 이전 타이머는 취소되고, 이전 Promise는 null로 종료된다.
   */
  const search = useCallback((query: string): Promise<JapanAddressSearchResult | null> => {
    const { requestId, signal } = beginRequest();
    // 새 요청이 들어오면 아직 실행 전인 이전 검색은 superseded 처리한다.
    clearPendingDebounce(null);

    // 디바운스를 쓰지 않는 소비자도 동일한 반환 타입을 사용한다.
    if (debounceMs <= 0) {
      return runSearch(requestId, signal, query);
    }

    // 디바운스: 지정된 시간 후 실제 네트워크 요청으로 승격한다.
    return new Promise((resolve) => {
      pendingResolveRef.current = resolve;
      timeoutRef.current = globalThis.setTimeout(() => {
        timeoutRef.current = null;
        const pendingResolve = pendingResolveRef.current;
        pendingResolveRef.current = null;
        // 타이머가 끝난 시점에도 requestId/signal은 유지되어 최신 요청 판정이 계속 유효하다.
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
