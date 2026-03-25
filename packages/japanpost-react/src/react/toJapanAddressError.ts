import { createJapanAddressError } from "../core/errors";
import type { JapanAddressError, JapanAddressErrorCode } from "../core/types";

const JAPAN_ADDRESS_ERROR_CODES = new Set<JapanAddressErrorCode>([
  "invalid_postal_code",
  "invalid_query",
  "network_error",
  "timeout",
  "not_found",
  "bad_response",
  "data_source_error",
]);

function isJapanAddressError(error: unknown): error is JapanAddressError {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const maybeError = error as { name?: unknown; code?: unknown };

  return (
    maybeError.name === "JapanAddressError" &&
    typeof maybeError.code === "string" &&
    JAPAN_ADDRESS_ERROR_CODES.has(maybeError.code as JapanAddressErrorCode)
  );
}

/**
 * 알 수 없는 에러를 JapanAddressError로 변환한다.
 * data source 구현이 라이브러리 전용 에러를 직접 던질 수도 있고 일반 Error를 던질 수도 있으므로,
 * 훅 바깥으로는 항상 같은 오류 계약만 보이게 맞춘다.
 */
export function toJapanAddressError(error: unknown): JapanAddressError {
  if (isJapanAddressError(error)) {
    return error;
  }

  return createJapanAddressError(
    "data_source_error",
    error instanceof Error ? error.message : "Unknown error",
    {
      cause: error,
    },
  );
}
