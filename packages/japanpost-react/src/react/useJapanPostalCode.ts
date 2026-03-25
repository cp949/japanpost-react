import { useCallback, useMemo } from "react";
import { createJapanAddressError } from "../core/errors";
import { normalizeJapanPostalCode } from "../core/formatters";
import type {
  JapanAddressDataSource,
  JapanAddressRequestOptions,
  JapanPostalCodeLookupResult,
  JapanPostalCodeSearchInput,
  UseJapanPostalCodeOptions,
  UseJapanPostalCodeResult,
} from "../core/types";
import { toJapanAddressError } from "./toJapanAddressError";
import { useLatestRequestState } from "./useLatestRequestState";

/**
 * useJapanPostalCode가 사용할 data source를 강제한다.
 * search 시점까지 미루지 않고 초기화 단계에서 계약 위반을 드러낸다.
 */
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
  // options.dataSource가 바뀔 때만 존재 여부 검증을 다시 수행한다.
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
    cancel,
    reset,
  } = useLatestRequestState<JapanPostalCodeLookupResult>();

  /**
   * 우편번호를 받아 주소를 조회한다.
   * 입력은 하이픈 포함 여부와 무관하게 숫자만 추출해 최소 3자리~최대 7자리까지 허용한다.
   * 언마운트되거나 더 최신 요청이 있으면 내부 상태 업데이트는 무시된다.
   */
  const search: UseJapanPostalCodeResult["search"] = useCallback(
    async (input: JapanPostalCodeSearchInput) => {
      const { requestId, signal } = beginRequest();

      try {
        const requestInput: Exclude<JapanPostalCodeSearchInput, string> =
          typeof input === "string" ? { postalCode: input } : input;
        // 표시 형식과 무관하게 data source 계약에는 숫자만 전달한다.
        const postalCode = normalizeJapanPostalCode(requestInput.postalCode);

        if (!/^\d{3,7}$/.test(postalCode)) {
          throw createJapanAddressError(
            "invalid_postal_code",
            "Postal code must contain between 3 and 7 digits",
          );
        }

        const requestOptions: JapanAddressRequestOptions = {
          signal,
        };
        // pager 반환 계약을 유지하기 위해 기본 page 정보를 항상 채운다.
        const request = {
          postalCode,
          pageNumber: requestInput.pageNumber ?? 0,
          rowsPerPage: requestInput.rowsPerPage ?? 100,
          ...(requestInput.includeParenthesesTown === undefined
            ? {}
            : {
                includeParenthesesTown: requestInput.includeParenthesesTown,
              }),
        };
        const result = await dataSource.lookupPostalCode(
          request,
          requestOptions,
        );
        if (signal.aborted) {
          return null;
        }
        setSuccess(requestId, result);
        return result;
      } catch (caughtError) {
        if (signal.aborted) {
          return null;
        }
        // data source 구현별 예외를 라이브러리 공개 에러 형태로 맞춘다.
        return setFailure(requestId, toJapanAddressError(caughtError));
      } finally {
        finishRequest(requestId);
      }
    },
    [beginRequest, dataSource, finishRequest, setFailure, setSuccess],
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
