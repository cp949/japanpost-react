import { describe, expect, it, vi } from "vitest";

import {
  createJapanPostApiDataSource,
  type JapanPostApiClient,
  type Page,
} from "@cp949/japanpost-react";

describe("createJapanPostApiDataSource", () => {
  type PageWithoutProvider = Page<{
    postalCode: string;
    prefecture: string;
    city: string;
    town: string;
    address: string;
  }>;

  it("maps api methods to the JapanAddressDataSource contract", async () => {
    const searchcode = vi.fn(async (request) => ({
      elements: [
        {
          postalCode: request.postalCode,
          prefecture: "Tokyo",
          city: "Chiyoda-ku",
          town: "Chiyoda",
          address: "Tokyo Chiyoda-ku Chiyoda",
        },
      ],
      totalElements: 1,
      pageNumber: 0,
      rowsPerPage: 10,
    }));
    const addresszip = vi.fn(async () => ({
      elements: [],
      totalElements: 0,
      pageNumber: 0,
      rowsPerPage: 10,
    }));

    const dataSource = createJapanPostApiDataSource(
      { searchcode, addresszip },
      {
        createContext(options) {
          return options?.signal ? { signal: options.signal } : undefined;
        },
        mapPage(page) {
          return {
            ...page,
            elements: page.elements.map((element) => ({
              ...element,
              provider: "japan-post" as const,
            })),
          };
        },
      },
    );

    const controller = new AbortController();
    await expect(
      dataSource.lookupPostalCode(
      {
        postalCode: "1000001",
        pageNumber: 0,
        rowsPerPage: 10,
      },
      { signal: controller.signal },
      ),
    ).resolves.toEqual({
      elements: [
        expect.objectContaining({
          postalCode: "1000001",
          prefecture: "Tokyo",
          city: "Chiyoda-ku",
          town: "Chiyoda",
          address: "Tokyo Chiyoda-ku Chiyoda",
          provider: "japan-post",
        }),
      ],
      totalElements: 1,
      pageNumber: 0,
      rowsPerPage: 10,
    });

    expect(searchcode).toHaveBeenCalledWith(
      expect.objectContaining({
        postalCode: "1000001",
        ctx: { signal: controller.signal },
      }),
    );
  });

  it("uses addresszip for searchAddress requests", async () => {
    const searchcode = vi.fn(async () => ({
      elements: [],
      totalElements: 0,
      pageNumber: 0,
      rowsPerPage: 10,
    }));
    const addresszip = vi.fn(async () => ({
      elements: [
        {
          postalCode: "1000001",
          prefecture: "Tokyo",
          city: "Chiyoda-ku",
          town: "Chiyoda",
          address: "Tokyo Chiyoda-ku Chiyoda",
          provider: "japan-post" as const,
        },
      ],
      totalElements: 1,
      pageNumber: 0,
      rowsPerPage: 10,
    }));

    const dataSource = createJapanPostApiDataSource({ searchcode, addresszip });

    await dataSource.searchAddress({
      addressQuery: "Tokyo",
      pageNumber: 0,
      rowsPerPage: 10,
    });

    expect(addresszip).toHaveBeenCalledTimes(1);
    expect(searchcode).not.toHaveBeenCalled();
  });

  it("omits ctx when createContext is not provided", async () => {
    const searchcode = vi.fn(async (request) => ({
      elements: [],
      totalElements: 0,
      pageNumber: request.pageNumber,
      rowsPerPage: request.rowsPerPage,
    }));
    const addresszip = vi.fn(async () => ({
      elements: [],
      totalElements: 0,
      pageNumber: 0,
      rowsPerPage: 10,
    }));

    const dataSource = createJapanPostApiDataSource({ searchcode, addresszip });

    await dataSource.lookupPostalCode({
      postalCode: "1000001",
      pageNumber: 0,
      rowsPerPage: 10,
    });

    expect(searchcode).toHaveBeenCalledWith(
      expect.objectContaining({
        postalCode: "1000001",
      }),
    );
    expect(searchcode.mock.calls[0]?.[0]).not.toHaveProperty("ctx");
  });

  it("returns the page unchanged when mapPage is not provided", async () => {
    const page = {
      elements: [
        {
          postalCode: "1000001",
          prefecture: "Tokyo",
          city: "Chiyoda-ku",
          town: "Chiyoda",
          address: "Tokyo Chiyoda-ku Chiyoda",
          provider: "japan-post" as const,
        },
      ],
      totalElements: 1,
      pageNumber: 0,
      rowsPerPage: 10,
    };
    const searchcode = vi.fn(async () => page);
    const addresszip = vi.fn(async () => page);

    const dataSource = createJapanPostApiDataSource({ searchcode, addresszip });

    await expect(
      dataSource.lookupPostalCode({
        postalCode: "1000001",
        pageNumber: 0,
        rowsPerPage: 10,
      }),
    ).resolves.toEqual(page);
  });

  it("requires mapPage when the api returns a page without provider", async () => {
    const api: JapanPostApiClient<unknown, PageWithoutProvider> = {
      searchcode: async () =>
        ({
          elements: [
            {
              postalCode: "1000001",
              prefecture: "Tokyo",
              city: "Chiyoda-ku",
              town: "Chiyoda",
              address: "Tokyo Chiyoda-ku Chiyoda",
            },
          ],
          totalElements: 1,
          pageNumber: 0,
          rowsPerPage: 10,
        }) satisfies PageWithoutProvider,
      addresszip: async () =>
        ({
          elements: [],
          totalElements: 0,
          pageNumber: 0,
          rowsPerPage: 10,
        }) satisfies PageWithoutProvider,
    };

    // @ts-expect-error mapPage is required when the upstream page is not already Page<JapanAddress>
    createJapanPostApiDataSource(api);

    expect(api.searchcode).toBeTypeOf("function");
  });

  it("accepts a page without provider when mapPage is provided", async () => {
    const api: JapanPostApiClient<unknown, PageWithoutProvider> = {
      searchcode: async () =>
        ({
          elements: [
            {
              postalCode: "1000001",
              prefecture: "Tokyo",
              city: "Chiyoda-ku",
              town: "Chiyoda",
              address: "Tokyo Chiyoda-ku Chiyoda",
            },
          ],
          totalElements: 1,
          pageNumber: 0,
          rowsPerPage: 10,
        }) satisfies PageWithoutProvider,
      addresszip: async () =>
        ({
          elements: [],
          totalElements: 0,
          pageNumber: 0,
          rowsPerPage: 10,
        }) satisfies PageWithoutProvider,
    };

    const dataSource = createJapanPostApiDataSource(api, {
      mapPage(page) {
        return {
          ...page,
          elements: page.elements.map((element) => ({
            ...element,
            provider: "japan-post" as const,
          })),
        };
      },
    });

    expect(dataSource).toBeDefined();
  });
});
