import type { JapanAddress } from "@cp949/japanpost-react";

type JapanPostTokenResponse = {
  token?: string;
  token_type?: string;
  expires_in?: number;
};

type JapanPostErrorResponse = {
  error_code?: string;
  message?: string;
  request_id?: string;
};

type JapanPostSearchCodeAddress = {
  zip_code?: string | number | null;
  pref_name?: string | null;
  pref_kana?: string | null;
  city_name?: string | null;
  city_kana?: string | null;
  town_name?: string | null;
  town_kana?: string | null;
  block_name?: string | null;
  other_name?: string | null;
  address?: string | null;
};

type JapanPostSearchCodeResponse = {
  addresses?: JapanPostSearchCodeAddress[] | null;
};

type JapanPostAddressZipResponse = {
  addresses?: JapanPostSearchCodeAddress[] | null;
};

type GatewayTokenCache = {
  token: string;
  expiresAt: number;
};

type AdapterOptions = {
  env?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
};

export type HealthStatus = {
  ok: boolean;
  error?: string;
  instanceId?: string;
};

export type PostalCodeResult = {
  postalCode: string;
  addresses: JapanAddress[];
};

export type AddressSearchResult = {
  query: string;
  addresses: JapanAddress[];
};

export type AddressAdapter = {
  getHealth(): Promise<HealthStatus>;
  lookupPostalCode(code: string): Promise<PostalCodeResult>;
  searchAddress(query: string): Promise<AddressSearchResult>;
};

type AdapterHttpError = Error & {
  cause?: unknown;
  statusCode: number;
};

const DEFAULT_BASE_URL = "https://api.da.pf.japanpost.jp";
const DEFAULT_TOKEN_PATH = "/api/v2/j/token";
const DEFAULT_SEARCH_CODE_PATH = "/api/v2/searchcode";
const DEFAULT_ADDRESS_ZIP_PATH = "/api/v2/addresszip";
const DEFAULT_TIMEOUT_MS = 10_000;
const TOKEN_REFRESH_BUFFER_MS = 30_000;
const DEFAULT_ADDRESS_SEARCH_LIMIT = 20;

export function createHttpError(
  statusCode: number,
  message: string,
  cause?: unknown,
): AdapterHttpError {
  const error = new Error(message) as AdapterHttpError;
  error.name = "AdapterHttpError";
  error.statusCode = statusCode;

  if (cause !== undefined) {
    error.cause = cause;
  }

  return error;
}

function normalizePostalCode(
  value: string | number | null | undefined,
): string {
  return String(value ?? "").replace(/[^\d]/g, "");
}

function normalizePostalCodeOrThrow(
  value: string | number | null | undefined,
): string {
  const postalCode = normalizePostalCode(value);

  if (!/^\d{7}$/.test(postalCode)) {
    throw createHttpError(
      502,
      "Address provider returned an invalid postal code",
    );
  }

  return postalCode;
}

function joinAddressParts(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
}

function normalizeBaseUrl(value: string): string {
  const trimmedValue = value.trim();

  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(trimmedValue)) {
    return trimmedValue;
  }

  return `https://${trimmedValue}`;
}

function normalizeAddressRecord(
  record: JapanPostSearchCodeAddress,
): JapanAddress {
  const postalCode = normalizePostalCodeOrThrow(record.zip_code);
  const prefecture = record.pref_name?.trim() ?? "";
  const city = record.city_name?.trim() ?? "";
  const town = record.town_name?.trim() ?? "";
  const structuredAddress = joinAddressParts([
    prefecture,
    city,
    town,
    record.block_name,
    record.other_name,
  ]);
  const rawAddress = record.address?.trim() ?? "";
  const address =
    rawAddress && (!structuredAddress || rawAddress.includes(structuredAddress))
      ? rawAddress
      : structuredAddress || rawAddress;

  return {
    postalCode,
    prefecture,
    prefectureKana: record.pref_kana?.trim() || undefined,
    city,
    cityKana: record.city_kana?.trim() || undefined,
    town,
    townKana: record.town_kana?.trim() || undefined,
    address,
    provider: "japan-post",
  };
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch (error) {
    throw createHttpError(502, "Address provider returned invalid JSON", error);
  }
}

