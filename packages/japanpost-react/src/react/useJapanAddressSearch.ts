import { useCallback, useEffect, useMemo, useRef } from "react";
import { createJapanAddressError } from "../core/errors";
import type {
  JapanAddressDataSource,
  JapanAddressRequestOptions,
  JapanAddressSearchInput,
  JapanAddressSearchResult,
  JapanPostAddresszipRequest,
  UseJapanAddressSearchOptions,
  UseJapanAddressSearchResult,
} from "../core/types";
import { toJapanAddressError } from "./toJapanAddressError";
import { useLatestRequestState } from "./useLatestRequestState";

/**
 * 주소 검색 훅에서 사용할 data source를 강제한다.
 * search 시점까지 미루지 않고 초기화 단계에서 계약 위반을 드러낸다.
 */
function resolveAddressSearchDataSource(dataSource?: JapanAddressDataSource) {
  if (dataSource) {
    return dataSource;
  }

  throw new Error("useJapanAddressSearch requires options.dataSource");
}

function normalizeSearchText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeAddressSearchInput(
  input: JapanAddressSearchInput,
): JapanPostAddresszipRequest | null {
  const request: Exclude<JapanAddressSearchInput, string> =
    typeof input === "string" ? { addressQuery: input } : input;
  const addressQuery = normalizeSearchText(request.addressQuery);
  const prefCode = normalizeSearchText(request.prefCode);
  const prefName = normalizeSearchText(request.prefName);
  const prefKana = normalizeSearchText(request.prefKana);
  const prefRoma = normalizeSearchText(request.prefRoma);
  const cityCode = normalizeSearchText(request.cityCode);
  const cityName = normalizeSearchText(request.cityName);
  const cityKana = normalizeSearchText(request.cityKana);
  const cityRoma = normalizeSearchText(request.cityRoma);
  const townName = normalizeSearchText(request.townName);
  const townKana = normalizeSearchText(request.townKana);
  const townRoma = normalizeSearchText(request.townRoma);

  if (
    addressQuery === undefined &&
    prefCode === undefined &&
    prefName === undefined &&
    prefKana === undefined &&
    prefRoma === undefined &&
    cityCode === undefined &&
    cityName === undefined &&
    cityKana === undefined &&
    cityRoma === undefined &&
    townName === undefined &&
    townKana === undefined &&
    townRoma === undefined
  ) {
    return null;
  }

  return {
    ...(addressQuery === undefined ? {} : { addressQuery }),
    ...(prefCode === undefined ? {} : { prefCode }),
    ...(prefName === undefined ? {} : { prefName }),
    ...(prefKana === undefined ? {} : { prefKana }),
    ...(prefRoma === undefined ? {} : { prefRoma }),
    ...(cityCode === undefined ? {} : { cityCode }),
    ...(cityName === undefined ? {} : { cityName }),
    ...(cityKana === undefined ? {} : { cityKana }),
    ...(cityRoma === undefined ? {} : { cityRoma }),
    ...(townName === undefined ? {} : { townName }),
    ...(townKana === undefined ? {} : { townKana }),
    ...(townRoma === undefined ? {} : { townRoma }),
    pageNumber: request.pageNumber ?? 0,
    rowsPerPage: request.rowsPerPage ?? 100,
    ...(request.includeCityDetails === undefined
      ? {}
      : {
          includeCityDetails: request.includeCityDetails,
        }),
    ...(request.includePrefectureDetails === undefined
      ? {}
      : {
          includePrefectureDetails: request.includePrefectureDetails,
        }),
  };
}

