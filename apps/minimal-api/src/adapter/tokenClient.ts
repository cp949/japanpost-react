import type {
  GatewayTokenCache,
  JapanPostErrorResponse,
  JapanPostTokenResponse,
} from "../japanPostAdapterTypes.js";
import { createHttpError, isAdapterHttpError } from "./errors.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const TOKEN_REFRESH_BUFFER_MS = 30_000;

type JapanPostTokenClientOptions = {
  baseUrl: string;
  env: NodeJS.ProcessEnv;
  fetch: typeof fetch;
  forwardedFor?: string;
  tokenPath: string;
  timeoutMs?: number;
};

function requireEnv(
  env: NodeJS.ProcessEnv,
  name: "JAPAN_POST_CLIENT_ID" | "JAPAN_POST_SECRET_KEY",
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
        return cachedToken.token;
      }

      if (pendingTokenRequest) {
        return pendingTokenRequest;
      }

      pendingTokenRequest = (async () => {
        const clientId = requireEnv(env, "JAPAN_POST_CLIENT_ID");
        const secretKey = requireEnv(env, "JAPAN_POST_SECRET_KEY");
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
          pendingTokenRequest = null;
        }
      })();

      return pendingTokenRequest;
    },
  };
}
