import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMinimalApiServer,
  createMinimalApiServerWithAdapter,
  loadMinimalApiEnvForStartup,
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
  it("loads startup env values from a .secrets/env file when process env is missing them", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "minimal-api-env-"));

    try {
      const secretsDir = join(tempDir, ".secrets");
      await mkdir(secretsDir, { recursive: true });
      await writeFile(
        join(secretsDir, "env"),
        [
          "export JAPANPOST_BASE_URL=api.example.test",
          "export JAPANPOST_CLIENT_ID=file-client",
          "export JAPANPOST_SECRET_KEY=file-secret",
          "",
        ].join("\n"),
        "utf8",
      );

      const loadedEnv = loadMinimalApiEnvForStartup({
        env: {},
        envFilePath: join(secretsDir, "env"),
      });

      expect(loadedEnv).toMatchObject({
        JAPANPOST_BASE_URL: "api.example.test",
        JAPANPOST_CLIENT_ID: "file-client",
        JAPANPOST_SECRET_KEY: "file-secret",
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps explicit process env values instead of overriding them from .secrets/env", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "minimal-api-env-"));

    try {
      const secretsDir = join(tempDir, ".secrets");
      await mkdir(secretsDir, { recursive: true });
      await writeFile(
        join(secretsDir, "env"),
        [
          "export JAPANPOST_CLIENT_ID=file-client",
          "export JAPANPOST_SECRET_KEY=file-secret",
          "",
        ].join("\n"),
        "utf8",
      );

      const loadedEnv = loadMinimalApiEnvForStartup({
        env: {
          JAPANPOST_CLIENT_ID: "process-client",
          JAPANPOST_SECRET_KEY: "process-secret",
        },
        envFilePath: join(secretsDir, "env"),
      });

      expect(loadedEnv.JAPANPOST_CLIENT_ID).toBe("process-client");
      expect(loadedEnv.JAPANPOST_SECRET_KEY).toBe("process-secret");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

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
      error: "JAPANPOST_CLIENT_ID is required",
    });
  });

  it("returns 503 health when only the secret key is missing", async () => {
    const server = await startServer({
      JAPANPOST_CLIENT_ID: "demo-client-id",
    });
    activeServers.push(server);

    const response = await fetch(`${server.url}/health`);
    const payload = (await response.json()) as { ok: boolean; error: string };

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      ok: false,
      error: "JAPANPOST_SECRET_KEY is required",
    });
  });

  it("returns ok: true health when credentials are configured and token succeeds", async () => {
    const server = await startServer(
      {
        JAPANPOST_CLIENT_ID: "demo-client-id",
        MINIMAL_API_INSTANCE_ID: "instance-123",
        JAPANPOST_SECRET_KEY: "demo-secret-key",
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
      JAPANPOST_CLIENT_ID: "demo-client-id",
      JAPANPOST_SECRET_KEY: "demo-secret-key",
      JAPANPOST_BASE_URL: "http://127.0.0.1:9",
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
        postalCode: "1000001",
        pageNumber: 0,
        rowsPerPage: 10,
      }),
    });
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      error: "JAPANPOST_CLIENT_ID is required",
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
        addressQuery: "Tokyo",
        pageNumber: 0,
        rowsPerPage: 20,
      }),
    });
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      error: "JAPANPOST_CLIENT_ID is required",
    });
  });

  it("rejects malformed postal-code inputs before sending the request upstream", async () => {
    const server = await startServer({
      JAPANPOST_CLIENT_ID: "demo-client-id",
      JAPANPOST_SECRET_KEY: "demo-secret-key",
    });
    activeServers.push(server);

    const shortResponse = await fetch(`${server.url}/q/japanpost/searchcode`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        postalCode: "12",
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
        postalCode: "100000123",
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

  it("returns an empty page for blank address queries after trimming whitespace", async () => {
    const server = await startServer({});
    activeServers.push(server);

    const response = await fetch(`${server.url}/q/japanpost/addresszip`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        addressQuery: "   ",
        pageNumber: 0,
        rowsPerPage: 20,
      }),
    });
    const payload = (await response.json()) as {
      elements: unknown[];
      totalElements: number;
      pageNumber: number;
      rowsPerPage: number;
    };

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      elements: [],
      totalElements: 0,
      pageNumber: 0,
      rowsPerPage: 20,
    });
  });

  it("returns a page payload for a valid postal code", async () => {
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
        JAPANPOST_CLIENT_ID: "demo-client-id",
        JAPANPOST_SECRET_KEY: "demo-secret-key",
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
        postalCode: "1020072",
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
        JAPANPOST_CLIENT_ID: "demo-client-id",
        JAPANPOST_SECRET_KEY: "demo-secret-key",
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
        postalCode: "1020072",
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

  it("returns a page payload for a valid keyword search", async () => {
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
        JAPANPOST_CLIENT_ID: "demo-client-id",
        JAPANPOST_SECRET_KEY: "demo-secret-key",
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
        addressQuery: "千代田",
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

  it("rejects non-numeric upstream address-search counts with 502", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "token-1", expires_in: 3600 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: "1",
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
        JAPANPOST_CLIENT_ID: "demo-client-id",
        JAPANPOST_SECRET_KEY: "demo-secret-key",
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
        addressQuery: "千代田",
        pageNumber: 0,
        rowsPerPage: 20,
      }),
    });
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(502);
    expect(payload).toEqual({
      error: "Address provider returned an unexpected response",
    });
  });
});
