import { createJapanAddressError } from "./errors";
import type {
  JapanAddress,
  JapanAddressDataSource,
  JapanAddressErrorCode,
  JapanAddressRequestOptions,
  JapanPostApiClient,
  JapanPostApiDataSourceOptions,
  JapanPostAddresszipRequest,
  JapanPostFetchDataSourceOptions,
  JapanPostSearchcodeRequest,
  Page,
} from "./types";

const DEFAULT_LOOKUP_PATH = "/q/japanpost/searchcode";
const DEFAULT_SEARCH_PATH = "/q/japanpost/addresszip";

type FetchDataSourceOperation = "lookupPostalCode" | "searchAddress";

type JsonResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

type InvalidJsonResponseCause = {
  kind: "invalid_json_response";
  cause: unknown;
};

type InvalidPagePayloadCause = {
  kind: "invalid_page_payload";
  payload: unknown;
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function normalizePath(path: string) {
  const trimmed = path.trim();
  return `/${trimmed.replace(/^\/+/, "")}`;
}

function joinUrl(baseUrl: string, path: string) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const normalizedPath = normalizePath(path);
  return normalizedBaseUrl
    ? `${normalizedBaseUrl}${normalizedPath}`
    : normalizedPath;
}

function isAbortError(error: unknown) {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (typeof error === "object" &&
      error !== null &&
      (error as { name?: unknown }).name === "AbortError")
  );
}

function isTypeError(error: unknown): error is TypeError {
  return error instanceof TypeError;
}

function resolveErrorCode(
  status: number,
  path: string,
  operation: FetchDataSourceOperation,
  resolveErrorCodeOverride?: JapanPostFetchDataSourceOptions["resolveErrorCode"],
): JapanAddressErrorCode {
  if (resolveErrorCodeOverride) {
    return resolveErrorCodeOverride(status, path);
  }

  if (status === 404) {
    return "not_found";
  }

  if (status === 504) {
    return "timeout";
  }

  if (status === 400) {
    if (operation === "lookupPostalCode") {
      return "invalid_postal_code";
    }

    if (operation === "searchAddress") {
      return "invalid_query";
    }

    return "bad_response";
  }

  if (status >= 500) {
    return "data_source_error";
  }

  return "bad_response";
}

function getErrorMessage(payload: unknown, status: number, path: string) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "message" in payload &&
    typeof (payload as { message?: unknown }).message === "string"
  ) {
    return (payload as { message: string }).message;
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "string"
  ) {
    return (payload as { error: string }).error;
  }

  return `Request failed with status ${status} for ${path}`;
}

function isPagePayload(value: unknown): value is Page<JapanAddress> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const maybePage = value as Partial<Page<JapanAddress>>;

  return (
    Array.isArray(maybePage.elements) &&
    typeof maybePage.totalElements === "number" &&
    typeof maybePage.pageNumber === "number" &&
    typeof maybePage.rowsPerPage === "number"
  );
}

async function readJsonResponse(
  response: JsonResponse,
  path: string,
  operation: FetchDataSourceOperation,
  resolveErrorCodeOverride?: JapanPostFetchDataSourceOptions["resolveErrorCode"],
): Promise<Page<JapanAddress>> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch (cause) {
    throw createJapanAddressError(
      "bad_response",
      `Failed to parse JSON response from ${path}`,
      {
        cause: {
          kind: "invalid_json_response",
          cause,
        } satisfies InvalidJsonResponseCause,
        status: response.status,
      },
    );
  }

  if (!response.ok) {
    throw createJapanAddressError(
      resolveErrorCode(
        response.status,
        path,
        operation,
        resolveErrorCodeOverride,
      ),
      getErrorMessage(payload, response.status, path),
      {
        cause: payload,
        status: response.status,
      },
    );
  }

  if (!isPagePayload(payload)) {
    throw createJapanAddressError(
      "bad_response",
      `Response from ${path} was not a valid pager payload`,
      {
        cause: {
          kind: "invalid_page_payload",
          payload,
        } satisfies InvalidPagePayloadCause,
        status: response.status,
      },
    );
  }

  return payload;
}

