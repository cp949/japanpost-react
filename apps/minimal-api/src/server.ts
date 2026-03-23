import { createServer } from "node:http";

import type { AddressAdapter } from "./japanPostAdapter.js";
import { createHttpError, createJapanPostAdapter } from "./japanPostAdapter.js";

function writeJson(
  response: import("node:http").ServerResponse,
  statusCode: number,
  body: unknown,
) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  response.end(JSON.stringify(body));
}

function handleError(
  response: import("node:http").ServerResponse,
  error: unknown,
) {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (error as { statusCode: number }).statusCode === "number" &&
    error instanceof Error
  ) {
    writeJson(response, (error as { statusCode: number }).statusCode, {
      error: error.message,
    });
    return;
  }

  writeJson(response, 500, {
    error: "Unexpected server error",
  });
}

type MinimalApiServerOptions = {
  env?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
};

function withInstanceId<T extends { ok: boolean; error?: string }>(
  env: NodeJS.ProcessEnv | undefined,
  payload: T,
): T & { instanceId?: string } {
  const instanceId = env?.MINIMAL_API_INSTANCE_ID?.trim();

  if (!instanceId) {
    return payload;
  }

  return {
    ...payload,
    instanceId,
  };
}

export function createMinimalApiServer(options: MinimalApiServerOptions = {}) {
  const adapter = createJapanPostAdapter({
    env: options.env,
    fetch: options.fetch,
  });

  return createMinimalApiServerWithAdapter(adapter, options.env);
}

export function createMinimalApiServerWithAdapter(
  adapter: AddressAdapter,
  env: NodeJS.ProcessEnv = process.env,
) {
  return createServer(async (request, response) => {
    if (!request.url) {
      writeJson(response, 400, { error: "Missing request URL" });
      return;
    }

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "content-type",
      });
      response.end();
      return;
    }

    if (request.method !== "GET") {
      writeJson(response, 405, { error: "Method not allowed" });
      return;
    }

    const url = new URL(
      request.url,
      `http://${request.headers.host ?? "localhost"}`,
    );

    try {
      if (url.pathname === "/health") {
        const health = await adapter.getHealth();
        writeJson(response, health.ok ? 200 : 503, withInstanceId(env, health));
        return;
      }

      const searchCodeMatch = url.pathname.match(/^\/searchcode\/([^/]+)$/);

      if (searchCodeMatch) {
        const code = searchCodeMatch[1] ?? "";
        const result = await adapter.lookupPostalCode(code);
        writeJson(response, 200, result);
        return;
      }

      if (url.pathname === "/addresszip") {
        const query = url.searchParams.get("q") ?? "";
        const result = await adapter.searchAddress(query);
        writeJson(response, 200, result);
        return;
      }

      throw createHttpError(404, "Route not found");
    } catch (error) {
      handleError(response, error);
    }
  });
}

if (import.meta.main) {
  const port = Number(process.env.PORT ?? "8788");
  const adapter = createJapanPostAdapter();
  const server = createMinimalApiServerWithAdapter(adapter, process.env);

  server.listen(port, async () => {
    const health = await adapter.getHealth();
    console.log(
      `Minimal API listening on http://localhost:${port}${health.ok ? "" : " (not ready)"}`,
    );
  });
}
