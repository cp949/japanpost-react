import { describe, expect, it } from "vitest";

import { normalizeJapanPostAddressRecord } from "../src/core/normalizers";

describe("normalizeJapanPostAddressRecord", () => {
  it("maps a normalized record into the public address shape", () => {
    const result = normalizeJapanPostAddressRecord({
      postalCode: "1000001",
      prefecture: "Tokyo",
      prefectureKana: "トウキョウト",
      city: "Chiyoda-ku",
      cityKana: "チヨダク",
      town: "Chiyoda",
      townKana: "チヨダ",
    });

    expect(result).toEqual({
      postalCode: "1000001",
      prefecture: "Tokyo",
      prefectureKana: "トウキョウト",
      city: "Chiyoda-ku",
      cityKana: "チヨダク",
      town: "Chiyoda",
      townKana: "チヨダ",
      address: "Tokyo Chiyoda-ku Chiyoda",
      provider: "japan-post",
    });

    expect(result).not.toHaveProperty("formattedAddress");
  });
});
