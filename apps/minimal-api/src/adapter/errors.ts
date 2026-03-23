import type { AdapterHttpError } from "../japanPostAdapterTypes.js";

export function createHttpError(
  statusCode: number,
  message: string,
  cause?: unknown,
): AdapterHttpError {
  const error = new Error(message) as AdapterHttpError;
  error.name = "AdapterHttpError";
  error.statusCode = statusCode;

  if (cause !== undefined) {
    error.cause = cause;
  }

  return error;
}

export function isAdapterHttpError(error: unknown): error is AdapterHttpError {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (error as AdapterHttpError).statusCode === "number"
  );
}
