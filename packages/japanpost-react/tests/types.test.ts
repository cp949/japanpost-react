import { describe, expect, it, expectTypeOf } from "vitest";

import type {
  JapanPostAddresszipRequest,
  JapanPostSearchcodeRequest,
  NormalizedJapanAddressRecord,
} from "../src";
import type {
  JapanAddress,
  JapanPostApiAddressRecord,
  JapanAddressDataSource,
  Page,
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
    const page: Page<JapanAddress> = {
      elements: [address],
      totalElements: 1,
      pageNumber: 0,
      rowsPerPage: 20,
    };

    const dataSource: JapanAddressDataSource = {
      async lookupPostalCode(_request) {
        return page;
      },
      async searchAddress(_request) {
        return page;
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
    expect(page.elements[0]?.postalCode).toBe("1000001");
    expect(page.totalElements).toBe(1);
    expect(address).not.toHaveProperty("formattedAddress");
  });
});

expectTypeOf<JapanAddressError["name"]>().toEqualTypeOf<"JapanAddressError">();
expectTypeOf<NormalizedJapanAddressRecord>().toExtend<{
  postalCode: string;
  prefecture: string;
  city: string;
  town: string;
}>();
expectTypeOf<Page<JapanAddress>>().toExtend<{
  elements: JapanAddress[];
  totalElements: number;
  pageNumber: number;
  rowsPerPage: number;
}>();
expectTypeOf<JapanPostSearchcodeRequest>().toExtend<{
  postalCode: string;
  pageNumber: number;
  rowsPerPage: number;
}>();
type HasIncludeBusinessAddresses =
  "includeBusinessAddresses" extends keyof JapanPostSearchcodeRequest
    ? true
    : false;
expectTypeOf<HasIncludeBusinessAddresses>().toEqualTypeOf<false>();

expectTypeOf<JapanPostAddresszipRequest>().toExtend<{
  addressQuery?: string | null;
  pageNumber: number;
  rowsPerPage: number;
}>();
expectTypeOf<JapanAddressErrorCode>().toExtend<
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
