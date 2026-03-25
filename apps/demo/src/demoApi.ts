import type {
  JapanAddress,
  JapanAddressDataSource,
  JapanAddressRequestOptions,
  JapanPostAddresszipRequest,
  JapanPostSearchcodeRequest,
  Page,
} from "@cp949/japanpost-react";
import { createJapanAddressError } from "@cp949/japanpost-react";

// 데모 앱은 기본적으로 Vite 개발 서버 프록시 아래의 `/minimal-api` 를 바라본다.
export const DEFAULT_DEMO_API_BASE_URL = "/minimal-api";

export type DemoApiHealth =
  | {
      ok: true;
    }
  | {
      ok: false;
      error?: string;
    };

export function normalizeBaseUrl(value: string): string {
  // 호출부에서 슬래시 유무를 신경 쓰지 않도록 끝의 `/` 를 제거한다.
  return value.replace(/\/+$/, "");
}

function createDemoApiHealthError(message: string, cause?: unknown): Error {
  // health 체크는 라이브러리 에러 타입과 별개로 다루므로 일반 Error를 생성한다.
  const error = new Error(message);

  if (cause !== undefined) {
    (error as Error & { cause?: unknown }).cause = cause;
  }

  return error;
}

function isAbortError(error: unknown): error is DOMException {
  return error instanceof DOMException && error.name === "AbortError";
}

function isNetworkError(error: unknown): error is TypeError {
  return error instanceof TypeError;
}

function ensurePagerPayload(payload: unknown): Page<JapanAddress> {
  // 최소한의 런타임 검증으로 응답이 페이지네이션 구조를 갖췄는지 확인한다.
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("elements" in payload) ||
    !Array.isArray((payload as { elements?: unknown }).elements) ||
    typeof (payload as { totalElements?: unknown }).totalElements !==
      "number" ||
    typeof (payload as { pageNumber?: unknown }).pageNumber !== "number" ||
    typeof (payload as { rowsPerPage?: unknown }).rowsPerPage !== "number"
  ) {
    throw createJapanAddressError(
      "bad_response",
      "Response payload must include a valid page payload",
    );
  }

  return payload as Page<JapanAddress>;
}

function resolveErrorCode(
  status: number,
  input: string,
):
  | "invalid_postal_code"
  | "invalid_query"
  | "not_found"
  | "timeout"
  | "data_source_error" {
  // 데모 API HTTP 상태 코드를 라이브러리에서 이해하는 도메인 에러 코드로 매핑한다.
  if (status === 404) {
    return "not_found";
  }

  if (status === 504) {
    return "timeout";
  }

  if (status === 400) {
    if (input.startsWith("/q/japanpost/searchcode")) {
      return "invalid_postal_code";
    }

    if (input.startsWith("/q/japanpost/addresszip")) {
      return "invalid_query";
    }
  }

  return "data_source_error";
}

function resolveDemoApiUrl(baseUrl: string, path: string): string {
  // 절대 URL 이면 URL 생성자를 사용하고, 상대 경로면 단순 문자열 결합으로 처리한다.
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(baseUrl)) {
    return String(new URL(path, `${baseUrl}/`));
  }

  return `${normalizeBaseUrl(baseUrl)}${path}`;
}

export async function readDemoApiHealth(
  baseUrl: string,
): Promise<DemoApiHealth> {
  let response: Response;

  try {
    // health 체크는 검색 기능과 독립적으로 서버 도달 가능성만 빠르게 확인한다.
    response = await fetch(resolveDemoApiUrl(baseUrl, "/health"));
  } catch (error) {
    throw createDemoApiHealthError(
      isAbortError(error) || isNetworkError(error)
        ? "Demo API server is unreachable"
        : "Demo API health check failed",
      error,
    );
  }

  if (!response.ok && response.status !== 503) {
    // 503 은 "기동 중/준비 중" 상태로 간주해 JSON 본문을 계속 읽는다.
    throw createDemoApiHealthError(
      `Health request failed with status ${response.status}`,
    );
  }

  try {
    return (await response.json()) as DemoApiHealth;
  } catch (error) {
    throw createDemoApiHealthError(
      "Demo API health response was not valid JSON",
      error,
    );
  }
}

export function createDemoApiDataSource(
  baseUrl: string,
): JapanAddressDataSource {
  async function readJson<T>(
    input: string,
    init: RequestInit,
    options?: JapanAddressRequestOptions,
  ): Promise<T> {
    let response: Response;

    try {
      // 라이브러리 훅이 넘긴 AbortSignal 을 그대로 전달해
      // 빠른 재검색이나 컴포넌트 언마운트 시 요청을 취소할 수 있게 한다.
      response = await fetch(resolveDemoApiUrl(baseUrl, input), {
        ...init,
        signal: options?.signal,
      });
    } catch (error) {
      throw createJapanAddressError(
        isAbortError(error) ? "timeout" : "network_error",
        isAbortError(error) ? "Request timed out" : "Network request failed",
        {
          cause: error,
        },
      );
    }

    if (!response.ok) {
      // HTTP 에러는 단순 실패가 아니라 훅이 분기할 수 있는 도메인 에러로 변환한다.
      throw createJapanAddressError(
        resolveErrorCode(response.status, input),
        `Request failed with status ${response.status}`,
        {
          status: response.status,
        },
      );
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      throw createJapanAddressError(
        "bad_response",
        "Response payload was not valid JSON",
        { cause: error },
      );
    }
  }

  return {
    async lookupPostalCode(
      request: JapanPostSearchcodeRequest,
      options?: JapanAddressRequestOptions,
    ) {
      // 우편번호 검색 엔드포인트는 데모 서버의 searchcode API 와 1:1 대응한다.
      return ensurePagerPayload(
        await readJson<unknown>(
          "/q/japanpost/searchcode",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify(request),
          },
          options,
        ),
      );
    },
    async searchAddress(
      request: JapanPostAddresszipRequest,
      options?: JapanAddressRequestOptions,
    ) {
      // 주소 키워드 검색 엔드포인트는 addresszip API 와 1:1 대응한다.
      return ensurePagerPayload(
        await readJson<unknown>(
          "/q/japanpost/addresszip",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify(request),
          },
          options,
        ),
      );
    },
  };
}
