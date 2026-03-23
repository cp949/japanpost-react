import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createMinimalApiServer } from "../../../apps/minimal-api/src/server";

type RunningServer = {
  close: () => Promise<void>;
  url: string;
};

async function startServer(
  env: NodeJS.ProcessEnv,
  fetchImpl?: typeof fetch,
): Promise<RunningServer> {
  const serverEnv = {
    ...process.env,
    ...env,
  };
  const server = createMinimalApiServer({ env: serverEnv, fetch: fetchImpl });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: async () =>
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
  };
}

const activeServers: RunningServer[] = [];

afterEach(async () => {
  await Promise.all(activeServers.splice(0).map((server) => server.close()));
});

describe("minimal api server", () => {
  it("returns health error when credentials are missing", async () => {
    const server = await startServer({});
    activeServers.push(server);

    const response = await fetch(`${server.url}/health`);
    const payload = (await response.json()) as { ok: boolean; error: string };

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      ok: false,
      error: "JAPAN_POST_CLIENT_ID is required",
    });
  });

  it("returns 503 health when only the secret key is missing", async () => {
    const server = await startServer({
      JAPAN_POST_CLIENT_ID: "demo-client-id",
    });
    activeServers.push(server);

    const response = await fetch(`${server.url}/health`);
    const payload = (await response.json()) as { ok: boolean; error: string };

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      ok: false,
      error: "JAPAN_POST_SECRET_KEY is required",
    });
  });

  it("returns ok: true health when credentials are configured and token succeeds", async () => {
    const server = await startServer(
      {
        JAPAN_POST_CLIENT_ID: "demo-client-id",
        MINIMAL_API_INSTANCE_ID: "instance-123",
        JAPAN_POST_SECRET_KEY: "demo-secret-key",
      },
      async () =>
        ({
          ok: true,
          json: async () => ({
            token: "token-1",
            expires_in: 3600,
          }),
        }) as Response,
    );
    activeServers.push(server);

    const response = await fetch(`${server.url}/health`);
    const payload = (await response.json()) as {
      ok: boolean;
      instanceId?: string;
    };

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, instanceId: "instance-123" });
  });

  it("returns 503 health when token exchange fails even though credentials are configured", async () => {
    const server = await startServer({
      JAPAN_POST_CLIENT_ID: "demo-client-id",
      JAPAN_POST_SECRET_KEY: "demo-secret-key",
      JAPAN_POST_BASE_URL: "http://127.0.0.1:9",
    });
    activeServers.push(server);

    const response = await fetch(`${server.url}/health`);
    const payload = (await response.json()) as { ok: boolean; error: string };

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("Address provider authentication failed");
  });

  it("rejects missing credentials on /searchcode/:code with 500", async () => {
    const server = await startServer({});
    activeServers.push(server);

    const response = await fetch(`${server.url}/searchcode/1000001`);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      error: "JAPAN_POST_CLIENT_ID is required",
    });
  });

  it("rejects missing credentials on /addresszip with 500", async () => {
    const server = await startServer({});
    activeServers.push(server);

    const response = await fetch(`${server.url}/addresszip?q=Tokyo`);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      error: "JAPAN_POST_CLIENT_ID is required",
    });
  });

  it("rejects malformed postal codes before sending the request upstream", async () => {
    const server = await startServer({
      JAPAN_POST_CLIENT_ID: "demo-client-id",
      JAPAN_POST_SECRET_KEY: "demo-secret-key",
    });
    activeServers.push(server);

    const shortResponse = await fetch(`${server.url}/searchcode/1234`);
    const shortPayload = (await shortResponse.json()) as { error: string };

    expect(shortResponse.status).toBe(400);
    expect(shortPayload).toEqual({
      error: "Postal code must contain exactly 7 digits",
    });

    const longResponse = await fetch(`${server.url}/searchcode/100000123`);
    const longPayload = (await longResponse.json()) as { error: string };

    expect(longResponse.status).toBe(400);
    expect(longPayload).toEqual({
      error: "Postal code must contain exactly 7 digits",
    });
  });

  it("returns 404 for unknown routes", async () => {
    const server = await startServer({});
    activeServers.push(server);

    const response = await fetch(`${server.url}/unknown`);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: "Route not found" });
  });

  it("returns matched addresses for a valid postal code", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "token-1", expires_in: 3600 }),
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
            },
          ],
        }),
      } as Response);

    const server = await startServer(
      {
        JAPAN_POST_CLIENT_ID: "demo-client-id",
        JAPAN_POST_SECRET_KEY: "demo-secret-key",
      },
      fetchMock,
    );
    activeServers.push(server);

    const response = await fetch(`${server.url}/searchcode/1020072`);
    const payload = (await response.json()) as {
      postalCode: string;
      addresses: unknown[];
    };

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      postalCode: "1020072",
      addresses: [
        expect.objectContaining({
          postalCode: "1020072",
          prefecture: "東京都",
          city: "千代田区",
        }),
      ],
    });
  });

  it("does not duplicate address text when upstream returns a full address string together with structured parts", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "token-1", expires_in: 3600 }),
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

    const server = await startServer(
      {
        JAPAN_POST_CLIENT_ID: "demo-client-id",
        JAPAN_POST_SECRET_KEY: "demo-secret-key",
      },
      fetchMock,
    );
    activeServers.push(server);

    const response = await fetch(`${server.url}/searchcode/1020072`);
    const payload = (await response.json()) as {
      postalCode: string;
      addresses: Array<{ address: string }>;
    };

    expect(response.status).toBe(200);
    expect(payload.postalCode).toBe("1020072");
    expect(payload.addresses[0]).toMatchObject({
      address: "東京都 千代田区 飯田橋",
    });
    expect(payload.addresses[0]).not.toHaveProperty("formattedAddress");
  });

  it("returns matched addresses for a valid keyword search", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "token-1", expires_in: 3600 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          addresses: [
            {
              zip_code: "1000004",
              pref_name: "東京都",
              city_name: "千代田区",
              town_name: "大手町",
            },
          ],
        }),
      } as Response);

    const server = await startServer(
      {
        JAPAN_POST_CLIENT_ID: "demo-client-id",
        JAPAN_POST_SECRET_KEY: "demo-secret-key",
      },
      fetchMock,
    );
    activeServers.push(server);

    const response = await fetch(
      `${server.url}/addresszip?q=${encodeURIComponent("千代田")}`,
    );
    const payload = (await response.json()) as {
      query: string;
      addresses: unknown[];
    };

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      query: "千代田",
      addresses: [
        expect.objectContaining({
          postalCode: "1000004",
          prefecture: "東京都",
          city: "千代田区",
        }),
      ],
    });
  });
});
