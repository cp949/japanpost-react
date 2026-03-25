import { describe, expect, it } from "vitest";
import {
  formatJapanAddressDisplay,
  formatJapanAddressSearchResultLabel,
} from "@cp949/japanpost-react";

const address = {
  postalCode: "1000001",
  prefecture: "Tokyo",
  city: "Chiyoda-ku",
  town: "Chiyoda",
  address: " Tokyo\nChiyoda-ku  Chiyoda ",
  provider: "japan-post" as const,
};

describe("address display helpers", () => {
  it("collapses whitespace in display text", () => {
    expect(formatJapanAddressDisplay(address)).toBe(
      "Tokyo Chiyoda-ku Chiyoda",
    );
  });

  it("builds a postal-code-prefixed result label", () => {
    expect(formatJapanAddressSearchResultLabel(address)).toBe(
      "100-0001 Tokyo Chiyoda-ku Chiyoda",
    );
  });
});
