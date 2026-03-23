import { describe, expect, it } from "vitest";

import { isValidJapanPostalCode } from "../src/core/validators";

describe("isValidJapanPostalCode", () => {
  it("returns true only for inputs that normalize to seven digits", () => {
    expect(isValidJapanPostalCode("1000001")).toBe(true);
    expect(isValidJapanPostalCode("100-0001")).toBe(true);
    expect(isValidJapanPostalCode("0000000")).toBe(true);
    expect(isValidJapanPostalCode("000-0000")).toBe(true);
    expect(isValidJapanPostalCode("100001")).toBe(false);
    expect(isValidJapanPostalCode("10000012")).toBe(false);
    expect(isValidJapanPostalCode("abc")).toBe(false);
  });
});
