import type { IncomingMessage, ServerResponse } from "node:http";

import { createHttpError } from "../adapter/errors.js";
import type { AddressAdapter } from "../japanPostAdapter.js";
import { handleError } from "./errors.js";
import { writeJson, writeNoContent } from "./responses.js";

type RouteHandlerOptions = {
  adapter: AddressAdapter;
  env?: NodeJS.ProcessEnv;
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

export async function handleMinimalApiRequest(
  request: IncomingMessage,
  response: ServerResponse,
  { adapter, env }: RouteHandlerOptions,
) {
  if (!request.url) {
    writeJson(response, 400, { error: "Missing request URL" });
    return;
  }

  if (request.method === "OPTIONS") {
    writeNoContent(response);
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
}
