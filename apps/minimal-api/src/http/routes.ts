import type { IncomingMessage, ServerResponse } from "node:http";

import { createHttpError } from "../adapter/errors.js";
import type {
  AddressAdapter,
  JapanPostAddresszipRequest,
  JapanPostSearchcodeRequest,
} from "../japanPostAdapter.js";
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

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString("utf8").trim();

  if (!rawBody) {
    return {} as T;
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch (error) {
    throw createHttpError(400, "Request body must be valid JSON", error);
  }
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

  const url = new URL(
    request.url,
    `http://${request.headers.host ?? "localhost"}`,
  );

  try {
    if (request.method === "GET" && url.pathname === "/health") {
      const health = await adapter.getHealth();
      writeJson(response, health.ok ? 200 : 503, withInstanceId(env, health));
      return;
    }

    if (
      request.method === "POST" &&
      url.pathname === "/q/japanpost/searchcode"
    ) {
      const requestBody = await readJsonBody<JapanPostSearchcodeRequest>(
        request,
      );
      const result = await adapter.searchcode(requestBody);
      writeJson(response, 200, result);
      return;
    }

    if (
      request.method === "POST" &&
      url.pathname === "/q/japanpost/addresszip"
    ) {
      const requestBody = await readJsonBody<JapanPostAddresszipRequest>(
        request,
      );
      const result = await adapter.addresszip(requestBody);
      writeJson(response, 200, result);
      return;
    }

    if (
      url.pathname === "/health" ||
      url.pathname === "/q/japanpost/searchcode" ||
      url.pathname === "/q/japanpost/addresszip"
    ) {
      throw createHttpError(405, "Method not allowed");
    }

    throw createHttpError(404, "Route not found");
  } catch (error) {
    handleError(response, error);
  }
}
