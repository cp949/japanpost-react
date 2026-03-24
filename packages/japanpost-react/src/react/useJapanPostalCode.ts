import { useCallback, useMemo } from "react";
import { normalizeJapanPostalCode } from "../core/formatters";
import { createJapanAddressError } from "../core/errors";
import type {
  JapanAddressDataSource,
  JapanPostalCodeLookupResult,
  JapanAddressRequestOptions,
  UseJapanPostalCodeOptions,
  UseJapanPostalCodeResult,
} from "../core/types";
import { toJapanAddressError } from "./toJapanAddressError";
import { useLatestRequestState } from "./useLatestRequestState";

function resolvePostalCodeDataSource(dataSource?: JapanAddressDataSource) {
  if (dataSource) {
    return dataSource;
  }

  throw new Error("useJapanPostalCode requires options.dataSource");
}

/**
 * 일본 우편번호로 주소를 조회하는 훅.
 * loading / data / error 상태와 search / reset 함수를 제공한다.
 */
export function useJapanPostalCode(
  options: UseJapanPostalCodeOptions,
): UseJapanPostalCodeResult {
  // 클라이언트가 매 렌더마다 재생성되지 않도록 useMemo로 캐싱
  const dataSource = useMemo(
    () => resolvePostalCodeDataSource(options.dataSource),
    [options.dataSource],
  );

  const {
    loading,
    data,
    error,
    beginRequest,
    setSuccess,
    setFailure,
    finishRequest,
    reset,
  } = useLatestRequestState<JapanPostalCodeLookupResult>();

  /**
   * 우편번호를 받아 주소를 조회한다.
   * 언마운트되거나 더 최신 요청이 있으면 상태를 업데이트하지 않는다.
   */
  const search = useCallback(async (value: string) => {
    const { requestId, signal } = beginRequest();

    try {
      const postalCode = normalizeJapanPostalCode(value);

      if (!/^\d{3,7}$/.test(postalCode)) {
        throw createJapanAddressError(
          "invalid_postal_code",
          "Postal code must contain between 3 and 7 digits",
        );
      }

      const requestOptions: JapanAddressRequestOptions = {
        signal,
      };
      const result = await dataSource.lookupPostalCode(
        postalCode,
        requestOptions,
      );
      setSuccess(requestId, result);
      return result;
    } catch (caughtError) {
      return setFailure(requestId, toJapanAddressError(caughtError));
    } finally {
      finishRequest(requestId);
    }
  }, [beginRequest, dataSource, finishRequest, setFailure, setSuccess]);

  return {
    loading,
    data,
    error,
    reset,
    search,
  };
}
