import type { ServerResponse } from "node:http";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function writeJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    ...CORS_HEADERS,
  });
  response.end(JSON.stringify(body));
}

export function writeNoContent(response: ServerResponse, statusCode = 204) {
  response.writeHead(statusCode, CORS_HEADERS);
  response.end();
}
