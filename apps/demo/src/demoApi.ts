import type {
  JapanAddress,
  JapanAddressDataSource,
  JapanAddressRequestOptions,
} from "@cp949/japanpost-react";
import { createJapanAddressError } from "@cp949/japanpost-react";

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

function ensureAddressesPayload(
  payload: unknown,
): { addresses: JapanAddress[] } {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("addresses" in payload) ||
    !Array.isArray((payload as { addresses?: unknown }).addresses)
  ) {
    throw createJapanAddressError(
      "bad_response",
      "Response payload must include an addresses array",
    );
  }

  return payload as { addresses: JapanAddress[] };
}

function resolveErrorCode(
  status: number,
  message: string,
  input: string,
):
  | "invalid_postal_code"
  | "invalid_query"
  | "not_found"
  | "timeout"
  | "data_source_error" {
  if (status === 404) {
    return "not_found";
  }

  if (status === 504) {
    return "timeout";
  }

  if (status === 400) {
    if (input.startsWith("/searchcode/")) {
      return "invalid_postal_code";
    }

    if (input.startsWith("/addresszip")) {
      return "invalid_query";
    }
  }

  if (/timed out/i.test(message)) {
    return "timeout";
  }

  return "data_source_error";
}

function resolveDemoApiUrl(baseUrl: string, path: string): string {
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
    throw createDemoApiHealthError(
      isAbortError(error) || isNetworkError(error)
        ? "Demo API server is unreachable"
        : "Demo API health check failed",
      error,
    );
  }

  if (!response.ok && response.status !== 503) {
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
    options?: JapanAddressRequestOptions,
  ): Promise<T> {
    let response: Response;

    try {
      response = await fetch(resolveDemoApiUrl(baseUrl, input), {
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
      let message = `Request failed with status ${response.status}`;

      try {
        const payload = (await response.json()) as { error?: string };
        if (payload.error) {
          message = payload.error;
        }
      } catch {
        // Ignore invalid JSON and fall back to the default message.
      }

      throw createJapanAddressError(
        resolveErrorCode(response.status, message, input),
        message,
        {
          status: response.status,
        },
      );
    }

    return (await response.json()) as T;
  }

  return {
    async lookupPostalCode(
      postalCode: string,
      options?: JapanAddressRequestOptions,
    ) {
      const payload = ensureAddressesPayload(
        await readJson<unknown>(
          `/searchcode/${encodeURIComponent(postalCode)}`,
          options,
        ),
      );
      return payload.addresses;
    },
    async searchAddress(
      query: string,
      options?: JapanAddressRequestOptions,
    ) {
      const payload = ensureAddressesPayload(
        await readJson<unknown>(
          `/addresszip?q=${encodeURIComponent(query)}`,
          options,
        ),
      );
      return payload.addresses;
    },
  };
}
