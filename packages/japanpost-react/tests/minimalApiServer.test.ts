import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMinimalApiServer,
  createMinimalApiServerWithAdapter,
} from "../../../apps/minimal-api/src/server";
import type { AddressAdapter } from "../../../apps/minimal-api/src/japanPostAdapter";

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

async function startServerWithAdapter(
  adapter: AddressAdapter,
  env: NodeJS.ProcessEnv = {},
): Promise<RunningServer> {
  const server = createMinimalApiServerWithAdapter(adapter, env);

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
  it("returns 204 for OPTIONS requests with POST enabled in CORS", async () => {
    const server = await startServer({});
    activeServers.push(server);

    const response = await fetch(`${server.url}/q/japanpost/searchcode`, {
      method: "OPTIONS",
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-methods")).toBe(
      "GET, POST, OPTIONS",
    );
    expect(response.headers.get("access-control-allow-headers")).toBe(
      "content-type",
    );
  });

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

  it("serves /health with a custom facade adapter without constructing the provider client", async () => {
    const adapter = {
      getHealth: vi.fn(async () => ({ ok: true as const })),
      searchcode: vi.fn(async () => {
        throw new Error("searchcode should not be called for /health");
      }),
      addresszip: vi.fn(async () => {
        throw new Error("addresszip should not be called for /health");
      }),
    };

    const server = await startServerWithAdapter(adapter, {
      MINIMAL_API_INSTANCE_ID: "custom-instance",
    });
    activeServers.push(server);

    const response = await fetch(`${server.url}/health`);
    const payload = (await response.json()) as {
      ok: boolean;
      instanceId?: string;
    };

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, instanceId: "custom-instance" });
    expect(adapter.getHealth).toHaveBeenCalledTimes(1);
    expect(adapter.searchcode).not.toHaveBeenCalled();
    expect(adapter.addresszip).not.toHaveBeenCalled();
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

  it("rejects missing credentials on POST /q/japanpost/searchcode with 500", async () => {
    const server = await startServer({});
    activeServers.push(server);

    const response = await fetch(`${server.url}/q/japanpost/searchcode`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        value: "1000001",
        pageNumber: 0,
        rowsPerPage: 10,
      }),
    });
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      error: "JAPAN_POST_CLIENT_ID is required",
    });
  });

  it("rejects missing credentials on POST /q/japanpost/addresszip with 500", async () => {
    const server = await startServer({});
    activeServers.push(server);

    const response = await fetch(`${server.url}/q/japanpost/addresszip`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        freeword: "Tokyo",
        pageNumber: 0,
        rowsPerPage: 20,
      }),
    });
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      error: "JAPAN_POST_CLIENT_ID is required",
    });
  });

  it("rejects malformed postal-code inputs before sending the request upstream", async () => {
    const server = await startServer({
      JAPAN_POST_CLIENT_ID: "demo-client-id",
      JAPAN_POST_SECRET_KEY: "demo-secret-key",
    });
    activeServers.push(server);

    const shortResponse = await fetch(`${server.url}/q/japanpost/searchcode`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        value: "12",
        pageNumber: 0,
        rowsPerPage: 10,
      }),
    });
    const shortPayload = (await shortResponse.json()) as { error: string };

    expect(shortResponse.status).toBe(400);
    expect(shortPayload).toEqual({
      error: "Postal code must contain between 3 and 7 digits",
    });

    const longResponse = await fetch(`${server.url}/q/japanpost/searchcode`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        value: "100000123",
        pageNumber: 0,
        rowsPerPage: 10,
      }),
    });
    const longPayload = (await longResponse.json()) as { error: string };

    expect(longResponse.status).toBe(400);
    expect(longPayload).toEqual({
      error: "Postal code must contain between 3 and 7 digits",
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

  it("rejects unsupported methods with 405", async () => {
    const server = await startServer({});
    activeServers.push(server);

    const response = await fetch(`${server.url}/health`, {
      method: "POST",
    });
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(405);
    expect(payload).toEqual({ error: "Method not allowed" });
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("rejects blank address queries after trimming whitespace", async () => {
    const server = await startServer({});
    activeServers.push(server);

    const response = await fetch(`${server.url}/q/japanpost/addresszip`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        freeword: "   ",
        pageNumber: 0,
        rowsPerPage: 20,
      }),
    });
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      error: "At least one search field must be provided",
    });
  });

  it("returns a momo pager payload for a valid postal code", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "token-1", expires_in: 3600 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 1,
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

    const response = await fetch(`${server.url}/q/japanpost/searchcode`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        value: "1020072",
        pageNumber: 0,
        rowsPerPage: 10,
      }),
    });
    const payload = (await response.json()) as {
      elements: unknown[];
      totalElements: number;
      rowsPerPage: number;
    };

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      elements: [
        expect.objectContaining({
          postalCode: "1020072",
          prefecture: "東京都",
          city: "千代田区",
        }),
      ],
      totalElements: 1,
      rowsPerPage: 10,
    });
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
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
          count: 1,
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

    const response = await fetch(`${server.url}/q/japanpost/searchcode`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        value: "1020072",
        pageNumber: 0,
        rowsPerPage: 10,
      }),
    });
    const payload = (await response.json()) as {
      elements: Array<{ address: string }>;
    };

    expect(response.status).toBe(200);
    expect(payload.elements[0]).toMatchObject({
      address: "東京都 千代田区 飯田橋",
    });
    expect(payload.elements[0]).not.toHaveProperty("formattedAddress");
  });

  it("returns a momo pager payload for a valid keyword search", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "token-1", expires_in: 3600 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 1,
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

    const response = await fetch(`${server.url}/q/japanpost/addresszip`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        freeword: "千代田",
        pageNumber: 0,
        rowsPerPage: 20,
        includeCityDetails: false,
        includePrefectureDetails: false,
      }),
    });
    const payload = (await response.json()) as {
      elements: unknown[];
      totalElements: number;
      rowsPerPage: number;
    };

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      elements: [
        expect.objectContaining({
          postalCode: "1000004",
          prefecture: "東京都",
          city: "千代田区",
        }),
      ],
      totalElements: 1,
      rowsPerPage: 20,
    });
  });
});
