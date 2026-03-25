import { useCallback, useMemo } from "react";
import { normalizeJapanPostalCode } from "../core/formatters";
import { createJapanAddressError } from "../core/errors";
import type {
  JapanAddressDataSource,
  JapanPostalCodeLookupResult,
  JapanAddressRequestOptions,
  JapanPostalCodeSearchInput,
  UseJapanPostalCodeOptions,
  UseJapanPostalCodeResult,
} from "../core/types";
import { toJapanAddressError } from "./toJapanAddressError";
import { useLatestRequestState } from "./useLatestRequestState";

/**
 * useJapanPostalCode가 사용할 data source를 강제한다.
 * 훅 내부에서는 존재를 전제로 동작하므로 초기에 명확하게 실패시키는 편이 디버깅이 쉽다.
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
  // dataSource 참조가 바뀔 때만 새 인스턴스를 쓰도록 고정해 불필요한 훅 내부 리셋을 줄인다.
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
        // 사용자가 입력한 표시 형식을 그대로 계약으로 넘기지 않고 숫자만 남긴다.
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
        // pageNumber/rowsPerPage는 공개 결과가 pager payload라는 계약을 유지하기 위해 항상 명시한다.
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
        // data source가 어떤 형태의 예외를 던지더라도 라이브러리 공개 에러 형태로 맞춘다.
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
