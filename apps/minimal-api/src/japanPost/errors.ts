/**
 * minimal-api 내부 계층들이 공통으로 쓰는 HTTP 성격의 에러 타입이다.
 * 실제 http 응답으로 내릴 statusCode를 함께 들고 다녀 라우팅 계층이 단순해진다.
 */
export type AdapterHttpError = Error & {
  cause?: unknown;
  statusCode: number;
};

export function createHttpError(
  statusCode: number,
  message: string,
  cause?: unknown,
): AdapterHttpError {
  // Error에 statusCode/cause를 부착해 transport 계층까지 전달 가능한 형태로 만든다.
  const error = new Error(message) as AdapterHttpError;
  error.name = "AdapterHttpError";
  error.statusCode = statusCode;

  if (cause !== undefined) {
    error.cause = cause;
  }

  return error;
}

export function isAdapterHttpError(error: unknown): error is AdapterHttpError {
  // instanceof 대신 구조 기반 판별을 써 서로 다른 모듈 경계에서도 안정적으로 좁힌다.
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (error as AdapterHttpError).statusCode === "number"
  );
}
