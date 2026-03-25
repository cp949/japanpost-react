import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createInstanceId,
  loadExportEnvFile,
  spawnCommand,
  stopProcessTree,
  waitForReadyHealth,
} from "./local-dev-utils.mjs";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_ENV_FILE = resolve(ROOT_DIR, ".secrets", "env");

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
    DEMO_PORT: loadedEnv.DEMO_PORT?.trim() || "5173",
    MINIMAL_API_INSTANCE_ID:
      loadedEnv.MINIMAL_API_INSTANCE_ID?.trim() || createInstanceId("dev-demo"),
    PORT: loadedEnv.PORT?.trim() || "8788",
    VITE_DEMO_API_BASE_URL:
      loadedEnv.VITE_DEMO_API_BASE_URL?.trim() || "/minimal-api",
  };

  const baseUrl = `http://127.0.0.1:${runtimeEnv.PORT}`;
  let apiProcess;
  let demoProcess;
  let cleanedUp = false;

  const cleanup = async () => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;
    await Promise.all([
      stopProcessTree(apiProcess),
      stopProcessTree(demoProcess),
    ]);
  };

  const exitWithCleanup = async (code) => {
    await cleanup();
    process.exit(code);
  };

  process.on("SIGINT", () => {
    void exitWithCleanup(130);
  });
  process.on("SIGTERM", () => {
    void exitWithCleanup(143);
  });
  process.on("exit", () => {
    if (!cleanedUp) {
      void cleanup();
    }
  });

  apiProcess = spawnCommand(
    "pnpm",
    ["--filter", "minimal-api", "dev"],
    {
      cwd: ROOT_DIR,
      env: runtimeEnv,
      stdio: "inherit",
    },
  );

  const apiReady = await waitForReadyHealth({
    baseUrl,
    expectedInstanceId: runtimeEnv.MINIMAL_API_INSTANCE_ID,
    isProcessAlive: () => apiProcess.exitCode === null,
  });

  if (!apiReady) {
    console.error(
      "Minimal API is not ready. Check credentials and /health response.",
    );
    await exitWithCleanup(1);
    return;
  }

  demoProcess = spawnCommand(
    "pnpm",
    [
      "--filter",
      "demo",
      "dev",
      "--",
      "--port",
      runtimeEnv.DEMO_PORT,
      "--strictPort",
    ],
    {
      cwd: ROOT_DIR,
      env: runtimeEnv,
      stdio: "inherit",
    },
  );

  const [firstExitCode] = await Promise.race([
    new Promise((resolve) => {
      apiProcess.once("exit", (code) => resolve(code ?? 0));
      apiProcess.once("error", () => resolve(1));
    }),
    new Promise((resolve) => {
      demoProcess.once("exit", (code) => resolve(code ?? 0));
      demoProcess.once("error", () => resolve(1));
    }),
  ]);

  await exitWithCleanup(typeof firstExitCode === "number" ? firstExitCode : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
