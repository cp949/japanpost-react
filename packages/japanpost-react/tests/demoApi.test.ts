import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDemoApiDataSource,
  readDemoApiHealth,
} from "../../../apps/demo/src/demoApi";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("demo API integration helpers", () => {
  it("supports relative API base paths for browser-served demos", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        elements: [],
        totalElements: 0,
        pageNumber: 0,
        rowsPerPage: 20,
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const dataSource = createDemoApiDataSource("/minimal-api");

    await expect(dataSource.lookupPostalCode("1000001")).resolves.toEqual({
      elements: [],
      totalElements: 0,
      pageNumber: 0,
      rowsPerPage: 20,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/minimal-api/q/japanpost/searchcode",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          value: "1000001",
          pageNumber: 0,
          rowsPerPage: 20,
        }),
        signal: undefined,
      },
    );
  });

  it("posts addresszip requests and returns the full pager payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        elements: [{ postalCode: "1000004", address: "Tokyo Chiyoda Otemachi" }],
        totalElements: 1,
        pageNumber: 0,
        rowsPerPage: 20,
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const dataSource = createDemoApiDataSource("/minimal-api");

    await expect(dataSource.searchAddress("Tokyo")).resolves.toEqual({
      elements: [{ postalCode: "1000004", address: "Tokyo Chiyoda Otemachi" }],
      totalElements: 1,
      pageNumber: 0,
      rowsPerPage: 20,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/minimal-api/q/japanpost/addresszip",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          freeword: "Tokyo",
          pageNumber: 0,
          rowsPerPage: 20,
          includeCityDetails: false,
          includePrefectureDetails: false,
        }),
        signal: undefined,
      },
    );
  });

  it("supports relative API health paths for browser-served demos", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(readDemoApiHealth("/minimal-api")).resolves.toEqual({
      ok: true,
    });
    expect(fetchMock).toHaveBeenCalledWith("/minimal-api/health");
  });

  it("maps 404 API responses into structured not_found errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        error: "No matching addresses found",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const dataSource = createDemoApiDataSource("http://localhost:8787");

    await expect(dataSource.lookupPostalCode("9999999")).rejects.toMatchObject({
      name: "JapanAddressError",
      code: "not_found",
      status: 404,
      message: "No matching addresses found",
    });
  });

  it("maps 500 API responses into structured data source errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        error: "JAPAN_POST_CLIENT_ID is required",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const dataSource = createDemoApiDataSource("http://localhost:8787");

    await expect(dataSource.searchAddress("Tokyo")).rejects.toMatchObject({
      name: "JapanAddressError",
      code: "data_source_error",
      status: 500,
      message: "JAPAN_POST_CLIENT_ID is required",
    });
  });

  it("maps 400 postal-code API responses into invalid_postal_code errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: "Postal code must contain between 3 and 7 digits",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const dataSource = createDemoApiDataSource("http://localhost:8787");

    await expect(dataSource.lookupPostalCode("12")).rejects.toMatchObject({
      name: "JapanAddressError",
      code: "invalid_postal_code",
      status: 400,
      message: "Postal code must contain between 3 and 7 digits",
    });
  });

  it("maps 400 address-search API responses into invalid_query errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: "At least one search field must be provided",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const dataSource = createDemoApiDataSource("http://localhost:8787");

    await expect(dataSource.searchAddress("")).rejects.toMatchObject({
      name: "JapanAddressError",
      code: "invalid_query",
      status: 400,
      message: "At least one search field must be provided",
    });
  });

  it("maps 504 API responses into timeout errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 504,
      json: async () => ({
        error: "Address provider request timed out",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const dataSource = createDemoApiDataSource("http://localhost:8787");

    await expect(dataSource.searchAddress("Tokyo")).rejects.toMatchObject({
      name: "JapanAddressError",
      code: "timeout",
      status: 504,
      message: "Address provider request timed out",
    });
  });

  it("maps aborted requests into structured timeout errors", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new DOMException("The operation was aborted.", "AbortError"));

    vi.stubGlobal("fetch", fetchMock);

    const dataSource = createDemoApiDataSource("http://localhost:8787");

    await expect(dataSource.searchAddress("Tokyo")).rejects.toMatchObject({
      name: "JapanAddressError",
      code: "timeout",
      message: "Request timed out",
    });
  });

  it("rejects malformed success payloads with bad_response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        elements: null,
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const dataSource = createDemoApiDataSource("http://localhost:8787");

    await expect(dataSource.lookupPostalCode("1000001")).rejects.toMatchObject({
      name: "JapanAddressError",
      code: "bad_response",
      message: "Response payload must include a valid page payload",
    });
  });

  it("keeps 503 health payloads readable without throwing", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        ok: false,
        error: "JAPAN_POST_SECRET_KEY is required",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(readDemoApiHealth("http://localhost:8787")).resolves.toEqual(
      {
        ok: false,
        error: "JAPAN_POST_SECRET_KEY is required",
      },
    );
  });

  it("maps unreachable health requests into a stable message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    await expect(readDemoApiHealth("http://localhost:8787")).rejects.toThrow(
      "Demo API server is unreachable",
    );
  });

  it("rejects invalid health payload JSON with a stable message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token < in JSON");
        },
      }),
    );

    await expect(readDemoApiHealth("http://localhost:8787")).rejects.toThrow(
      "Demo API health response was not valid JSON",
    );
  });
});
