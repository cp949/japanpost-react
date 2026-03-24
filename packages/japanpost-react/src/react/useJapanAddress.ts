import { useCallback, useMemo, useState } from "react";
import type {
  UseJapanAddressOptions,
  UseJapanAddressResult,
} from "../core/types";
import { useJapanAddressSearch } from "./useJapanAddressSearch";
import { useJapanPostalCode } from "./useJapanPostalCode";

/**
 * 우편번호 조회와 키워드 주소 검색을 하나의 인터페이스로 제공하는 통합 훅.
 * 두 검색 모드가 공유하는 data source를 내부에서 재사용하고,
 * 마지막으로 실행된 검색 종류만 외부에 노출해 두 결과가 섞이지 않도록 한다.
 */
export function useJapanAddress(
  options: UseJapanAddressOptions,
): UseJapanAddressResult {
  // 두 내부 훅이 서로 다른 data source를 참조하면 결과 비교가 무의미해지므로 동일 참조를 공유한다.
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

  // 마지막으로 실행된 검색 종류를 추적해 "통합 훅의 현재 결과"를 결정한다.
  const [activeSearch, setActiveSearch] = useState<
    "postalCode" | "keyword" | null
  >(null);

  /**
   * 우편번호로 검색한다.
   * 이전 키워드 결과를 먼저 지워야 검색 전환 직후에도 화면이 새 모드 기준으로 일관되게 보인다.
   */
  const searchByPostalCode = useCallback(async (value: string) => {
    resetAddressSearch();
    setActiveSearch("postalCode");
    return searchPostalCode(value);
  }, [resetAddressSearch, searchPostalCode]);

  /**
   * 키워드로 검색한다.
   * 반대쪽 검색 상태를 비워 이전 모드의 error/data가 현재 모드에 남지 않게 한다.
   */
  const searchByKeyword = useCallback(async (query: string) => {
    resetPostalCode();
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

  // 통합 훅은 마지막 검색 모드 기준 결과만 공개한다.
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
    // 사용자는 현재 활성 모드만 보더라도, 내부에서는 두 훅 중 하나라도 정리 중이면 로딩으로 본다.
    loading: postalCode.loading || addressSearch.loading,
    data,
    error,
    reset,
    searchByPostalCode,
    searchByKeyword,
  };
}
