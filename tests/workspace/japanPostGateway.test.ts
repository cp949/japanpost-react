import { describe, expect, it, vi } from "vitest";

import {
  createJapanPostClient,
  type JapanPostClientOptions,
} from "../../apps/minimal-api/src/japanPost/client";

function requireTokenResolve(
  resolve: ((value: Response | PromiseLike<Response>) => void) | null,
): (value: Response | PromiseLike<Response>) => void {
  if (!resolve) {
    throw new Error("Expected token request to stay pending");
  }

  return resolve;
}

function createClientOptions(
  fetchMock: typeof fetch,
  env: NodeJS.ProcessEnv = {
    JAPANPOST_CLIENT_ID: "demo-client",
    JAPANPOST_SECRET_KEY: "demo-secret",
  },
): JapanPostClientOptions {
  return {
    env,
    fetch: fetchMock,
  };
}

describe("createJapanPostClient low-level provider behavior", () => {
  it("shares one token request across concurrent searchcode lookups", async () => {
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

    const client = createJapanPostClient(createClientOptions(fetchMock));

    const firstLookup = client.searchCodeRaw("1000001");
    const secondLookup = client.searchCodeRaw("1500001");

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

    await expect(Promise.all([firstLookup, secondLookup])).resolves.toEqual([
      expect.objectContaining({
        addresses: [
          expect.objectContaining({
            zip_code: "1000001",
          }),
        ],
      }),
      expect.objectContaining({
        addresses: [
          expect.objectContaining({
            zip_code: "1500001",
          }),
        ],
      }),
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

    const client = createJapanPostClient(createClientOptions(fetchMock));

    await expect(client.searchCodeRaw("1000001")).resolves.toMatchObject({
      addresses: [
        expect.objectContaining({
          zip_code: "1000001",
          pref_name: "Tokyo",
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
    const client = createJapanPostClient(
      createClientOptions(vi.fn<typeof fetch>(), {}),
    );

    await expect(client.searchCodeRaw("1000001")).rejects.toMatchObject({
      statusCode: 500,
      message: "JAPANPOST_CLIENT_ID is required",
    });
  });

  it("supports postal-code prefix search when the input has at least three digits", async () => {
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
              zip_code: "1230000",
              pref_name: "Tokyo",
              city_name: "Example-ku",
              town_name: "Prefix",
            },
          ],
        }),
      } as Response);

    const client = createJapanPostClient(createClientOptions(fetchMock));

    await expect(client.searchCodeRaw("1234")).resolves.toMatchObject({
      addresses: [
        expect.objectContaining({
          zip_code: "1230000",
        }),
      ],
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      new URL("https://api.da.pf.japanpost.jp/api/v2/searchcode/1234"),
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("forwards ec_uid to searchcode when configured", async () => {
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
              zip_code: "1000001",
              pref_name: "Tokyo",
              city_name: "Chiyoda-ku",
              town_name: "Chiyoda",
            },
          ],
        }),
      } as Response);

    const client = createJapanPostClient(
      createClientOptions(fetchMock, {
        JAPANPOST_CLIENT_ID: "demo-client",
        JAPANPOST_SECRET_KEY: "demo-secret",
        JAPANPOST_EC_UID: "provider-user-1",
      }),
    );

    await expect(client.searchCodeRaw("1000001")).resolves.toMatchObject({
      addresses: [
        expect.objectContaining({
          zip_code: "1000001",
        }),
      ],
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      new URL(
        "https://api.da.pf.japanpost.jp/api/v2/searchcode/1000001?ec_uid=provider-user-1",
      ),
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("forwards configured searchcode query parameters with narrowed union values", async () => {
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
              zip_code: "1000001",
              pref_name: "Tokyo",
              city_name: "Chiyoda-ku",
              town_name: "Chiyoda",
            },
          ],
        }),
      } as Response);

    const client = createJapanPostClient(
      createClientOptions(fetchMock, {
        JAPANPOST_CLIENT_ID: "demo-client",
        JAPANPOST_SECRET_KEY: "demo-secret",
        JAPANPOST_EC_UID: "provider-user-1",
        JAPANPOST_SEARCH_CODE_CHOIKITYPE: "2",
        JAPANPOST_SEARCH_CODE_SEARCHTYPE: "2",
      }),
    );

    await expect(client.searchCodeRaw("1000001")).resolves.toMatchObject({
      addresses: [
        expect.objectContaining({
          zip_code: "1000001",
        }),
      ],
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      new URL(
        "https://api.da.pf.japanpost.jp/api/v2/searchcode/1000001?ec_uid=provider-user-1&choikitype=2&searchtype=2",
      ),
      expect.objectContaining({
        method: "GET",
      }),
    );
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

    const client = createJapanPostClient(createClientOptions(fetchMock));

    await expect(client.authenticate()).rejects.toMatchObject({
      statusCode: 502,
      message:
        "Address provider authentication failed with status 403: 登録情報の不一致です (error_code: 403-1028-0001, request_id: req-123)",
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

    const client = createJapanPostClient(createClientOptions(fetchMock));

    await expect(
      client.addressZipRaw({
        freeword: "Tokyo",
        flg_getcity: 0,
        flg_getpref: 0,
        page: 1,
        limit: 20,
      }),
    ).resolves.toMatchObject({
      addresses: expect.arrayContaining([
        expect.objectContaining({
          zip_code: "1040044",
          pref_name: "Tokyo",
          city_name: "Chuo-ku",
          town_name: "Akashicho",
        }),
      ]),
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

  it("forwards ec_uid to addresszip when configured", async () => {
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
              zip_code: "1000001",
              pref_name: "Tokyo",
              city_name: "Chiyoda-ku",
              town_name: "Chiyoda",
            },
          ],
        }),
      } as Response);

    const client = createJapanPostClient({
      env: {
        JAPANPOST_CLIENT_ID: "demo-client",
        JAPANPOST_SECRET_KEY: "demo-secret",
        JAPANPOST_EC_UID: "provider-user-1",
      },
      fetch: fetchMock,
    });

    await expect(
      client.addressZipRaw({
        freeword: "Tokyo",
        flg_getcity: 0,
        flg_getpref: 0,
        page: 1,
        limit: 20,
      }),
    ).resolves.toMatchObject({
      addresses: [
        expect.objectContaining({
          zip_code: "1000001",
        }),
      ],
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      new URL(
        "https://api.da.pf.japanpost.jp/api/v2/addresszip?ec_uid=provider-user-1",
      ),
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

  it("treats a host-only base url as https for upstream requests", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: "token-1",
        expires_in: 3600,
      }),
    } as Response);

    const client = createJapanPostClient(
      createClientOptions(fetchMock, {
        JAPANPOST_BASE_URL: "stub-qz73x.da.pf.japanpost.jp",
        JAPANPOST_CLIENT_ID: "demo-client",
        JAPANPOST_SECRET_KEY: "demo-secret",
      }),
    );

    await expect(client.authenticate()).resolves.toBe("token-1");

    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://stub-qz73x.da.pf.japanpost.jp/api/v2/j/token"),
      expect.objectContaining({
        method: "POST",
      }),
    );
  });
});
