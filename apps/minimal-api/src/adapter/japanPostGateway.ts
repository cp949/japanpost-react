import type { JapanPostErrorResponse } from "../japanPostAdapterTypes.js";
import { createHttpError, isAdapterHttpError } from "./errors.js";

const DEFAULT_TIMEOUT_MS = 10_000;

type JapanPostGatewayOptions = {
  clearCachedToken: () => void;
  fetch: typeof fetch;
  requestToken: () => Promise<string>;
  timeoutMs?: number;
};

function createTimeoutSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
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

export function createJapanPostGateway({
  clearCachedToken,
  fetch,
  requestToken,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: JapanPostGatewayOptions) {
  async function performFetchWithToken<T>(
    input: URL,
    init: RequestInit,
    token: string,
  ): Promise<T> {
    const timeout = createTimeoutSignal(timeoutMs);

    try {
      const response = await fetch(input, {
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

  return {
    async fetchWithToken<T>(input: URL, init: RequestInit = {}): Promise<T> {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const token = await requestToken();
          return await performFetchWithToken(input, init, token);
        } catch (error) {
          if (
            isAdapterHttpError(error) &&
            error.statusCode === 401 &&
            attempt === 0
          ) {
            clearCachedToken();
            continue;
          }

          if (error instanceof Error && error.name === "AbortError") {
            throw createHttpError(
              504,
              "Address provider request timed out",
              error,
            );
          }

          if (isAdapterHttpError(error)) {
            throw error;
          }

          throw createHttpError(502, "Address provider request failed", error);
        }
      }

      throw createHttpError(502, "Address provider request failed");
    },
  };
}