async function readErrorMessage(
  response: Response,
  defaultMessage: string,
): Promise<string> {
  try {
    const payload = (await response.json()) as JapanPostErrorResponse;
    const detail = payload.message?.trim();
    const metadata = [
      payload.error_code ? `error_code: ${payload.error_code}` : null,
      payload.request_id ? `request_id: ${payload.request_id}` : null,
    ].filter(Boolean);

    if (!detail && metadata.length === 0) {
      return defaultMessage;
    }

    return detail
      ? `${defaultMessage}: ${detail}${metadata.length > 0 ? ` (${metadata.join(", ")})` : ""}`
      : `${defaultMessage} (${metadata.join(", ")})`;
  } catch {
    return defaultMessage;
  }
}

function ensureAddresses(payload: {
  addresses?: JapanPostSearchCodeAddress[] | null;
}): JapanPostSearchCodeAddress[] {
  if (!Array.isArray(payload.addresses)) {
    throw createHttpError(
      502,
      "Address provider returned an unexpected response",
    );
  }

  return payload.addresses;
}

export function createJapanPostAdapter(
  options: AdapterOptions = {},
): AddressAdapter {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (!fetchImpl) {
    throw createHttpError(500, "Fetch is not available in this environment");
  }

  const baseUrl = normalizeBaseUrl(env.JAPAN_POST_BASE_URL ?? DEFAULT_BASE_URL);
  const tokenPath = env.JAPAN_POST_TOKEN_PATH ?? DEFAULT_TOKEN_PATH;
  const searchCodePath =
    env.JAPAN_POST_SEARCH_CODE_PATH ?? DEFAULT_SEARCH_CODE_PATH;
  const addressZipPath =
    env.JAPAN_POST_ADDRESS_ZIP_PATH ?? DEFAULT_ADDRESS_ZIP_PATH;

  let cachedToken: GatewayTokenCache | null = null;
  let pendingTokenRequest: Promise<string> | null = null;

  function requireEnv(name: "JAPAN_POST_CLIENT_ID" | "JAPAN_POST_SECRET_KEY") {
    const value = env[name]?.trim();

    if (!value) {
      throw createHttpError(500, `${name} is required`);
    }

    return value;
  }

  function createTimeoutSignal() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    return {
      signal: controller.signal,
      clear: () => clearTimeout(timeoutId),
    };
  }

  async function getHealth(): Promise<HealthStatus> {
    try {
      requireEnv("JAPAN_POST_CLIENT_ID");
      requireEnv("JAPAN_POST_SECRET_KEY");
      await requestToken();
      return { ok: true };
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error &&
        typeof (error as AdapterHttpError).statusCode === "number" &&
        error instanceof Error
      ) {
        return {
          ok: false,
          error: error.message,
        };
      }

      throw error;
    }
  }

  function ensureAddressesFound<T extends { addresses: JapanAddress[] }>(
    payload: T,
  ): T {
    if (payload.addresses.length === 0) {
      throw createHttpError(404, "No matching addresses found");
    }

    return payload;
  }

  async function requestToken(): Promise<string> {
    if (
      cachedToken &&
      cachedToken.expiresAt > Date.now() + TOKEN_REFRESH_BUFFER_MS
    ) {
      return cachedToken.token;
    }

    if (pendingTokenRequest) {
      return pendingTokenRequest;
    }

    pendingTokenRequest = (async () => {
      const clientId = requireEnv("JAPAN_POST_CLIENT_ID");
      const secretKey = requireEnv("JAPAN_POST_SECRET_KEY");
      const timeout = createTimeoutSignal();

      try {
        const response = await fetchImpl(new URL(tokenPath, baseUrl), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(env.JAPAN_POST_X_FORWARDED_FOR
              ? { "x-forwarded-for": env.JAPAN_POST_X_FORWARDED_FOR }
              : {}),
          },
          body: JSON.stringify({
            grant_type: "client_credentials",
            client_id: clientId,
            secret_key: secretKey,
          }),
          signal: timeout.signal,
        });

        if (!response.ok) {
          const message = await readErrorMessage(
            response,
            `Address provider authentication failed with status ${response.status}`,
          );
          throw createHttpError(502, message);
        }

        const payload = await parseJsonResponse<JapanPostTokenResponse>(response);

        if (!payload.token) {
          throw createHttpError(
            502,
            "Address provider authentication failed: no token in response",
          );
        }

        cachedToken = {
          token: payload.token,
          expiresAt:
            Date.now() + Math.max((payload.expires_in ?? 60) * 1000, 60_000),
        };

        return cachedToken.token;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw createHttpError(
            504,
            "Address provider authentication timed out",
            error,
          );
        }

        if (
          typeof error === "object" &&
          error !== null &&
          "statusCode" in error &&
          typeof (error as AdapterHttpError).statusCode === "number"
        ) {
          throw error;
        }

        throw createHttpError(
          502,
          "Address provider authentication failed",
          error,
        );
      } finally {
        timeout.clear();
        pendingTokenRequest = null;
      }
    })();

    return pendingTokenRequest;
  }

  async function performFetchWithToken<T>(
    input: URL,
    init: RequestInit,
    token: string,
  ): Promise<T> {
    const timeout = createTimeoutSignal();

    try {
      const response = await fetchImpl(input, {
        ...init,
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          ...(init.headers ?? {}),
        },
        signal: timeout.signal,
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw createHttpError(404, "No matching addresses found");
        }

        if (response.status === 401) {
          throw createHttpError(
            401,
            "Address provider rejected the access token",
          );
        }

        const message = await readErrorMessage(
          response,
          `Address provider request failed with status ${response.status}`,
        );
        throw createHttpError(502, message);
      }

      return parseJsonResponse<T>(response);
    } finally {
      timeout.clear();
    }
  }

  async function fetchWithToken<T>(
    input: URL,
    init: RequestInit = {},
  ): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const token = await requestToken();
        return await performFetchWithToken(input, init, token);
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "statusCode" in error &&
          (error as AdapterHttpError).statusCode === 401 &&
          attempt === 0
        ) {
          cachedToken = null;
          continue;
        }

        if (error instanceof Error && error.name === "AbortError") {
          throw createHttpError(
            504,
            "Address provider request timed out",
            error,
          );
        }

        if (
          typeof error === "object" &&
          error !== null &&
          "statusCode" in error &&
          typeof (error as AdapterHttpError).statusCode === "number"
        ) {
          throw error;
        }

        throw createHttpError(502, "Address provider request failed", error);
      }
    }

    throw createHttpError(502, "Address provider request failed");
  }

  return {
    getHealth,

    async lookupPostalCode(postalCode: string) {
      const normalizedCode = normalizePostalCode(postalCode);

      if (!/^\d{7}$/.test(normalizedCode)) {
        throw createHttpError(400, "Postal code must contain exactly 7 digits");
      }

      const endpoint = new URL(
        `${searchCodePath.replace(/\/$/, "")}/${normalizedCode}`,
        baseUrl,
      );
      const payload = await fetchWithToken<JapanPostSearchCodeResponse>(
        endpoint,
        {
          method: "GET",
        },
      );
      const addresses = ensureAddresses(payload);

      return ensureAddressesFound({
        postalCode: normalizedCode,
        addresses: addresses.map(normalizeAddressRecord),
      });
    },

    async searchAddress(query: string) {
      const normalizedQuery = query.trim();

      if (!normalizedQuery) {
        throw createHttpError(400, "Query parameter q is required");
      }

      const endpoint = new URL(addressZipPath, baseUrl);
      const payload = await fetchWithToken<JapanPostAddressZipResponse>(
        endpoint,
        {
          method: "POST",
          body: JSON.stringify({
            freeword: normalizedQuery,
            flg_getcity: 0,
            flg_getpref: 0,
            page: 1,
            limit: DEFAULT_ADDRESS_SEARCH_LIMIT,
          }),
        },
      );
      const addresses = ensureAddresses(payload);

      return ensureAddressesFound({
        query: normalizedQuery,
        addresses: addresses.map(normalizeAddressRecord),
      });
    },
  };
}