function waitForAbort(signal: AbortSignal) {
  if (signal.aborted) {
    return Promise.resolve(null);
  }

  return new Promise<null>((resolve) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      resolve(null);
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * 자유 형식 검색어 또는 구조화된 주소 필드로 일본 주소를 검색하는 훅.
 * 디바운스를 지원하며 loading / data / error 상태와 search / reset 함수를 제공한다.
 */
export function useJapanAddressSearch(
  options: UseJapanAddressSearchOptions,
): UseJapanAddressSearchResult {
  // debounce 대기 중에도 같은 data source를 참조하도록 고정한다.
  const dataSource = useMemo(
    () => resolveAddressSearchDataSource(options.dataSource),
    [options.dataSource],
  );

  // 0 이하면 즉시 호출 모드로 본다.
  const debounceMs = options.debounceMs ?? 0;

  // 아직 실제 요청으로 넘어가지 않은 디바운스 타이머를 추적한다.
  const timeoutRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(
    null,
  );
  // search는 항상 Promise를 반환하므로 취소된 디바운스도 resolve 되어야 한다.
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
    cancel: cancelRequestState,
    reset: resetRequestState,
  } = useLatestRequestState<JapanAddressSearchResult>();

  /**
   * 대기 중인 디바운스 타이머를 취소하고 pending Promise를 주어진 result로 해소한다.
   * 새 search나 reset 시 이전 Promise가 영원히 pending 상태로 남지 않게 한다.
   */
  const clearPendingDebounce = useCallback(
    (result: JapanAddressSearchResult | null) => {
      if (timeoutRef.current !== null) {
        globalThis.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // 호출자 입장에서는 취소도 정상 종료(null)처럼 보이게 맞춘다.
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
   * 현재 활성 요청과 대기 중인 디바운스를 취소한다.
   * 이미 settled 된 data/error는 유지한다.
   */
  const cancel = useCallback(() => {
    clearPendingDebounce(null);
    cancelRequestState();
  }, [clearPendingDebounce, cancelRequestState]);

  /**
   * 실제 API 호출을 수행하는 내부 함수.
   * 최신 요청만 상태에 반영하는 판단은 `useLatestRequestState`에 맡긴다.
   */
  const runSearch = useCallback(
    async (
      requestId: number,
      signal: AbortSignal,
      request: JapanPostAddresszipRequest,
    ): Promise<JapanAddressSearchResult | null> => {
      try {
        const requestOptions: JapanAddressRequestOptions = {
          signal,
        };
        const searchPromise = dataSource.searchAddress(request, requestOptions);
        const result = await Promise.race([
          searchPromise,
          waitForAbort(signal),
        ]);
        if (signal.aborted || result === null) {
          return null;
        }
        setSuccess(requestId, result);
        return result;
      } catch (caughtError) {
        if (signal.aborted) {
          return null;
        }
        return setFailure(requestId, toJapanAddressError(caughtError));
      } finally {
        finishRequest(requestId);
      }
    },
    [dataSource, finishRequest, setFailure, setSuccess],
  );

  /**
   * 주소 검색을 시작한다.
   * debounceMs > 0 이면 지정된 시간만큼 지연 후 API를 호출한다.
   * 지연 중에 새 검색이 들어오면 이전 타이머는 취소되고, 이전 Promise는 null로 종료된다.
   */
  const search = useCallback(
    (
      input: JapanAddressSearchInput,
    ): Promise<JapanAddressSearchResult | null> => {
      const request = normalizeAddressSearchInput(input);
      const { requestId, signal } = beginRequest();
      // 새 요청이 들어오면 아직 실행 전인 이전 검색은 superseded 처리한다.
      clearPendingDebounce(null);

      if (request === null) {
        const result = setFailure(
          requestId,
          createJapanAddressError("invalid_query", "Address query is required"),
        );
        finishRequest(requestId);
        return Promise.resolve(result);
      }

      // 디바운스를 쓰지 않아도 반환 타입은 동일하게 유지한다.
      if (debounceMs <= 0) {
        return new Promise((resolve) => {
          pendingResolveRef.current = resolve;
          void runSearch(requestId, signal, request).then((result) => {
            resolve(result);
            if (pendingResolveRef.current === resolve) {
              pendingResolveRef.current = null;
            }
          });
        });
      }

      // 지정된 시간이 지나면 실제 네트워크 요청을 시작한다.
      return new Promise((resolve) => {
        pendingResolveRef.current = resolve;
        timeoutRef.current = globalThis.setTimeout(() => {
          timeoutRef.current = null;
          const pendingResolve = pendingResolveRef.current;
          pendingResolveRef.current = null;
          // 타이머 이후에도 requestId/signal은 그대로라 최신 요청 판정이 유지된다.
          void runSearch(requestId, signal, request).then((result) => {
            pendingResolve?.(result);
          });
        }, debounceMs);
      });
    },
    [
      beginRequest,
      clearPendingDebounce,
      debounceMs,
      finishRequest,
      runSearch,
      setFailure,
    ],
  );

  return {
    loading,
    data,
    error,
    cancel,
    reset,
    search,
  };
}
