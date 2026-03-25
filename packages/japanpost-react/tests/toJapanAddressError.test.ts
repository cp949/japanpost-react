import { describe, expect, it } from "vitest";

import { createJapanAddressError } from "../src/core/errors";
import { toJapanAddressError } from "../src/react/toJapanAddressError";

describe("toJapanAddressError", () => {
  it("returns an existing JapanAddressError unchanged", () => {
    const error = createJapanAddressError(
      "invalid_query",
      "Address query is required",
    );

    expect(toJapanAddressError(error)).toBe(error);
  });

  it("wraps a generic Error as data_source_error", () => {
    const error = new Error("boom");
    const result = toJapanAddressError(error);

    expect(result.code).toBe("data_source_error");
    expect(result.message).toBe("boom");
    expect(result.cause).toBe(error);
  });

  it("wraps non-Error values with an unknown error message", () => {
    const result = toJapanAddressError("boom");

    expect(result.code).toBe("data_source_error");
    expect(result.message).toBe("Unknown error");
    expect(result.cause).toBe("boom");
  });

  it("wraps objects that only look like a JapanAddressError", () => {
    const foreignError = {
      name: "AxiosError",
      code: "timeout",
      message: "network timeout",
    };

    const result = toJapanAddressError(foreignError);

    expect(result).not.toBe(foreignError);
    expect(result.name).toBe("JapanAddressError");
    expect(result.code).toBe("data_source_error");
    expect(result.message).toBe("Unknown error");
    expect(result.cause).toBe(foreignError);
  });

  it("wraps JapanAddressError-shaped objects with unsupported codes", () => {
    const invalidJapanAddressErrorLike = {
      name: "JapanAddressError",
      code: "some_other_code",
      message: "unexpected",
    };

    const result = toJapanAddressError(invalidJapanAddressErrorLike);

    expect(result).not.toBe(invalidJapanAddressErrorLike);
    expect(result.name).toBe("JapanAddressError");
    expect(result.code).toBe("data_source_error");
    expect(result.message).toBe("Unknown error");
    expect(result.cause).toBe(invalidJapanAddressErrorLike);
  });
});
