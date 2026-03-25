import type {
  AddressSearchInputProps,
  JapanAddress,
  JapanAddressDataSource,
  JapanAddressError,
  JapanAddressErrorCode,
  JapanAddressRequestOptions,
  JapanAddressSearchInput,
  JapanAddressSearchResult,
  JapanPostSearchcodeRequest,
  JapanPostalCodeLookupResult,
  JapanPostalCodeSearchInput,
  Page,
  PostalCodeInputProps,
  UseJapanAddressOptions,
  UseJapanAddressResult,
  UseJapanAddressSearchOptions,
  UseJapanAddressSearchResult,
  UseJapanPostalCodeOptions,
  UseJapanPostalCodeResult,
} from "@cp949/japanpost-react";
import * as library from "@cp949/japanpost-react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";

const packageRoot = process.cwd();

describe("public exports", () => {
  it("declares only the root and client package exports", () => {
    const packageJson = JSON.parse(
      readFileSync(join(packageRoot, "package.json"), "utf8"),
    ) as {
      exports: Record<string, unknown>;
    };

    expect(Object.keys(packageJson.exports)).toEqual([".", "./client"]);
  });

  it("exports the public API surface", () => {
    expect(library.AddressSearchInput).toMatchObject({
      $$typeof: Symbol.for("react.forward_ref"),
      render: expect.any(Function),
    });
    expect(library.PostalCodeInput).toMatchObject({
      $$typeof: Symbol.for("react.forward_ref"),
      render: expect.any(Function),
    });
    expect(library).toEqual(
      expect.objectContaining({
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

  it("exports the public postal-code search input type", () => {
    expectTypeOf<JapanPostalCodeSearchInput>().toEqualTypeOf<
      | string
      | {
          postalCode: string;
          pageNumber?: number;
          rowsPerPage?: number;
          includeParenthesesTown?: boolean | null;
        }
    >();
  });

  it("exports the public address search input type", () => {
    expectTypeOf<JapanAddressSearchInput>().toMatchTypeOf<
      | string
      | {
          addressQuery?: string | null;
          prefCode?: string | null;
          prefName?: string | null;
          prefKana?: string | null;
          prefRoma?: string | null;
          cityCode?: string | null;
          cityName?: string | null;
          cityKana?: string | null;
          cityRoma?: string | null;
          townName?: string | null;
          townKana?: string | null;
          townRoma?: string | null;
          pageNumber?: number;
          rowsPerPage?: number;
          includeCityDetails?: boolean | null;
          includePrefectureDetails?: boolean | null;
        }
    >();
  });

  it("exports the shared page and address contracts", () => {
    expectTypeOf<Page<JapanAddress>>().toEqualTypeOf<{
      elements: JapanAddress[];
      totalElements: number;
      pageNumber: number;
      rowsPerPage: number;
    }>();

    expectTypeOf<JapanAddress>().toMatchTypeOf<{
      postalCode: string;
      prefecture: string;
      city: string;
      town: string;
      address: string;
      provider: "japan-post";
    }>();

    expectTypeOf<JapanPostSearchcodeRequest>().toEqualTypeOf<{
      postalCode: string;
      pageNumber: number;
      rowsPerPage: number;
      includeParenthesesTown?: boolean | null;
    }>();

    expectTypeOf<import("@cp949/japanpost-react").JapanPostAddresszipRequest>().toEqualTypeOf<{
      addressQuery?: string | null;
      prefCode?: string | null;
      prefName?: string | null;
      prefKana?: string | null;
      prefRoma?: string | null;
      cityCode?: string | null;
      cityName?: string | null;
      cityKana?: string | null;
      cityRoma?: string | null;
      townName?: string | null;
      townKana?: string | null;
      townRoma?: string | null;
      pageNumber: number;
      rowsPerPage: number;
      includeCityDetails?: boolean | null;
      includePrefectureDetails?: boolean | null;
    }>();
  });

  it("exports the public error and request option contracts", () => {
    expectTypeOf<JapanAddressErrorCode>().toEqualTypeOf<
      | "invalid_postal_code"
      | "invalid_query"
      | "network_error"
      | "timeout"
      | "not_found"
      | "bad_response"
      | "data_source_error"
    >();

    expectTypeOf<JapanAddressError>().toMatchTypeOf<
      Error & {
        name: "JapanAddressError";
        code: JapanAddressErrorCode;
        cause?: unknown;
        status?: number;
      }
    >();

    expectTypeOf<JapanAddressRequestOptions>().toEqualTypeOf<{
      signal?: AbortSignal;
    }>();
  });

  it("exports the hook option and result contracts", () => {
    expectTypeOf<UseJapanPostalCodeOptions>().toEqualTypeOf<{
      dataSource: JapanAddressDataSource;
    }>();
    expectTypeOf<UseJapanAddressSearchOptions>().toEqualTypeOf<{
      dataSource: JapanAddressDataSource;
      debounceMs?: number;
    }>();
    expectTypeOf<UseJapanAddressOptions>().toEqualTypeOf<{
      dataSource: JapanAddressDataSource;
      debounceMs?: number;
    }>();

    expectTypeOf<
      UseJapanPostalCodeResult["data"]
    >().toEqualTypeOf<JapanPostalCodeLookupResult | null>();
    expectTypeOf<
      UseJapanAddressSearchResult["data"]
    >().toEqualTypeOf<JapanAddressSearchResult | null>();
  });

  it("exports the headless component prop contracts", () => {
    expectTypeOf<PostalCodeInputProps>().toMatchTypeOf<{
      onChange?: (postalCode: string) => void;
      onSearch: (postalCode: string) => void;
    }>();

    expectTypeOf<AddressSearchInputProps>().toMatchTypeOf<{
      onChange?: (query: string) => void;
      onSearch: (query: string) => void;
    }>();
  });

  it("exports combined-hook search signatures that accept the public input objects", () => {
    expectTypeOf<
      UseJapanAddressResult["searchByPostalCode"]
    >().parameters.toEqualTypeOf<[JapanPostalCodeSearchInput]>();
    expectTypeOf<
      UseJapanAddressResult["searchByAddressQuery"]
    >().parameters.toEqualTypeOf<[JapanAddressSearchInput]>();
  });
});
