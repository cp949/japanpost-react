import { describe, expect, it } from "vitest";
import { createJapanAddressError } from "../src/core/errors";

describe("createJapanAddressError", () => {
  it("creates a stable library error name and metadata", () => {
    const cause = new Error("missing");
    const error = createJapanAddressError("not_found", "No address found", {
      cause,
      status: 404,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("JapanAddressError");
    expect(error.code).toBe("not_found");
    expect(error.cause).toBe(cause);
    expect(error.status).toBe(404);
  });
});