async function requestJson(
  fetchImpl: typeof fetch,
  baseUrl: string,
  path: string,
  operation: FetchDataSourceOperation,
  body: JapanPostSearchcodeRequest | JapanPostAddresszipRequest,
  requestOptions?: JapanAddressRequestOptions,
  resolveErrorCodeOverride?: JapanPostFetchDataSourceOptions["resolveErrorCode"],
): Promise<Page<JapanAddress>> {
  const normalizedPath = normalizePath(path);
  const response = (await fetchImpl(joinUrl(baseUrl, normalizedPath), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    signal: requestOptions?.signal,
    body: JSON.stringify(body),
  })) as JsonResponse;

  return readJsonResponse(
    response,
    normalizedPath,
    operation,
    resolveErrorCodeOverride,
  );
}

/**
 * 기존 앱에서 이미 보유한 `searchcode` / `addresszip` 클라이언트를
 * `JapanAddressDataSource` 계약으로 얇게 감싸는 어댑터 팩토리.
 */
export function createJapanPostApiDataSource<TContext>(
  api: JapanPostApiClient<TContext, Page<JapanAddress>>,
  options?: JapanPostApiDataSourceOptions<TContext, Page<JapanAddress>>,
): JapanAddressDataSource;
export function createJapanPostApiDataSource<TContext, TPage>(
  api: JapanPostApiClient<TContext, TPage>,
  options: JapanPostApiDataSourceOptions<TContext, TPage> & {
    mapPage: (page: TPage) => Page<JapanAddress>;
  },
): JapanAddressDataSource;
export function createJapanPostApiDataSource<TContext, TPage>(
  api: JapanPostApiClient<TContext, TPage>,
  options?: JapanPostApiDataSourceOptions<TContext, TPage>,
): JapanAddressDataSource {
  function withContext<TRequest>(
    request: TRequest,
    requestOptions?: JapanAddressRequestOptions,
  ) {
    if (!options?.createContext) {
      return request;
    }

    const ctx = options.createContext(requestOptions);

    return ctx === undefined
      ? request
      : {
          ...request,
          ctx,
        };
  }

  function mapPage(page: TPage) {
    return options?.mapPage ? options.mapPage(page) : (page as Page<JapanAddress>);
  }

  return {
    async lookupPostalCode(request, requestOptions) {
      return mapPage(
        await api.searchcode(withContext(request, requestOptions)),
      );
    },
    async searchAddress(request, requestOptions) {
      return mapPage(
        await api.addresszip(withContext(request, requestOptions)),
      );
    },
  };
}

/**
 * minimal-api / custom backend에서 Japan Post 검색 엔드포인트를 호출하는 fetch data source.
 * 요청 body는 기존 data source 계약과 같은 pager 요청을 그대로 전송하고, 응답은 Page<JapanAddress>로 검증한다.
 */
export function createJapanPostFetchDataSource(
  options: JapanPostFetchDataSourceOptions,
): JapanAddressDataSource {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  function handleRequestError(error: unknown): never {
    if (isAbortError(error)) {
      throw createJapanAddressError("timeout", "Request was aborted", {
        cause: error,
        status: 0,
      });
    }

    if (isTypeError(error)) {
      throw createJapanAddressError("network_error", error.message, {
        cause: error,
        status: 0,
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name?: unknown }).name === "JapanAddressError"
    ) {
      throw error;
    }

    throw createJapanAddressError(
      "data_source_error",
      error instanceof Error ? error.message : "Unknown error",
      {
        cause: error,
      },
    );
  }

  return {
    async lookupPostalCode(request, requestOptions) {
      try {
        return await requestJson(
          fetchImpl,
          options.baseUrl,
          options.paths?.lookupPostalCode ?? DEFAULT_LOOKUP_PATH,
          "lookupPostalCode",
          request,
          requestOptions,
          options.resolveErrorCode,
        );
      } catch (error) {
        return handleRequestError(error);
      }
    },
    async searchAddress(request, requestOptions) {
      try {
        return await requestJson(
          fetchImpl,
          options.baseUrl,
          options.paths?.searchAddress ?? DEFAULT_SEARCH_PATH,
          "searchAddress",
          request,
          requestOptions,
          options.resolveErrorCode,
        );
      } catch (error) {
        return handleRequestError(error);
      }
    },
  };
}
