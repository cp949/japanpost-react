import type { JapanAddressError, JapanAddressErrorCode } from "./types";

/**
 * 라이브러리 전용 에러 객체를 생성한다.
 * name과 code를 일관되게 설정해 catch 블록에서 타입 좁히기가 쉽도록 한다.
 */
export function createJapanAddressError(
  code: JapanAddressErrorCode,
  message: string,
  options?: { cause?: unknown; status?: number },
): JapanAddressError {
  // 일반 Error를 생성한 뒤 라이브러리 전용 필드를 추가한다
  const error = new Error(message) as JapanAddressError;
  error.name = "JapanAddressError"; // instanceof 대신 name으로 식별
  error.code = code;                // 세분화된 오류 코드
  error.cause = options?.cause;     // 원인이 된 원본 에러 (있는 경우)
  error.status = options?.status;   // HTTP 상태 코드 (있는 경우)
  return error;
}
