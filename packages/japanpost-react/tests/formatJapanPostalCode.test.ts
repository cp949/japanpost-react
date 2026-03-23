import { describe, expect, it } from "vitest";

import { formatJapanPostalCode } from "../src/core/formatters";

describe("formatJapanPostalCode", () => {
  it("formats a seven-digit postal code with a hyphen", () => {
    expect(formatJapanPostalCode("1000001")).toBe("100-0001");
    expect(formatJapanPostalCode("100-0001")).toBe("100-0001");
    expect(formatJapanPostalCode("100")).toBe("100");
  });

  it("does not insert a hyphen for values that are not exactly seven digits", () => {
    expect(formatJapanPostalCode("10000012")).toBe("10000012");
    expect(formatJapanPostalCode("12-34")).toBe("1234");
  });
});
