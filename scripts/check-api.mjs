import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  captureProcessOutput,
  createInstanceId,
  fetchJson,
  isReadyHealthPayload,
  loadExportEnvFile,
  spawnCommand,
  stopProcessTree,
  waitForReadyHealth,
} from "./local-dev-utils.mjs";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const API_DIR = resolve(ROOT_DIR, "apps", "minimal-api");
const DEFAULT_ENV_FILE = resolve(ROOT_DIR, ".secrets", "env");

function hasExpectedSearchcodePayload(payload) {
  const elements = Array.isArray(payload?.elements) ? payload.elements : [];

  return (
    payload?.totalElements >= 1 &&
    elements.some((address) => {
      return (
        address?.postalCode === "1020072" &&
        typeof address?.address === "string" &&
        address.address.length > 0
      );
    })
  );
}

function hasExpectedAddresszipPayload(payload) {
  const elements = Array.isArray(payload?.elements) ? payload.elements : [];

  return (
    payload?.totalElements >= 1 &&
    elements.length >= 1 &&
    elements.some((address) => {
      return (
        address?.postalCode === "1000004" &&
        typeof address?.address === "string" &&
        address.address.length > 0
      );
    })
  );
}

async function main() {
  const envFilePath = process.env.ENV_FILE?.trim() || DEFAULT_ENV_FILE;

  if (!existsSync(envFilePath)) {
    throw new Error(`Missing ${envFilePath}`);
  }

  const loadedEnv = loadExportEnvFile({
    env: process.env,
    envFilePath,
  });

  const runtimeEnv = {
    ...loadedEnv,
    MINIMAL_API_INSTANCE_ID:
      loadedEnv.MINIMAL_API_INSTANCE_ID?.trim() || createInstanceId("check-api"),
    PORT: loadedEnv.PORT?.trim() || "8788",
  };

  const baseUrl =
    loadedEnv.BASE_URL?.trim() || `http://127.0.0.1:${runtimeEnv.PORT}`;

  console.log("Starting apps/minimal-api check server...");

  const serverProcess = spawnCommand(
    "pnpm",
    ["exec", "tsx", "src/server.ts"],
    {
      cwd: API_DIR,
      env: runtimeEnv,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const readLogs = captureProcessOutput(serverProcess);

  try {
    console.log("Waiting for health check...");

    const ready = await waitForReadyHealth({
      baseUrl,
      expectedInstanceId: runtimeEnv.MINIMAL_API_INSTANCE_ID,
      isProcessAlive: () => serverProcess.exitCode === null,
    });

    if (!ready) {
      console.log("CHECK health: FAIL");
      const logs = readLogs().trim();

      if (logs) {
        console.log(logs);
      }

      console.log("RESULT: FAIL");
      process.exitCode = 1;
      return;
    }

    const healthResult = await fetchJson(`${baseUrl}/health`);

    if (
      healthResult.response.status === 200 &&
      isReadyHealthPayload(
        healthResult.payload,
        runtimeEnv.MINIMAL_API_INSTANCE_ID,
      )
    ) {
      console.log("CHECK health: PASS");
    } else {
      console.log("CHECK health: FAIL");
      console.log(healthResult.text);
      console.log("RESULT: FAIL");
      process.exitCode = 1;
      return;
    }

    const searchcodeResult = await fetchJson(
      `${baseUrl}/q/japanpost/searchcode`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          postalCode: "1020072",
          pageNumber: 0,
          rowsPerPage: 10,
        }),
      },
    );

    if (
      searchcodeResult.response.ok &&
      hasExpectedSearchcodePayload(searchcodeResult.payload)
    ) {
      console.log("CHECK searchcode: PASS");
    } else {
      console.log("CHECK searchcode: FAIL");
      console.log(searchcodeResult.text);
      console.log("RESULT: FAIL");
      process.exitCode = 1;
      return;
    }

    const addresszipResult = await fetchJson(
      `${baseUrl}/q/japanpost/addresszip`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          addressQuery: "大手町",
          pageNumber: 0,
          rowsPerPage: 20,
        }),
      },
    );

    if (
      addresszipResult.response.ok &&
      hasExpectedAddresszipPayload(addresszipResult.payload)
    ) {
      console.log("CHECK addresszip: PASS");
      console.log("RESULT: PASS");
      return;
    }

    console.log("CHECK addresszip: FAIL");
    console.log(addresszipResult.text);
    console.log("RESULT: FAIL");
    process.exitCode = 1;
  } finally {
    await stopProcessTree(serverProcess);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
