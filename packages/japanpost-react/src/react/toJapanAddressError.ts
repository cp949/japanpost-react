import { createJapanAddressError } from "../core/errors";
import type { JapanAddressError } from "../core/types";

/**
 * 알 수 없는 에러를 JapanAddressError로 변환한다.
 * data source 구현이 라이브러리 전용 에러를 직접 던질 수도 있고 일반 Error를 던질 수도 있으므로,
 * 훅 바깥으로는 항상 같은 오류 계약만 보이게 맞춘다.
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
