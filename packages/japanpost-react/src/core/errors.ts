import type { JapanAddressError, JapanAddressErrorCode } from "./types";

/**
 * 라이브러리 전반에서 공통으로 쓰는 오류 객체 생성기다.
 * 브라우저 fetch 오류, validation 오류, data source 오류를 모두 같은 표면으로 맞춰
 * 소비자가 code/status만으로 분기할 수 있게 한다.
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
