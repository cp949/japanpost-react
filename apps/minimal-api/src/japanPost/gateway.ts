import type { JapanPostErrorResponse } from "./clientTypes.js";
import { createHttpError, isAdapterHttpError } from "./errors.js";

const DEFAULT_TIMEOUT_MS = 10_000;

type JapanPostGatewayOptions = {
  clearCachedToken: () => void;
  fetch: typeof fetch;
  requestToken: () => Promise<string>;
  timeoutMs?: number;
};

/**
 * 토큰이 필요한 upstream fetch 호출을 공통 처리한다.
 * timeout, 401 재시도, 오류 메시지 정규화를 이 계층으로 몰아 상위 코드를 단순화한다.
 */
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

    // error_code/request_id를 메시지에 남겨 운영 추적 단서를 보존한다.
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
        // 404는 "조건에 맞는 주소 없음"으로 해석할 수 있어 상위에서 별도 분기하기 쉽다.
        if (response.status === 404) {
          throw createHttpError(404, "No matching addresses found");
        }

        // 401은 캐시된 토큰 만료 가능성이 있어 다른 오류와 구분한다.
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
            // 첫 401은 캐시 토큰 오염 가능성을 의심하고 한 번만 재발급 후 재시도한다.
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

          // 알 수 없는 실패는 502로 감싸 adapter 밖으로 fetch 세부 구현이 새지 않게 한다.
          throw createHttpError(502, "Address provider request failed", error);
        }
      }

      throw createHttpError(502, "Address provider request failed");
    },
  };
}
