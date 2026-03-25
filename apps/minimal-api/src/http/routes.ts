import type { IncomingMessage, ServerResponse } from "node:http";

import type {
  JapanPostAddresszipRequest,
  JapanPostSearchcodeRequest,
} from "@cp949/japanpost-react";

import { createHttpError } from "../japanPost/errors.js";
import type { AddressAdapter } from "../japanPostAdapter.js";
import { handleError } from "./errors.js";
import { writeJson, writeNoContent } from "./responses.js";

/**
 * minimal-api의 HTTP 라우팅 계층이다.
 * Node 기본 http 서버 위에서 최소한의 라우팅만 수행하고, 실제 검색 의미는 adapter에 위임한다.
 */
type RouteHandlerOptions = {
  adapter: AddressAdapter;
  env?: NodeJS.ProcessEnv;
};

function withInstanceId<T extends { ok: boolean; error?: string }>(
  env: NodeJS.ProcessEnv | undefined,
  payload: T,
): T & { instanceId?: string } {
  // readiness 스크립트가 "내가 띄운 인스턴스"인지 확인할 수 있게 선택적으로 붙인다.
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
    // 빈 body는 "옵션 전부 생략"으로 간주하고 세부 검증은 adapter에 맡긴다.
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
    writeNoContent(response, 204);
    return;
  }

  const url = new URL(
    request.url,
    `http://${request.headers.host ?? "localhost"}`,
  );

  try {
    if (request.method === "GET" && url.pathname === "/health") {
      const health = await adapter.getHealth();
      writeJson(
        response,
        health.ok ? 200 : 503,
        withInstanceId(env, health),
      );
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
      // 경로는 맞지만 메서드가 틀린 경우 404가 아니라 405를 돌려 호출 실수를 드러낸다.
      throw createHttpError(405, "Method not allowed");
    }

    throw createHttpError(404, "Route not found");
  } catch (error) {
    handleError(response, error);
  }
}
