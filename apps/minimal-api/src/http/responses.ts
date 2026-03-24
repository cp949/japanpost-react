import type { ServerResponse } from "node:http";

// demo 앱이 브라우저에서 바로 호출하므로 최소한의 CORS 헤더를 항상 포함한다.
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
  // charset을 명시해 일본어 주소/오류 메시지가 깨지지 않게 한다.
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    ...CORS_HEADERS,
  });
  response.end(JSON.stringify(body));
}

export function writeNoContent(response: ServerResponse, statusCode = 204) {
  // OPTIONS 응답도 동일한 CORS 헤더를 유지해야 브라우저 preflight가 통과한다.
  response.writeHead(statusCode, CORS_HEADERS);
  response.end();
}
