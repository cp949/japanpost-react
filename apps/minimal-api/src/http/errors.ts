import type { ServerResponse } from "node:http";

import { isAdapterHttpError } from "../japanPost/errors.js";
import { writeJson } from "./responses.js";

/**
 * 내부 예외를 HTTP JSON 오류 응답으로 변환한다.
 * adapter 계층이 이미 의미 있는 statusCode를 붙였으면 그대로 존중하고, 그 외는 500으로 감싼다.
 */
export function handleError(
  response: ServerResponse,
  error: unknown,
  headers: Record<string, string> = {},
) {
  if (isAdapterHttpError(error) && error instanceof Error) {
    writeJson(
      response,
      error.statusCode,
      {
        error: error.message,
      },
      headers,
    );
    return;
  }

  writeJson(
    response,
    500,
    {
      error: "Unexpected server error",
    },
    headers,
  );
}
