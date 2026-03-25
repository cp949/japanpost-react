import type { ServerResponse } from "node:http";

const SAMPLE_SERVER_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function writeJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  // charset을 명시해 일본어 주소/오류 메시지가 깨지지 않게 한다.
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    ...SAMPLE_SERVER_HEADERS,
    ...headers,
  });
  response.end(JSON.stringify(body));
}

export function writeNoContent(
  response: ServerResponse,
  statusCode = 204,
  headers: Record<string, string> = {},
) {
  response.writeHead(statusCode, {
    ...SAMPLE_SERVER_HEADERS,
    ...headers,
  });
  response.end();
}
