import { describe, expect, it } from "vitest";
import * as library from "../src";

describe("public exports", () => {
  it("exports the public API surface", () => {
    expect(library.normalizeJapanPostalCode).toBeTypeOf("function");
    expect(library.useJapanAddress).toBeTypeOf("function");
  });
});
