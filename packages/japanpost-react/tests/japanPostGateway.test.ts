import { describe, expect, it, vi } from "vitest";

import { createJapanPostAdapter } from "../../../apps/minimal-api/src/japanPostAdapter";

function requireTokenResolve(
  resolve: ((value: Response | PromiseLike<Response>) => void) | null,
): (value: Response | PromiseLike<Response>) => void {
  if (!resolve) {
    throw new Error("Expected token request to stay pending");
  }

  return resolve;
}

describe("createJapanPostAdapter", () => {
  it("shares one token request across concurrent lookups", async () => {
    let tokenResolve: ((value: Response | PromiseLike<Response>) => void) | null =
      null;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            tokenResolve = resolve;
          }),
      )
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          addresses: [
            {
              zip_code: "1000001",
              pref_name: "Tokyo",
              city_name: "Chiyoda-ku",
              town_name: "Chiyoda",
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
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

    const gateway = createJapanPostAdapter({
      env: {
        JAPAN_POST_CLIENT_ID: "demo-client",
        JAPAN_POST_SECRET_KEY: "demo-secret",
      },
      fetch: fetchMock,
    });

    const firstLookup = gateway.lookupPostalCode("1000001");
    const secondLookup = gateway.lookupPostalCode("1500001");

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    requireTokenResolve(tokenResolve)({
      ok: true,
      json: async () => ({
        token: "token-1",
        expires_in: 3600,
      }),
    } as Response);

    await expect(
      Promise.all([firstLookup, secondLookup]),
    ).resolves.toMatchObject([
      {
        postalCode: "1000001",
      },
      {
        postalCode: "1500001",
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      new URL("https://api.da.pf.japanpost.jp/api/v2/j/token"),
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("refreshes the token and retries once when the upstream request returns 401", async () => {
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
        ok: false,
        status: 401,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "token-2",
          expires_in: 3600,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
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

    const gateway = createJapanPostAdapter({
      env: {
        JAPAN_POST_CLIENT_ID: "demo-client",
        JAPAN_POST_SECRET_KEY: "demo-secret",
      },
      fetch: fetchMock,
    });

    await expect(gateway.lookupPostalCode("1000001")).resolves.toMatchObject({
      postalCode: "1000001",
      addresses: [
        expect.objectContaining({
          postalCode: "1000001",
          prefecture: "Tokyo",
        }),
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      new URL("https://api.da.pf.japanpost.jp/api/v2/j/token"),
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      new URL("https://api.da.pf.japanpost.jp/api/v2/searchcode/1000001"),
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      new URL("https://api.da.pf.japanpost.jp/api/v2/j/token"),
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      new URL("https://api.da.pf.japanpost.jp/api/v2/searchcode/1000001"),
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("requires credentials for postal code lookups", async () => {
    const gateway = createJapanPostAdapter({
      env: {},
      fetch: vi.fn<typeof fetch>(),
    });

    await expect(gateway.lookupPostalCode("1000001")).rejects.toMatchObject({
      statusCode: 500,
      message: "JAPAN_POST_CLIENT_ID is required",
    });
  });

  it("rejects postal codes that do not contain exactly seven digits", async () => {
    const gateway = createJapanPostAdapter({
      env: {
        JAPAN_POST_CLIENT_ID: "demo-client",
        JAPAN_POST_SECRET_KEY: "demo-secret",
      },
      fetch: vi.fn<typeof fetch>(),
    });

    await expect(gateway.lookupPostalCode("1234")).rejects.toMatchObject({
      statusCode: 400,
      message: "Postal code must contain exactly 7 digits",
    });

    await expect(gateway.lookupPostalCode("100000123")).rejects.toMatchObject({
      statusCode: 400,
      message: "Postal code must contain exactly 7 digits",
    });
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

    const gateway = createJapanPostAdapter({
      env: {
        JAPAN_POST_CLIENT_ID: "demo-client",
        JAPAN_POST_SECRET_KEY: "demo-secret",
      },
      fetch: fetchMock,
    });

    await expect(gateway.lookupPostalCode("1000001")).rejects.toMatchObject({
      statusCode: 502,
      message: "Address provider returned an invalid postal code",
    });
  });

  it("includes upstream token error details when token exchange is rejected", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        error_code: "403-1028-0001",
        message: "登録情報の不一致です",
        request_id: "req-123",
      }),
    } as Response);

    const gateway = createJapanPostAdapter({
      env: {
        JAPAN_POST_CLIENT_ID: "demo-client",
        JAPAN_POST_SECRET_KEY: "demo-secret",
      },
      fetch: fetchMock,
    });

    await expect(gateway.lookupPostalCode("1000001")).rejects.toMatchObject({
      statusCode: 502,
      message:
        "Address provider authentication failed with status 403: 登録情報の不一致です (error_code: 403-1028-0001, request_id: req-123)",
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

    const gateway = createJapanPostAdapter({
      env: {
        JAPAN_POST_CLIENT_ID: "demo-client",
        JAPAN_POST_SECRET_KEY: "demo-secret",
      },
      fetch: fetchMock,
    });

    await expect(gateway.searchAddress("Tokyo")).rejects.toMatchObject({
      statusCode: 502,
      message: "Address provider returned an unexpected response",
    });
  });

  it("maps flat upstream addresszip responses using the v2 endpoint", async () => {
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
              zip_code: "1040044",
              pref_name: "Tokyo",
              city_name: "Chuo-ku",
              town_name: "Akashicho",
            },
            {
              zip_code: "1500001",
              pref_name: "Tokyo",
              city_name: "Shibuya-ku",
              town_name: "Jingumae",
              other_name: "Omotesando",
            },
          ],
          limit: 20,
          count: 2,
          page: 1,
        }),
      } as Response);

    const gateway = createJapanPostAdapter({
      env: {
        JAPAN_POST_CLIENT_ID: "demo-client",
        JAPAN_POST_SECRET_KEY: "demo-secret",
      },
      fetch: fetchMock,
    });

    await expect(gateway.searchAddress("Tokyo")).resolves.toEqual({
      query: "Tokyo",
      addresses: [
        expect.objectContaining({
          postalCode: "1040044",
          prefecture: "Tokyo",
          city: "Chuo-ku",
          town: "Akashicho",
        }),
        expect.objectContaining({
          postalCode: "1500001",
          prefecture: "Tokyo",
          city: "Shibuya-ku",
          town: "Jingumae",
          address: "Tokyo Shibuya-ku Jingumae Omotesando",
        }),
      ],
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      new URL("https://api.da.pf.japanpost.jp/api/v2/addresszip"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          freeword: "Tokyo",
          flg_getcity: 0,
          flg_getpref: 0,
          page: 1,
          limit: 20,
        }),
      }),
    );
  });

  it("does not duplicate the address text when the upstream payload also includes a full address string", async () => {
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
              zip_code: "1020072",
              pref_name: "東京都",
              city_name: "千代田区",
              town_name: "飯田橋",
              address: "東京都 千代田区 飯田橋",
            },
          ],
        }),
      } as Response);

    const gateway = createJapanPostAdapter({
      env: {
        JAPAN_POST_CLIENT_ID: "demo-client",
        JAPAN_POST_SECRET_KEY: "demo-secret",
      },
      fetch: fetchMock,
    });

    await expect(gateway.lookupPostalCode("1020072")).resolves.toEqual({
      postalCode: "1020072",
      addresses: [
        expect.objectContaining({
          postalCode: "1020072",
          address: "東京都 千代田区 飯田橋",
        }),
      ],
    });
  });

  it("treats a host-only base url as https for upstream requests", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: "token-1",
        expires_in: 3600,
      }),
    } as Response);

    const gateway = createJapanPostAdapter({
      env: {
        JAPAN_POST_BASE_URL: "stub-qz73x.da.pf.japanpost.jp",
        JAPAN_POST_CLIENT_ID: "demo-client",
        JAPAN_POST_SECRET_KEY: "demo-secret",
      },
      fetch: fetchMock,
    });

    await expect(gateway.getHealth()).resolves.toEqual({
      ok: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://stub-qz73x.da.pf.japanpost.jp/api/v2/j/token"),
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("reports unhealthy when credentials are missing", async () => {
    const gateway = createJapanPostAdapter({
      env: {},
      fetch: vi.fn<typeof fetch>(),
    });

    await expect(gateway.getHealth()).resolves.toMatchObject({
      ok: false,
      error: "JAPAN_POST_CLIENT_ID is required",
    });
  });

  it("reports healthy when credentials are configured and token exchange works", async () => {
    const gateway = createJapanPostAdapter({
      env: {
        JAPAN_POST_CLIENT_ID: "demo-client",
        JAPAN_POST_SECRET_KEY: "demo-secret",
      },
      fetch: vi.fn<typeof fetch>().mockResolvedValue({
        ok: true,
        json: async () => ({
          token: "token-1",
          expires_in: 3600,
        }),
      } as Response),
    });

    await expect(gateway.getHealth()).resolves.toEqual({
      ok: true,
    });
  });

  it("reports unhealthy when token exchange fails even if credentials are configured", async () => {
    const gateway = createJapanPostAdapter({
      env: {
        JAPAN_POST_CLIENT_ID: "demo-client",
        JAPAN_POST_SECRET_KEY: "demo-secret",
      },
      fetch: vi.fn<typeof fetch>().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          error_code: "403-1028-0001",
          message: "登録情報の不一致です",
          request_id: "req-health",
        }),
      } as Response),
    });

    await expect(gateway.getHealth()).resolves.toEqual({
      ok: false,
      error:
        "Address provider authentication failed with status 403: 登録情報の不一致です (error_code: 403-1028-0001, request_id: req-health)",
    });
  });

  it("reports unhealthy without credentials", async () => {
    const gateway = createJapanPostAdapter({
      env: {},
      fetch: vi.fn<typeof fetch>(),
    });

    await expect(gateway.getHealth()).resolves.toEqual({
      ok: false,
      error: "JAPAN_POST_CLIENT_ID is required",
    });
  });
});
