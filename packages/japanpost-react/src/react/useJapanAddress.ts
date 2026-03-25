import { useCallback, useMemo, useState } from "react";
import type {
  UseJapanAddressOptions,
  UseJapanAddressResult,
} from "../core/types";
import { useJapanAddressSearch } from "./useJapanAddressSearch";
import { useJapanPostalCode } from "./useJapanPostalCode";

/**
 * 우편번호 조회와 주소 검색을 하나의 인터페이스로 제공하는 통합 훅.
 * 주소 검색은 키워드 문자열과 구조화된 주소 필드를 모두 지원하고,
 * 마지막으로 실행한 검색 모드만 외부 결과로 노출해 두 상태가 섞이지 않게 한다.
 */
export function useJapanAddress(
  options: UseJapanAddressOptions,
): UseJapanAddressResult {
  // 두 내부 훅이 같은 data source를 바라보게 고정한다.
  const dataSource = useMemo(() => {
    if (options.dataSource) {
      return options.dataSource;
    }

    throw new Error("useJapanAddress requires options.dataSource");
  }, [options.dataSource]);

  // 우편번호 조회는 즉시 실행된다.
  const postalCode = useJapanPostalCode({ dataSource });
  // 주소 검색은 필요하면 debounce를 적용한다.
  const addressSearch = useJapanAddressSearch({
    dataSource,
    debounceMs: options.debounceMs,
  });
  const resetPostalCode = postalCode.reset;
  const searchPostalCode = postalCode.search;
  const resetAddressSearch = addressSearch.reset;
  const searchAddressKeyword = addressSearch.search;

  // 마지막으로 실행한 검색 종류가 통합 훅의 현재 결과를 결정한다.
  const [activeSearch, setActiveSearch] = useState<
    "postalCode" | "addressQuery" | null
  >(null);

  /**
   * 우편번호로 검색한다.
   * 반대쪽 검색 상태를 먼저 비워 새 모드 기준으로 화면이 정렬되게 한다.
   */
  const searchByPostalCode: UseJapanAddressResult["searchByPostalCode"] =
    useCallback(
      async (input) => {
        resetAddressSearch();
        setActiveSearch("postalCode");
        return searchPostalCode(input);
      },
      [resetAddressSearch, searchPostalCode],
    );

  /**
   * 주소 질의 문자열 또는 구조화된 주소 필드로 검색한다.
   * 반대쪽 검색 상태를 먼저 비워 이전 모드의 data/error가 남지 않게 한다.
   */
  const searchByAddressQuery: UseJapanAddressResult["searchByAddressQuery"] =
    useCallback(
      async (input) => {
        resetPostalCode();
        setActiveSearch("addressQuery");
        return searchAddressKeyword(input);
      },
      [resetPostalCode, searchAddressKeyword],
    );

  /**
   * 두 검색 상태를 모두 초기화한다.
   */
  const reset = useCallback(() => {
    resetPostalCode();
    resetAddressSearch();
    setActiveSearch(null);
  }, [resetAddressSearch, resetPostalCode]);

  // 통합 훅은 마지막 검색 모드 기준 결과만 공개한다.
  const data =
    activeSearch === "postalCode"
      ? postalCode.data
      : activeSearch === "addressQuery"
        ? addressSearch.data
        : null;
  const error =
    activeSearch === "postalCode"
      ? postalCode.error
      : activeSearch === "addressQuery"
        ? addressSearch.error
        : null;

  return {
    // 외부에는 현재 모드만 보이더라도 내부 훅 둘 중 하나가 진행 중이면 loading으로 본다.
    loading: postalCode.loading || addressSearch.loading,
    data,
    error,
    reset,
    searchByPostalCode,
    searchByAddressQuery,
  };
}
