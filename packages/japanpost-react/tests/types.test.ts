import { describe, expect, it, expectTypeOf } from "vitest";

import type { NormalizedJapanAddressRecord } from "../src";
import type {
  JapanAddress,
  JapanPostApiAddressRecord,
  JapanAddressDataSource,
  JapanAddressError,
  JapanAddressErrorCode,
  JapanPostAddressZipResponse,
  JapanPostSearchCodeResponse,
  PostalCodeInputProps,
  AddressSearchInputProps,
  UseJapanAddressOptions,
  UseJapanAddressSearchOptions,
  UseJapanPostalCodeOptions,
} from "../src/core/types";

describe("core types", () => {
  it("models the data-source and public response contracts", () => {
    const address: JapanAddress = {
      postalCode: "1000001",
      prefecture: "Tokyo",
      prefectureKana: "トウキョウト",
      city: "Chiyoda-ku",
      cityKana: "チヨダク",
      town: "Chiyoda",
      townKana: "チヨダ",
      address: "Tokyo Chiyoda-ku Chiyoda",
      provider: "japan-post",
    };

    const dataSource: JapanAddressDataSource = {
      async lookupPostalCode() {
        return [address];
      },
      async searchAddress() {
        return [address];
      },
    };
    const postalCodeInputProps: PostalCodeInputProps = {
      value: "1000001",
      onChange() {},
      onSearch() {},
    };
    const addressSearchInputProps: AddressSearchInputProps = {
      value: "Tokyo",
      onChange() {},
      onSearch() {},
    };

    const record: JapanPostApiAddressRecord = {
      zip_code: "1000001",
      pref_name: "Tokyo",
      city_name: "Chiyoda-ku",
      town_name: "Chiyoda",
    };
    const searchCodeResponse: JapanPostSearchCodeResponse = {
      addresses: [record],
    };
    const addressZipResponse: JapanPostAddressZipResponse = {
      addresses: [record],
    };

    expect(address.provider).toBe("japan-post");
    expect(dataSource.lookupPostalCode).toBeTypeOf("function");
    expect(postalCodeInputProps.value).toBe("1000001");
    expect(addressSearchInputProps.value).toBe("Tokyo");
    expect(searchCodeResponse.addresses?.[0]?.zip_code).toBe("1000001");
    expect(addressZipResponse.addresses?.[0]?.zip_code).toBe("1000001");
    expect(address).not.toHaveProperty("formattedAddress");
  });
});

expectTypeOf<JapanAddressError["name"]>().toEqualTypeOf<"JapanAddressError">();
expectTypeOf<NormalizedJapanAddressRecord>().toMatchTypeOf<{
  postalCode: string;
  prefecture: string;
  city: string;
  town: string;
}>();
expectTypeOf<JapanAddressErrorCode>().toMatchTypeOf<
  | "invalid_postal_code"
  | "invalid_query"
  | "network_error"
  | "timeout"
  | "not_found"
  | "bad_response"
  | "data_source_error"
>();

// @ts-expect-error dataSource is required for postal-code hooks
const invalidPostalCodeOptions: UseJapanPostalCodeOptions = {};

// @ts-expect-error dataSource is required for keyword-search hooks
const invalidAddressSearchOptions: UseJapanAddressSearchOptions = {};

// @ts-expect-error dataSource is required for combined hooks
const invalidJapanAddressOptions: UseJapanAddressOptions = {};

void invalidPostalCodeOptions;
void invalidAddressSearchOptions;
void invalidJapanAddressOptions;
