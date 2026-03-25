import { afterEach, describe, expect, it, vi } from "vitest";

describe("minimal api startup env loading", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.doUnmock("../../scripts/local-dev-utils.mjs");
  });

  it("reuses the shared export-style env loader", async () => {
    const loadExportEnvFile = vi.fn(() => ({
      JAPANPOST_CLIENT_ID: "shared-client",
      JAPANPOST_SECRET_KEY: "shared-secret",
    }));

    vi.doMock("../../scripts/local-dev-utils.mjs", () => ({
      loadExportEnvFile,
    }));

    const { loadMinimalApiEnvForStartup } = await import(
      "../../apps/minimal-api/src/server"
    );

    const env = {
      EXISTING_VALUE: "kept",
    };
    const envFilePath = "/tmp/minimal-api-shared-env";
    const loadedEnv = loadMinimalApiEnvForStartup({
      env,
      envFilePath,
    });

    expect(loadExportEnvFile).toHaveBeenCalledWith({
      env,
      envFilePath,
    });
    expect(loadedEnv).toEqual({
      JAPANPOST_CLIENT_ID: "shared-client",
      JAPANPOST_SECRET_KEY: "shared-secret",
    });
  });
});
