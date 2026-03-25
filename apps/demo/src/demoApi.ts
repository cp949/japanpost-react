import {
  createJapanAddressError,
  createJapanPostFetchDataSource,
  type JapanAddressDataSource,
} from "@cp949/japanpost-react";

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

function normalizeRequestHeaders(headers: HeadersInit | undefined): HeadersInit | undefined {
  if (headers === undefined) {
    return undefined;
  }

  if (headers instanceof Headers) {
    const normalized = new Headers();

    headers.forEach((value, key) => {
      normalized.append(key.toLowerCase(), value);
    });

    return normalized;
  }

  if (Array.isArray(headers)) {
    return headers.map(([key, value]) => [key.toLowerCase(), value]);
  }

  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
}

function resolveDemoApiUrl(baseUrl: string, path: string): string {
  // 절대 URL 이면 URL 생성자를 사용하고, 상대 경로면 단순 문자열 결합으로 처리한다.
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(baseUrl)) {
    return String(new URL(path, `${baseUrl}/`));
  }

  return `${normalizeBaseUrl(baseUrl)}${path}`;
}

function createDemoApiFetch(): typeof fetch {
  return async (input, init) => {
    let response: Response;

    try {
      response = await fetch(input, {
        ...init,
        headers: normalizeRequestHeaders(init?.headers),
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }

      throw new TypeError("Network request failed");
    }

    if (response.ok) {
      return response;
    }

    return {
      ok: false,
      status: response.status,
      json: async () => ({}),
    } as Response;
  };
}

function normalizeDemoApiError(error: unknown): never {
  if (
    typeof error !== "object" ||
    error === null ||
    (error as { name?: unknown }).name !== "JapanAddressError"
  ) {
    throw error;
  }

  const japanAddressError = error as Error & {
    code?: string;
    status?: number;
    cause?: unknown;
  };
  const code = japanAddressError.code;
  const status = japanAddressError.status;
  const cause = japanAddressError.cause;

  if (code === "timeout" && status === 0) {
    throw createJapanAddressError("timeout", "Request timed out", {
      cause,
      status,
    });
  }

  if (code === "network_error") {
    throw createJapanAddressError("network_error", "Network request failed", {
      cause,
      status,
    });
  }

  if (code === "bad_response") {
    if (japanAddressError.message.includes("not a valid pager payload")) {
      throw createJapanAddressError(
        "bad_response",
        "Response payload must include a valid page payload",
        {
          cause,
          status,
        },
      );
    }

    if (japanAddressError.message.includes("Failed to parse JSON response")) {
      throw createJapanAddressError(
        "bad_response",
        "Response payload was not valid JSON",
        {
          cause,
          status,
        },
      );
    }
  }

  if (typeof status === "number" && status > 0) {
    throw createJapanAddressError(
      code ?? "data_source_error",
      `Request failed with status ${status}`,
      {
        cause,
        status,
      },
    );
  }

  throw error;
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
  const dataSource = createJapanPostFetchDataSource({
    baseUrl: resolveDemoApiUrl(baseUrl, ""),
    fetch: createDemoApiFetch(),
    resolveErrorCode(status, path) {
      if (status === 404) {
        return "not_found";
      }

      if (status === 504) {
        return "timeout";
      }

      if (status === 400) {
        if (path.startsWith("/q/japanpost/searchcode")) {
          return "invalid_postal_code";
        }

        if (path.startsWith("/q/japanpost/addresszip")) {
          return "invalid_query";
        }
      }

      return "data_source_error";
    },
  });

  return {
    async lookupPostalCode(request, options) {
      try {
        return await dataSource.lookupPostalCode(request, options);
      } catch (error) {
        return normalizeDemoApiError(error);
      }
    },
    async searchAddress(request, options) {
      try {
        return await dataSource.searchAddress(request, options);
      } catch (error) {
        return normalizeDemoApiError(error);
      }
    },
  };
}
