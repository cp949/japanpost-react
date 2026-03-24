import type {
  JapanAddress,
  JapanAddressDataSource,
  JapanPostAddresszipRequest,
  JapanPostSearchcodeRequest,
  JapanAddressRequestOptions,
  Page,
} from "@cp949/japanpost-react";
import { createJapanAddressError } from "@cp949/japanpost-react";

/**
 * 데모 앱이 minimal-api와 통신할 때 사용하는 경계 모듈이다.
 * 브라우저 fetch 응답을 japanpost-react의 data source 계약으로 맞추고,
 * 데모 전용 health 체크도 같은 네트워크 해석 규칙으로 묶는다.
 */
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
  // 후행 슬래시를 제거해 상대 경로/절대 경로 모두 일관되게 이어붙인다.
  return value.replace(/\/+$/, "");
}

function createDemoApiHealthError(message: string, cause?: unknown): Error {
  const error = new Error(message);

  if (cause !== undefined) {
    (error as Error & { cause?: unknown }).cause = cause;
  }

  return error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

/**
 * minimal-api 응답이 라이브러리 공개 pager 계약을 지키는지 검증한다.
 * 데모는 샘플 소비자 역할도 하므로 응답 형식 이상을 조용히 통과시키지 않는다.
 */
function ensurePagerPayload(
  payload: unknown,
): Page<JapanAddress> {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("elements" in payload) ||
    !Array.isArray((payload as { elements?: unknown }).elements) ||
    typeof (payload as { totalElements?: unknown }).totalElements !== "number" ||
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
  // minimal-api는 route마다 400 의미가 다르므로 라이브러리 오류 코드로 다시 매핑한다.
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
  // 절대 URL이면 URL 생성자에 맡기고, 상대 경로면 프록시 경로를 보존한다.
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(baseUrl)) {
    return String(new URL(path, `${baseUrl}/`));
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  return `${normalizedBaseUrl}${path}`;
}

export async function readDemoApiHealth(
  baseUrl: string,
): Promise<DemoApiHealth> {
  let response: Response;

  try {
    response = await fetch(resolveDemoApiUrl(baseUrl, "/health"));
  } catch (error) {
    // health는 검색 가능 여부 판정에 직접 쓰이므로 "도달 불가"를 별도 메시지로 구분한다.
    throw createDemoApiHealthError(
      isAbortError(error) || isNetworkError(error)
        ? "Demo API server is unreachable"
        : "Demo API health check failed",
      error,
    );
  }

  if (!response.ok && response.status !== 503) {
    // 503은 "서버는 응답하지만 아직 준비 안 됨" 상태라 payload로 해석해야 한다.
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
  /**
   * minimal-api의 JSON 응답을 읽고 훅이 기대하는 JapanAddressError로 정규화한다.
   * Abort/HTTP/JSON 오류 의미를 여기서 통일해 상위 훅은 코드 분기만 신뢰하면 된다.
   */
  async function readJson<T>(
    input: string,
    init: RequestInit,
    options?: JapanAddressRequestOptions,
  ): Promise<T> {
    let response: Response;

    try {
      response = await fetch(resolveDemoApiUrl(baseUrl, input), {
        ...init,
        signal: options?.signal,
      });
    } catch (error) {
      // fetch abort는 UI 취소/timeout 성격으로 해석해 라이브러리 code와 맞춘다.
      throw createJapanAddressError(
        isAbortError(error) ? "timeout" : "network_error",
        isAbortError(error) ? "Request timed out" : "Network request failed",
        {
          cause: error,
        },
      );
    }

    if (!response.ok) {
      const message = `Request failed with status ${response.status}`;

      // HTTP 상태를 라이브러리 오류 코드로 재매핑해 훅 소비자가 route 세부사항을 몰라도 되게 한다.
      throw createJapanAddressError(
        resolveErrorCode(response.status, input),
        message,
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
      // route 이름과 JSON 형태는 minimal-api 공개 계약을 그대로 따른다.
      const payload = ensurePagerPayload(
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
      return payload;
    },
    async searchAddress(
      request: JapanPostAddresszipRequest,
      options?: JapanAddressRequestOptions,
    ) {
      const payload = ensurePagerPayload(
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
      return payload;
    },
  };
}
