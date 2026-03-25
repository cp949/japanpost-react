import type {
  JapanPostErrorResponse,
  JapanPostTokenResponse,
} from "./clientTypes.js";
import { createHttpError, isAdapterHttpError } from "./errors.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const TOKEN_REFRESH_BUFFER_MS = 30_000;

type GatewayTokenCache = {
  token: string;
  expiresAt: number;
};

type JapanPostTokenClientOptions = {
  baseUrl: string;
  env: NodeJS.ProcessEnv;
  fetch: typeof fetch;
  forwardedFor?: string;
  tokenPath: string;
  timeoutMs?: number;
};

/**
 * 일본우정 access token 발급과 캐시를 담당한다.
 * 동시 요청 dedupe와 만료 버퍼를 넣어 인증 서버 호출을 최소화한다.
 */
function requireEnv(
  env: NodeJS.ProcessEnv,
  name: "JAPANPOST_CLIENT_ID" | "JAPANPOST_SECRET_KEY",
) {
  const value = env[name]?.trim();

  if (!value) {
    throw createHttpError(500, `${name} is required`);
  }

  return value;
}

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

export function createJapanPostTokenClient({
  baseUrl,
  env,
  fetch,
  forwardedFor,
  tokenPath,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: JapanPostTokenClientOptions) {
  let cachedToken: GatewayTokenCache | null = null;
  // 이미 진행 중인 토큰 발급 Promise를 공유해 경쟁 요청을 하나로 합친다.
  let pendingTokenRequest: Promise<string> | null = null;

  return {
    clearCachedToken() {
      cachedToken = null;
    },

    async requestToken(): Promise<string> {
      if (
        cachedToken &&
        cachedToken.expiresAt > Date.now() + TOKEN_REFRESH_BUFFER_MS
      ) {
        // 만료 직전 토큰을 재사용하면 실제 API 호출 도중 401이 날 수 있어 여유 시간을 둔다.
        return cachedToken.token;
      }

      if (pendingTokenRequest) {
        return pendingTokenRequest;
      }

      pendingTokenRequest = (async () => {
        const clientId = requireEnv(env, "JAPANPOST_CLIENT_ID");
        const secretKey = requireEnv(env, "JAPANPOST_SECRET_KEY");
        const timeout = createTimeoutSignal(timeoutMs);

        try {
          const response = await fetch(new URL(tokenPath, baseUrl), {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(forwardedFor
                ? { "x-forwarded-for": forwardedFor }
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

          const payload = await parseJsonResponse<JapanPostTokenResponse>(
            response,
          );

          if (!payload.token) {
            throw createHttpError(
              502,
              "Address provider authentication failed: no token in response",
            );
          }

          cachedToken = {
            token: payload.token,
            // expires_in이 비정상이더라도 최소 60초는 유지해 즉시 재인증 루프를 피한다.
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

          if (isAdapterHttpError(error)) {
            throw error;
          }

          throw createHttpError(
            502,
            "Address provider authentication failed",
            error,
          );
        } finally {
          timeout.clear();
          // 성공/실패와 무관하게 pending 상태를 비워 다음 호출이 새 판단을 하게 한다.
          pendingTokenRequest = null;
        }
      })();

      return pendingTokenRequest;
    },
  };
}
