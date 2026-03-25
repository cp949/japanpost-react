import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDemoApiDataSource,
  readDemoApiHealth,
} from "../../apps/demo/src/demoApi";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("demo API contract", () => {
  it("keeps 503 health payloads readable without throwing", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        ok: false,
        error: "warming up",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(readDemoApiHealth("http://localhost:8787")).resolves.toEqual({
      ok: false,
      error: "warming up",
    });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8787/health");
  });

  it("maps backend 404 lookup responses into not_found errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        detail: "No matching addresses found",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const dataSource = createDemoApiDataSource("http://localhost:8787");

    await expect(
      dataSource.lookupPostalCode({
        postalCode: "5555555",
        pageNumber: 0,
        rowsPerPage: 100,
      }),
    ).rejects.toMatchObject({
      name: "JapanAddressError",
      code: "not_found",
      status: 404,
      message: "Request failed with status 404",
    });
  });

  it("maps 504 address-search responses into timeout errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 504,
      json: async () => ({
        detail: "Address provider request timed out",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const dataSource = createDemoApiDataSource("http://localhost:8787");

    await expect(
      dataSource.searchAddress({
        addressQuery: "Tokyo",
        pageNumber: 0,
        rowsPerPage: 100,
      }),
    ).rejects.toMatchObject({
      name: "JapanAddressError",
      code: "timeout",
      status: 504,
      message: "Request failed with status 504",
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

    await expect(
      dataSource.lookupPostalCode({
        postalCode: "1000001",
        pageNumber: 0,
        rowsPerPage: 100,
      }),
    ).rejects.toMatchObject({
      name: "JapanAddressError",
      code: "bad_response",
      message: "Response payload must include a valid page payload",
    });
  });
});

describe("demo API integration helpers", () => {
  it("mirrors the demo searchcode route contract", async () => {
    const request = {
      postalCode: "1000001",
      pageNumber: 0,
      rowsPerPage: 100,
    };
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

    await expect(dataSource.lookupPostalCode(request)).resolves.toEqual({
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
        body: JSON.stringify(request),
        signal: undefined,
      },
    );
  });

  it("mirrors the demo addresszip route contract", async () => {
    const request = {
      addressQuery: "Tokyo",
      pageNumber: 0,
      rowsPerPage: 100,
    };
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

    await expect(dataSource.searchAddress(request)).resolves.toEqual({
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
        body: JSON.stringify(request),
        signal: undefined,
      },
    );
  });

  it("mirrors the demo health route contract", async () => {
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

  it("supports relative API base paths for browser-served demos", async () => {
    const request = {
      postalCode: "1000001",
      pageNumber: 0,
      rowsPerPage: 100,
    };
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

    await expect(dataSource.lookupPostalCode(request)).resolves.toEqual({
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
        body: JSON.stringify(request),
        signal: undefined,
      },
    );
  });

  it("posts addresszip requests and returns the full pager payload", async () => {
    const request = {
      addressQuery: "Tokyo",
      pageNumber: 0,
      rowsPerPage: 100,
    };
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

    await expect(dataSource.searchAddress(request)).resolves.toEqual({
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
        body: JSON.stringify(request),
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

  it("maps backend 404 API responses into structured not_found errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        detail: "No matching addresses found",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const dataSource = createDemoApiDataSource("http://localhost:8787");

    await expect(
      dataSource.lookupPostalCode({
        postalCode: "5555555",
        pageNumber: 0,
        rowsPerPage: 100,
      }),
    ).rejects.toMatchObject({
      name: "JapanAddressError",
      code: "not_found",
      status: 404,
      message: "Request failed with status 404",
    });
  });

  it("maps 500 API responses into structured data source errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        message: "JAPANPOST_CLIENT_ID is required",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const dataSource = createDemoApiDataSource("http://localhost:8787");

    await expect(
      dataSource.searchAddress({
        addressQuery: "Tokyo",
        pageNumber: 0,
        rowsPerPage: 100,
      }),
    ).rejects.toMatchObject({
      name: "JapanAddressError",
      code: "data_source_error",
      status: 500,
      message: "Request failed with status 500",
    });
  });

  it("maps failed responses by status without requiring a JSON error body", async () => {
    const json = vi.fn(async () => {
      throw new SyntaxError("Unexpected token < in JSON");
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json,
    });

    vi.stubGlobal("fetch", fetchMock);

    const dataSource = createDemoApiDataSource("http://localhost:8787");

    await expect(
      dataSource.searchAddress({
        addressQuery: "Tokyo",
        pageNumber: 0,
        rowsPerPage: 100,
      }),
    ).rejects.toMatchObject({
      name: "JapanAddressError",
      code: "data_source_error",
      status: 500,
      message: "Request failed with status 500",
    });
    expect(json).not.toHaveBeenCalled();
  });

  it("maps 400 postal-code API responses into invalid_postal_code errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        detail: "Postal code must contain between 3 and 7 digits",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const dataSource = createDemoApiDataSource("http://localhost:8787");

    await expect(
      dataSource.lookupPostalCode({
        postalCode: "12",
        pageNumber: 0,
        rowsPerPage: 100,
      }),
    ).rejects.toMatchObject({
      name: "JapanAddressError",
      code: "invalid_postal_code",
      status: 400,
      message: "Request failed with status 400",
    });
  });

  it("returns an empty page for blank address-search responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        elements: [],
        totalElements: 0,
        pageNumber: 0,
        rowsPerPage: 100,
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const dataSource = createDemoApiDataSource("http://localhost:8787");

    await expect(
      dataSource.searchAddress({
        addressQuery: "",
        pageNumber: 0,
        rowsPerPage: 100,
      }),
    ).resolves.toEqual({
      elements: [],
      totalElements: 0,
      pageNumber: 0,
      rowsPerPage: 100,
    });
  });

  it("returns an empty page for postal-code lookups when the backend responds with a successful miss page", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        elements: [],
        totalElements: 0,
        pageNumber: 0,
        rowsPerPage: 100,
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const dataSource = createDemoApiDataSource("http://localhost:8787");

    await expect(
      dataSource.lookupPostalCode({
        postalCode: "9999999",
        pageNumber: 0,
        rowsPerPage: 100,
      }),
    ).resolves.toEqual({
      elements: [],
      totalElements: 0,
      pageNumber: 0,
      rowsPerPage: 100,
    });
  });

  it("maps 400 address-search API responses into invalid_query errors by status", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        detail: "Validation failed",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const dataSource = createDemoApiDataSource("http://localhost:8787");

    await expect(
      dataSource.searchAddress({
        addressQuery: "",
        pageNumber: 0,
        rowsPerPage: 100,
      }),
    ).rejects.toMatchObject({
      name: "JapanAddressError",
      code: "invalid_query",
      status: 400,
      message: "Request failed with status 400",
    });
  });

  it("maps 504 API responses into timeout errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 504,
      json: async () => ({
        detail: "Address provider request timed out",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const dataSource = createDemoApiDataSource("http://localhost:8787");

    await expect(
      dataSource.searchAddress({
        addressQuery: "Tokyo",
        pageNumber: 0,
        rowsPerPage: 100,
      }),
    ).rejects.toMatchObject({
      name: "JapanAddressError",
      code: "timeout",
      status: 504,
      message: "Request failed with status 504",
    });
  });

  it("maps aborted requests into structured timeout errors", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new DOMException("The operation was aborted.", "AbortError"));

    vi.stubGlobal("fetch", fetchMock);

    const dataSource = createDemoApiDataSource("http://localhost:8787");

    await expect(
      dataSource.searchAddress({
        addressQuery: "Tokyo",
        pageNumber: 0,
        rowsPerPage: 100,
      }),
    ).rejects.toMatchObject({
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

    await expect(
      dataSource.lookupPostalCode({
        postalCode: "1000001",
        pageNumber: 0,
        rowsPerPage: 100,
      }),
    ).rejects.toMatchObject({
      name: "JapanAddressError",
      code: "bad_response",
      message: "Response payload must include a valid page payload",
    });
  });

  it("rejects malformed success JSON with bad_response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON");
      },
    });

    vi.stubGlobal("fetch", fetchMock);

    const dataSource = createDemoApiDataSource("http://localhost:8787");

    await expect(
      dataSource.lookupPostalCode({
        postalCode: "1000001",
        pageNumber: 0,
        rowsPerPage: 100,
      }),
    ).rejects.toMatchObject({
      name: "JapanAddressError",
      code: "bad_response",
      message: "Response payload was not valid JSON",
    });
  });

  it("keeps 503 health payloads readable without throwing", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        ok: false,
        error: "JAPANPOST_SECRET_KEY is required",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(readDemoApiHealth("http://localhost:8787")).resolves.toEqual(
      {
        ok: false,
        error: "JAPANPOST_SECRET_KEY is required",
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
