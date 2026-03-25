import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  isReadyHealthPayload,
  loadExportEnvFile,
} from "../../scripts/local-dev-utils.mjs";

describe("local dev script helpers", () => {
  it("loads export-style env file values when the current env is missing them", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "local-dev-utils-"));
    const envFilePath = join(tempDir, "env");

    try {
      await writeFile(
        envFilePath,
        [
          "# comment",
          "export JAPANPOST_CLIENT_ID=file-client",
          'export JAPANPOST_SECRET_KEY="file-secret"',
          "",
        ].join("\n"),
        "utf8",
      );

      const loaded = loadExportEnvFile({
        env: {},
        envFilePath,
      });

      expect(loaded).toMatchObject({
        JAPANPOST_CLIENT_ID: "file-client",
        JAPANPOST_SECRET_KEY: "file-secret",
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps explicit shell env values instead of overriding them from .secrets/env", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "local-dev-utils-"));
    const envFilePath = join(tempDir, "env");

    try {
      await writeFile(
        envFilePath,
        [
          "export JAPANPOST_CLIENT_ID=file-client",
          "export JAPANPOST_SECRET_KEY=file-secret",
          "",
        ].join("\n"),
        "utf8",
      );

      const loaded = loadExportEnvFile({
        env: {
          JAPANPOST_CLIENT_ID: "shell-client",
          JAPANPOST_SECRET_KEY: "shell-secret",
        },
        envFilePath,
      });

      expect(loaded).toMatchObject({
        JAPANPOST_CLIENT_ID: "shell-client",
        JAPANPOST_SECRET_KEY: "shell-secret",
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("treats health payloads as ready only when ok is true and instance id matches", () => {
    expect(
      isReadyHealthPayload(
        {
          ok: true,
          instanceId: "demo-1",
        },
        "demo-1",
      ),
    ).toBe(true);
    expect(
      isReadyHealthPayload(
        {
          ok: true,
          instanceId: "demo-2",
        },
        "demo-1",
      ),
    ).toBe(false);
    expect(
      isReadyHealthPayload(
        {
          ok: false,
          instanceId: "demo-1",
        },
        "demo-1",
      ),
    ).toBe(false);
  });
});
