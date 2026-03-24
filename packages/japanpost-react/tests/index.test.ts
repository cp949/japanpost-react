import { describe, expect, it } from "vitest";
import * as library from "../src";

describe("public exports", () => {
  it("exports the public API surface", () => {
    expect(library).toEqual(
      expect.objectContaining({
        AddressSearchInput: expect.any(Function),
        PostalCodeInput: expect.any(Function),
        createJapanAddressError: expect.any(Function),
        formatJapanPostalCode: expect.any(Function),
        isValidJapanPostalCode: expect.any(Function),
        normalizeJapanPostalCode: expect.any(Function),
        normalizeJapanPostAddressRecord: expect.any(Function),
        useJapanAddress: expect.any(Function),
        useJapanAddressSearch: expect.any(Function),
        useJapanPostalCode: expect.any(Function),
      }),
    );
  });
});
