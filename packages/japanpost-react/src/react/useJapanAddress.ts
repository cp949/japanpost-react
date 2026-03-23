import { useCallback, useMemo, useState } from "react";
import type {
  UseJapanAddressOptions,
  UseJapanAddressResult,
} from "../core/types";
import { useJapanAddressSearch } from "./useJapanAddressSearch";
import { useJapanPostalCode } from "./useJapanPostalCode";

/**
 * 우편번호 조회와 키워드 주소 검색을 하나의 인터페이스로 제공하는 통합 훅.
 * 두 검색 모드가 공유하는 data source를 내부에서 재사용한다.
 */
export function useJapanAddress(
  options: UseJapanAddressOptions,
): UseJapanAddressResult {
  // 두 내부 훅이 동일한 data source를 사용하도록 useMemo로 공유
  const dataSource = useMemo(() => {
    if (options.dataSource) {
      return options.dataSource;
    }

    throw new Error("useJapanAddress requires options.dataSource");
  }, [options.dataSource]);

  // 우편번호 조회 훅 (디바운스 없음)
  const postalCode = useJapanPostalCode({ dataSource });
  // 키워드 주소 검색 훅 (debounceMs 옵션 전달)
  const addressSearch = useJapanAddressSearch({
    dataSource,
    debounceMs: options.debounceMs,
  });
  const resetPostalCode = postalCode.reset;
  const searchPostalCode = postalCode.search;
  const resetAddressSearch = addressSearch.reset;
  const searchAddressKeyword = addressSearch.search;

  // 마지막으로 실행된 검색 종류를 추적해 어떤 데이터를 노출할지 결정
  const [activeSearch, setActiveSearch] = useState<
    "postalCode" | "keyword" | null
  >(null);

  /**
   * 우편번호로 검색. 키워드 검색 상태를 초기화하고 우편번호 검색을 실행한다.
   */
  const searchByPostalCode = useCallback(async (value: string) => {
    resetAddressSearch(); // 이전 키워드 검색 결과 초기화
    setActiveSearch("postalCode");
    return searchPostalCode(value);
  }, [resetAddressSearch, searchPostalCode]);

  /**
   * 키워드로 검색. 우편번호 검색 상태를 초기화하고 키워드 검색을 실행한다.
   */
  const searchByKeyword = useCallback(async (query: string) => {
    resetPostalCode(); // 이전 우편번호 검색 결과 초기화
    setActiveSearch("keyword");
    return searchAddressKeyword(query);
  }, [resetPostalCode, searchAddressKeyword]);

  /**
   * 두 검색 상태를 모두 초기화한다.
   */
  const reset = useCallback(() => {
    resetPostalCode();
    resetAddressSearch();
    setActiveSearch(null);
  }, [resetAddressSearch, resetPostalCode]);

  // activeSearch에 따라 노출할 data와 error를 선택
  const data =
    activeSearch === "postalCode"
      ? postalCode.data
      : activeSearch === "keyword"
        ? addressSearch.data
        : null;
  const error =
    activeSearch === "postalCode"
      ? postalCode.error
      : activeSearch === "keyword"
        ? addressSearch.error
        : null;

  return {
    // 어느 한 쪽이라도 로딩 중이면 true
    loading: postalCode.loading || addressSearch.loading,
    data,
    error,
    reset,
    searchByPostalCode,
    searchByKeyword,
  };
}
