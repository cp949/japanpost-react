import { createJapanAddressError } from "../core/errors";
import type { JapanAddressError } from "../core/types";

/**
 * 알 수 없는 에러를 JapanAddressError로 변환한다.
 * 이미 JapanAddressError(code 필드를 가진 객체)이면 그대로 반환한다.
 */
export function toJapanAddressError(error: unknown): JapanAddressError {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return error as JapanAddressError;
  }

  return createJapanAddressError(
    "data_source_error",
    error instanceof Error ? error.message : "Unknown error",
    {
      cause: error,
    },
  );
}
