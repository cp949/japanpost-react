import { describe, expect, it, vi } from "vitest";

import { createJapanPostAdapter } from "../../apps/minimal-api/src/japanPostAdapter";

describe("createJapanPostAdapter facade", () => {
  it("reports health success through the facade", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: "token-1",
        expires_in: 3600,
      }),
    } as Response);

    const adapter = createJapanPostAdapter({
      env: {
        JAPANPOST_CLIENT_ID: "demo-client",
        JAPANPOST_SECRET_KEY: "demo-secret",
      },
      fetch: fetchMock,
    });

    await expect(adapter.getHealth()).resolves.toEqual({ ok: true });
  });

  it("reports health failure through the facade when credentials are missing", async () => {
    const adapter = createJapanPostAdapter({
      env: {},
      fetch: vi.fn<typeof fetch>(),
    });

    await expect(adapter.getHealth()).resolves.toEqual({
      ok: false,
      error: "JAPANPOST_CLIENT_ID is required",
    });
  });

  it("returns a page payload for searchcode requests", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "token-1",
          expires_in: 3600,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 1,
          addresses: [
            {
              zip_code: "1000001",
              pref_name: "Tokyo",
              city_name: "Chiyoda-ku",
              town_name: "Chiyoda",
            },
          ],
        }),
      } as Response);

    const adapter = createJapanPostAdapter({
      env: {
        JAPANPOST_CLIENT_ID: "demo-client",
        JAPANPOST_SECRET_KEY: "demo-secret",
      },
      fetch: fetchMock,
    });

    await expect(
      adapter.searchcode({
        postalCode: "1000001",
        pageNumber: 0,
        rowsPerPage: 10,
        includeParenthesesTown: true,
      }),
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

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.any(URL),
      expect.objectContaining({
        method: "GET",
      }),
    );

    const searchCodeUrl = String(fetchMock.mock.calls[1]?.[0]);
    expect(searchCodeUrl).toContain("/api/v2/searchcode/1000001");
    expect(searchCodeUrl).toContain("page=1");
    expect(searchCodeUrl).toContain("limit=10");
    expect(searchCodeUrl).toContain("choikitype=2");
    expect(searchCodeUrl).not.toContain("searchtype=");
  });

  it("returns a page payload for addresszip requests", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "token-1",
          expires_in: 3600,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 37,
          addresses: [
            {
              zip_code: "1500001",
              pref_name: "Tokyo",
              city_name: "Shibuya-ku",
              town_name: "Jingumae",
            },
          ],
        }),
      } as Response);

    const adapter = createJapanPostAdapter({
      env: {
        JAPANPOST_CLIENT_ID: "demo-client",
        JAPANPOST_SECRET_KEY: "demo-secret",
      },
      fetch: fetchMock,
    });

    await expect(
      adapter.addresszip({
        addressQuery: "  Jingumae  ",
        pageNumber: 0,
        rowsPerPage: 20,
        includeCityDetails: false,
        includePrefectureDetails: false,
      }),
    ).resolves.toEqual({
      elements: [
        expect.objectContaining({
          postalCode: "1500001",
          prefecture: "Tokyo",
          city: "Shibuya-ku",
          town: "Jingumae",
          address: "Tokyo Shibuya-ku Jingumae",
          provider: "japan-post",
        }),
      ],
      totalElements: 37,
      pageNumber: 0,
      rowsPerPage: 20,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.any(URL),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          freeword: "Jingumae",
          flg_getcity: 0,
          flg_getpref: 0,
          page: 1,
          limit: 20,
        }),
      }),
    );
  });

  it("rejects malformed upstream postal-code payloads", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "token-1",
          expires_in: 3600,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          addresses: [
            {
              zip_code: "1234",
              pref_name: "Tokyo",
              city_name: "Chiyoda-ku",
              town_name: "Chiyoda",
            },
          ],
        }),
      } as Response);

    const adapter = createJapanPostAdapter({
      env: {
        JAPANPOST_CLIENT_ID: "demo-client",
        JAPANPOST_SECRET_KEY: "demo-secret",
      },
      fetch: fetchMock,
    });

    await expect(
      adapter.searchcode({
        postalCode: "1000001",
        pageNumber: 0,
        rowsPerPage: 10,
      }),
    ).rejects.toMatchObject({
      statusCode: 502,
      message: "Address provider returned an invalid postal code",
    });
  });

  it("rejects non-numeric upstream postal-code counts", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "token-1",
          expires_in: 3600,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: "1",
          addresses: [
            {
              zip_code: "1000001",
              pref_name: "Tokyo",
              city_name: "Chiyoda-ku",
              town_name: "Chiyoda",
            },
          ],
        }),
      } as Response);

    const adapter = createJapanPostAdapter({
      env: {
        JAPANPOST_CLIENT_ID: "demo-client",
        JAPANPOST_SECRET_KEY: "demo-secret",
      },
      fetch: fetchMock,
    });

    await expect(
      adapter.searchcode({
        postalCode: "1000001",
        pageNumber: 0,
        rowsPerPage: 10,
      }),
    ).rejects.toMatchObject({
      statusCode: 502,
      message: "Address provider returned an unexpected response",
    });
  });

  it("rejects malformed upstream address-search payloads", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "token-1",
          expires_in: 3600,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          addresses: null,
        }),
      } as Response);

    const adapter = createJapanPostAdapter({
      env: {
        JAPANPOST_CLIENT_ID: "demo-client",
        JAPANPOST_SECRET_KEY: "demo-secret",
      },
      fetch: fetchMock,
    });

    await expect(
      adapter.addresszip({
        addressQuery: "Tokyo",
        pageNumber: 0,
        rowsPerPage: 20,
      }),
    ).rejects.toMatchObject({
      statusCode: 502,
      message: "Address provider returned an unexpected response",
    });
  });
});
