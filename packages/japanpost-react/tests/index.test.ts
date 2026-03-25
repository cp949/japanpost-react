import type {
  AddressSearchInputProps,
  JapanAddress,
  JapanAddressDataSource,
  JapanAddressError,
  JapanAddressErrorCode,
  JapanAddressRequestOptions,
  JapanAddressSearchInput,
  JapanAddressSearchResult,
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
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";

const packageRoot = process.cwd();

describe("public exports", () => {
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

  it("type-checks the package entrypoint import path", () => {
    const tempDir = mkdtempSync(
      join(packageRoot, ".tmp-japanpost-react-typecheck-"),
    );
    const tempFile = join(tempDir, "entrypoint-typecheck.ts");
    const tempTsconfig = join(tempDir, "tsconfig.json");

    writeFileSync(
      tempFile,
      [
        'import type { JapanAddressSearchInput } from "@cp949/japanpost-react";',
        "",
        "const input: JapanAddressSearchInput = {",
        '  prefName: "東京都",',
        '  cityName: "千代田区",',
        "};",
        "",
        "void input;",
        "",
      ].join("\n"),
    );

    writeFileSync(
      tempTsconfig,
      JSON.stringify(
        {
          compilerOptions: {
            baseUrl: packageRoot,
            lib: ["ES2020", "DOM", "DOM.Iterable"],
            module: "ESNext",
            moduleResolution: "bundler",
            noEmit: true,
            paths: {
              "@cp949/japanpost-react": ["src/index.ts"],
            },
            jsx: "react-jsx",
            skipLibCheck: true,
            strict: true,
            target: "ES2020",
            types: ["node", "react"],
            isolatedModules: true,
            resolveJsonModule: true,
            allowImportingTsExtensions: true,
            ignoreDeprecations: "6.0",
            useDefineForClassFields: true,
            noUnusedLocals: true,
            noUnusedParameters: true,
            noFallthroughCasesInSwitch: true,
          },
          files: ["entrypoint-typecheck.ts"],
        },
        null,
        2,
      ),
    );

    try {
      execFileSync(
        "pnpm",
        ["exec", "tsc", "--project", tempTsconfig, "--pretty", "false"],
        {
          cwd: tempDir,
          stdio: "pipe",
        },
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("type-checks a wider set of public type exports from the package entrypoint", () => {
    const tempDir = mkdtempSync(
      join(packageRoot, ".tmp-japanpost-react-public-type-exports-"),
    );
    const tempFile = join(tempDir, "public-type-exports.ts");
    const tempTsconfig = join(tempDir, "tsconfig.json");

    writeFileSync(
      tempFile,
      [
        "import type {",
        "  AddressSearchInputProps,",
        "  JapanAddress,",
        "  JapanAddressDataSource,",
        "  JapanAddressError,",
        "  JapanAddressErrorCode,",
        "  JapanAddressRequestOptions,",
        "  JapanAddressSearchResult,",
        "  JapanPostalCodeLookupResult,",
        "  Page,",
        "  PostalCodeInputProps,",
        "  UseJapanAddressOptions,",
        "  UseJapanAddressSearchOptions,",
        "  UseJapanAddressSearchResult,",
        "  UseJapanPostalCodeOptions,",
        "  UseJapanPostalCodeResult,",
        '} from "@cp949/japanpost-react";',
        "",
        "declare const address: JapanAddress;",
        "declare const error: JapanAddressError;",
        "declare const code: JapanAddressErrorCode;",
        "declare const options: JapanAddressRequestOptions;",
        "declare const postalResult: JapanPostalCodeLookupResult;",
        "declare const addressResult: JapanAddressSearchResult;",
        "declare const page: Page<JapanAddress>;",
        "declare const dataSource: JapanAddressDataSource;",
        "declare const postalProps: PostalCodeInputProps;",
        "declare const addressProps: AddressSearchInputProps;",
        "declare const postalOptions: UseJapanPostalCodeOptions;",
        "declare const addressOptions: UseJapanAddressSearchOptions;",
        "declare const combinedOptions: UseJapanAddressOptions;",
        "declare const postalHookResult: UseJapanPostalCodeResult;",
        "declare const addressHookResult: UseJapanAddressSearchResult;",
        "",
        "void address;",
        "void error;",
        "void code;",
        "void options;",
        "void postalResult;",
        "void addressResult;",
        "void page;",
        "void dataSource;",
        "void postalProps;",
        "void addressProps;",
        "void postalOptions;",
        "void addressOptions;",
        "void combinedOptions;",
        "void postalHookResult;",
        "void addressHookResult;",
        "",
      ].join("\n"),
    );

    writeFileSync(
      tempTsconfig,
      JSON.stringify(
        {
          compilerOptions: {
            baseUrl: packageRoot,
            lib: ["ES2020", "DOM", "DOM.Iterable"],
            module: "ESNext",
            moduleResolution: "bundler",
            noEmit: true,
            paths: {
              "@cp949/japanpost-react": ["src/index.ts"],
            },
            jsx: "react-jsx",
            skipLibCheck: true,
            strict: true,
            target: "ES2020",
            types: ["node", "react"],
            isolatedModules: true,
            resolveJsonModule: true,
            allowImportingTsExtensions: true,
            ignoreDeprecations: "6.0",
            useDefineForClassFields: true,
            noUnusedLocals: true,
            noUnusedParameters: true,
            noFallthroughCasesInSwitch: true,
          },
          files: ["public-type-exports.ts"],
        },
        null,
        2,
      ),
    );

    try {
      execFileSync(
        "pnpm",
        ["exec", "tsc", "--project", tempTsconfig, "--pretty", "false"],
        {
          cwd: tempDir,
          stdio: "pipe",
        },
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("type-checks combined-hook object search inputs from the package entrypoint", () => {
    const tempDir = mkdtempSync(
      join(packageRoot, ".tmp-japanpost-react-combined-hook-typecheck-"),
    );
    const tempFile = join(tempDir, "combined-hook-typecheck.ts");
    const tempTsconfig = join(tempDir, "tsconfig.json");

    writeFileSync(
      tempFile,
      [
        'import type { UseJapanAddressResult } from "@cp949/japanpost-react";',
        "",
        "declare const result: UseJapanAddressResult;",
        "",
        "void result.searchByPostalCode({",
        '  postalCode: "100-0001",',
        "  pageNumber: 2,",
        "  rowsPerPage: 25,",
        "  includeParenthesesTown: true,",
        "});",
        "",
        "void result.searchByAddressQuery({",
        '  prefName: "東京都",',
        '  cityName: "千代田区",',
        "  pageNumber: 1,",
        "  rowsPerPage: 10,",
        "  includeCityDetails: true,",
        "  includePrefectureDetails: false,",
        "});",
        "",
      ].join("\n"),
    );

    writeFileSync(
      tempTsconfig,
      JSON.stringify(
        {
          compilerOptions: {
            baseUrl: packageRoot,
            lib: ["ES2020", "DOM", "DOM.Iterable"],
            module: "ESNext",
            moduleResolution: "bundler",
            noEmit: true,
            paths: {
              "@cp949/japanpost-react": ["src/index.ts"],
            },
            jsx: "react-jsx",
            skipLibCheck: true,
            strict: true,
            target: "ES2020",
            types: ["node", "react"],
            isolatedModules: true,
            resolveJsonModule: true,
            allowImportingTsExtensions: true,
            ignoreDeprecations: "6.0",
            useDefineForClassFields: true,
            noUnusedLocals: true,
            noUnusedParameters: true,
            noFallthroughCasesInSwitch: true,
          },
          files: ["combined-hook-typecheck.ts"],
        },
        null,
        2,
      ),
    );

    try {
      execFileSync(
        "pnpm",
        ["exec", "tsc", "--project", tempTsconfig, "--pretty", "false"],
        {
          cwd: tempDir,
          stdio: "pipe",
        },
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
