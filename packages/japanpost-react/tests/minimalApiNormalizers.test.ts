import { describe, expect, it } from "vitest";

import { normalizeAddressRecord, normalizePostalCode } from "../../../apps/minimal-api/src/japanPost/normalizers";
import {
  normalizeAddressRecord as legacyNormalizeAddressRecord,
  normalizePostalCode as legacyNormalizePostalCode,
} from "../../../apps/minimal-api/src/adapter/normalizers";

describe("minimal api normalizers", () => {
  it("exposes the adapter shim as a re-export of the JapanPost normalizers", () => {
    expect(legacyNormalizePostalCode).toBe(normalizePostalCode);
    expect(legacyNormalizeAddressRecord).toBe(normalizeAddressRecord);
  });

  it("normalizes postal codes by stripping non-digits", () => {
    expect(normalizePostalCode(" 10-20072 ")).toBe("1020072");
  });

  it("normalizes raw address records into the current JapanAddress shape", () => {
    expect(
      normalizeAddressRecord({
        zip_code: "1020072",
        pref_name: "東京都",
        city_name: "千代田区",
        town_name: "飯田橋",
        address: "東京都 千代田区 飯田橋",
      }),
    ).toEqual({
      postalCode: "1020072",
      prefecture: "東京都",
      city: "千代田区",
      town: "飯田橋",
      address: "東京都 千代田区 飯田橋",
      provider: "japan-post",
    });
  });

  it("rejects malformed postal codes in raw address records", () => {
    expect(() =>
      normalizeAddressRecord({
        zip_code: "1234",
        pref_name: "Tokyo",
        city_name: "Chiyoda-ku",
        town_name: "Chiyoda",
      }),
    ).toThrow("Address provider returned an invalid postal code");
  });
});
