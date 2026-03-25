import {
  createJapanPostFetchDataSource,
  type JapanAddress,
  type JapanPostAddresszipRequest,
  type JapanPostSearchcodeRequest,
  type Page,
} from "@cp949/japanpost-react";
import { describe, expect, it, vi } from "vitest";

const page: Page<JapanAddress> = {
  elements: [
    {
      postalCode: "1000001",
      prefecture: "Tokyo",
      city: "Chiyoda-ku",
      town: "Chiyoda",
      address: "Tokyo Chiyoda-ku Chiyoda",
      provider: "japan-post",
    },
  ],
  totalElements: 1,
  pageNumber: 0,
  rowsPerPage: 10,
};

function createResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

function createAbortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}

describe("createJapanPostFetchDataSource", () => {
  it("posts lookup requests to the configured endpoint", async () => {
    const fetchMock = vi.fn(async () => createResponse(page));

    const dataSource = createJapanPostFetchDataSource({
      baseUrl: "/minimal-api/",
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(
      dataSource.lookupPostalCode({
        postalCode: "1000001",
        pageNumber: 0,
        rowsPerPage: 10,
      }),
    ).resolves.toEqual(page);

    expect(fetchMock).toHaveBeenCalledWith(
      "/minimal-api/q/japanpost/searchcode",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          postalCode: "1000001",
          pageNumber: 0,
          rowsPerPage: 10,
        }),
      }),
    );
  });

  it("resolves the search endpoint with a custom path", async () => {
    const fetchMock = vi.fn(async () => createResponse(page));

    const dataSource = createJapanPostFetchDataSource({
      baseUrl: "/minimal-api/",
      fetch: fetchMock as unknown as typeof fetch,
      paths: {
        searchAddress: "custom/addresszip",
      },
    });

    await expect(
      dataSource.searchAddress({
        addressQuery: "Tokyo",
        pageNumber: 0,
        rowsPerPage: 10,
      }),
    ).resolves.toEqual(page);

    expect(fetchMock).toHaveBeenCalledWith(
      "/minimal-api/custom/addresszip",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          addressQuery: "Tokyo",
          pageNumber: 0,
          rowsPerPage: 10,
        }),
      }),
    );
  });

  it("maps an aborted request to timeout", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          throw createAbortError();
        }

        return new Promise<never>((_, reject) => {
          signal?.addEventListener("abort", () => reject(createAbortError()), {
            once: true,
          });
        });
      },
    );

    const dataSource = createJapanPostFetchDataSource({
      baseUrl: "/minimal-api",
      fetch: fetchMock as unknown as typeof fetch,
    });
    const controller = new AbortController();
    const lookupPromise = dataSource.lookupPostalCode(
      {
        postalCode: "1000001",
        pageNumber: 0,
        rowsPerPage: 10,
      },
      {
        signal: controller.signal,
      },
    );

    controller.abort();

    await expect(lookupPromise).rejects.toMatchObject({
      code: "timeout",
      status: 0,
    });
  });

  it("maps a thrown TypeError to network_error", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    const dataSource = createJapanPostFetchDataSource({
      baseUrl: "/minimal-api",
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(
      dataSource.lookupPostalCode({
        postalCode: "1000001",
        pageNumber: 0,
        rowsPerPage: 10,
      }),
    ).rejects.toMatchObject({
      code: "network_error",
    });
  });

  it("maps invalid JSON to bad_response", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    }));

    const dataSource = createJapanPostFetchDataSource({
      baseUrl: "/minimal-api",
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(
      dataSource.searchAddress({
        addressQuery: "Tokyo",
        pageNumber: 0,
        rowsPerPage: 10,
      }),
    ).rejects.toMatchObject({
      code: "bad_response",
    });
  });

  it("maps an invalid pager payload to bad_response", async () => {
    const fetchMock = vi.fn(async () =>
      createResponse({
        elements: [],
        totalElements: "1",
        pageNumber: 0,
        rowsPerPage: 10,
      }),
    );

    const dataSource = createJapanPostFetchDataSource({
      baseUrl: "/minimal-api",
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(
      dataSource.lookupPostalCode({
        postalCode: "1000001",
        pageNumber: 0,
        rowsPerPage: 10,
      }),
    ).rejects.toMatchObject({
      code: "bad_response",
    });
  });

  it.each([
    ["lookupPostalCode", "/q/japanpost/searchcode", "invalid_postal_code"],
    ["searchAddress", "/q/japanpost/addresszip", "invalid_query"],
  ] as const)(
    "maps HTTP 400 for %s at %s to %s",
    async (method, path, code) => {
      const fetchMock = vi.fn(async () =>
        createResponse(
          {
            message: "Request failed with status 400",
          },
          false,
          400,
        ),
      );

      const dataSource = createJapanPostFetchDataSource({
        baseUrl: "/minimal-api",
        fetch: fetchMock as unknown as typeof fetch,
      });

      if (method === "lookupPostalCode") {
        const request: JapanPostSearchcodeRequest = {
          postalCode: "1000001",
          pageNumber: 0,
          rowsPerPage: 10,
        };

        await expect(
          dataSource.lookupPostalCode(request),
        ).rejects.toMatchObject({
          code,
          status: 400,
        });

        expect(fetchMock).toHaveBeenCalledWith(
          `/minimal-api${path}`,
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify(request),
          }),
        );
      } else {
        const request: JapanPostAddresszipRequest = {
          addressQuery: "Tokyo",
          pageNumber: 0,
          rowsPerPage: 10,
        };

        await expect(dataSource.searchAddress(request)).rejects.toMatchObject({
          code,
          status: 400,
        });

        expect(fetchMock).toHaveBeenCalledWith(
          `/minimal-api${path}`,
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify(request),
          }),
        );
      }
    },
  );

  it.each([
    [
      "lookupPostalCode",
      {
        lookupPostalCode: "custom/postal-search",
      },
      "/custom/postal-search",
      "invalid_postal_code",
    ],
    [
      "searchAddress",
      {
        searchAddress: "custom/address-search",
      },
      "/custom/address-search",
      "invalid_query",
    ],
  ] as const)(
    "keeps %s 400 semantics with custom path overrides",
    async (method, paths, path, code) => {
      const fetchMock = vi.fn(async () =>
        createResponse(
          {
            message: "Request failed with status 400",
          },
          false,
          400,
        ),
      );

      const dataSource = createJapanPostFetchDataSource({
        baseUrl: "/minimal-api",
        fetch: fetchMock as unknown as typeof fetch,
        paths,
      });

      if (method === "lookupPostalCode") {
        const request: JapanPostSearchcodeRequest = {
          postalCode: "1000001",
          pageNumber: 0,
          rowsPerPage: 10,
        };

        await expect(
          dataSource.lookupPostalCode(request),
        ).rejects.toMatchObject({
          code,
          status: 400,
        });

        expect(fetchMock).toHaveBeenCalledWith(
          `/minimal-api${path}`,
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify(request),
          }),
        );
      } else {
        const request: JapanPostAddresszipRequest = {
          addressQuery: "Tokyo",
          pageNumber: 0,
          rowsPerPage: 10,
        };

        await expect(dataSource.searchAddress(request)).rejects.toMatchObject({
          code,
          status: 400,
        });

        expect(fetchMock).toHaveBeenCalledWith(
          `/minimal-api${path}`,
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify(request),
          }),
        );
      }
    },
  );

  it.each([
    [404, "not_found"],
    [504, "timeout"],
    [500, "data_source_error"],
  ] as const)("maps HTTP %s to %s", async (status, code) => {
    const fetchMock = vi.fn(async () =>
      createResponse(
        {
          message: `Request failed with status ${status}`,
        },
        false,
        status,
      ),
    );

    const dataSource = createJapanPostFetchDataSource({
      baseUrl: "/minimal-api",
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(
      dataSource.searchAddress({
        addressQuery: "Tokyo",
        pageNumber: 0,
        rowsPerPage: 10,
      }),
    ).rejects.toMatchObject({
      code,
      status,
    });
  });

  it("uses the backend error field when the response body does not include message", async () => {
    const fetchMock = vi.fn(async () =>
      createResponse(
        {
          error: "Postal code must contain between 3 and 7 digits",
        },
        false,
        400,
      ),
    );

    const dataSource = createJapanPostFetchDataSource({
      baseUrl: "/minimal-api",
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(
      dataSource.lookupPostalCode({
        postalCode: "12",
        pageNumber: 0,
        rowsPerPage: 10,
      }),
    ).rejects.toMatchObject({
      code: "invalid_postal_code",
      status: 400,
      message: "Postal code must contain between 3 and 7 digits",
    });
  });
});
