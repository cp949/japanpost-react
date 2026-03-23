import { describe, expect, it } from "vitest";

import { normalizeJapanPostalCode } from "../src/core/formatters";

describe("normalizeJapanPostalCode", () => {
  it("strips separators while preserving a valid seven-digit postal code", () => {
    expect(normalizeJapanPostalCode("100-0001")).toBe("1000001");
    expect(normalizeJapanPostalCode("100 0001 ext")).toBe("1000001");
    expect(normalizeJapanPostalCode("000-0000")).toBe("0000000");
  });

  it("keeps extra digits instead of silently truncating the input", () => {
    expect(normalizeJapanPostalCode("100000123")).toBe("100000123");
  });
});
