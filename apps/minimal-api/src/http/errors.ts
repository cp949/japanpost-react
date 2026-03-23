import type { ServerResponse } from "node:http";

import { isAdapterHttpError } from "../adapter/errors.js";
import { writeJson } from "./responses.js";

export function handleError(response: ServerResponse, error: unknown) {
  if (isAdapterHttpError(error) && error instanceof Error) {
    writeJson(response, error.statusCode, {
      error: error.message,
    });
    return;
  }

  writeJson(response, 500, {
    error: "Unexpected server error",
  });
}
