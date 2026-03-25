import { spawn } from "node:child_process";
import { randomInt } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

function parseExportLine(line) {
  const trimmedLine = line.trim();

  if (!trimmedLine || trimmedLine.startsWith("#")) {
    return null;
  }

  const match = /^export\s+([A-Z0-9_]+)=(.*)$/u.exec(trimmedLine);

  if (!match) {
    return null;
  }

  const [, key, rawValue] = match;
  const value =
    (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
    (rawValue.startsWith("'") && rawValue.endsWith("'"))
      ? rawValue.slice(1, -1)
      : rawValue;

  return [key, value];
}

export function loadExportEnvFile({
  env = process.env,
  envFilePath,
} = {}) {
  const loadedEnv = {
    ...env,
  };

  if (!envFilePath || !existsSync(envFilePath)) {
    return loadedEnv;
  }

  const fileContents = readFileSync(envFilePath, "utf8");

  for (const line of fileContents.split(/\r?\n/u)) {
    const parsed = parseExportLine(line);

    if (!parsed) {
      continue;
    }

    const [key, value] = parsed;

    if (!loadedEnv[key]?.trim()) {
      loadedEnv[key] = value;
    }
  }

  return loadedEnv;
}

export function isReadyHealthPayload(payload, expectedInstanceId) {
  const matchesInstance =
    !expectedInstanceId || payload?.instanceId === expectedInstanceId;

  return payload?.ok === true && matchesInstance;
}

export function createInstanceId(prefix) {
  return `${prefix}-${process.pid}-${randomInt(1_000_000)}`;
}

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function fetchJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  const trimmedText = text.trim();

  if (!trimmedText) {
    return {
      response,
      payload: null,
      text,
    };
  }

  return {
    response,
    payload: JSON.parse(trimmedText),
    text,
  };
}

export async function waitForReadyHealth({
  attempts = 30,
  baseUrl,
  expectedInstanceId,
  intervalMs = 1_000,
  isProcessAlive = () => true,
}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (!isProcessAlive()) {
      return false;
    }

    try {
      const { payload, response } = await fetchJson(`${baseUrl}/health`);

      if (
        response.status === 200 &&
        isReadyHealthPayload(payload, expectedInstanceId)
      ) {
        return true;
      }
    } catch {
      // 서버가 아직 뜨지 않았거나 JSON이 준비되지 않은 상태는 polling 중 자연스러운 실패다.
    }

    if (attempt < attempts - 1) {
      await sleep(intervalMs);
    }
  }

  return false;
}

export function spawnCommand(command, args, options = {}) {
  return spawn(command, args, {
    ...options,
    detached: process.platform !== "win32",
    shell: process.platform === "win32",
  });
}

function waitForChildExit(child, timeoutMs) {
  if (child.exitCode !== null) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const onExit = () => {
      cleanup();
      resolve(true);
    };
    const timeout = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      child.off("exit", onExit);
      child.off("error", onExit);
    };

    child.once("exit", onExit);
    child.once("error", onExit);
  });
}

async function terminateProcessTree(pid, force) {
  if (!pid) {
    return;
  }

  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const taskkill = spawn(
        "taskkill",
        ["/pid", String(pid), "/t", ...(force ? ["/f"] : [])],
        {
          shell: true,
          stdio: "ignore",
        },
      );

      taskkill.once("exit", () => resolve());
      taskkill.once("error", () => resolve());
    });
    return;
  }

  try {
    process.kill(-pid, force ? "SIGKILL" : "SIGTERM");
  } catch {
    try {
      process.kill(pid, force ? "SIGKILL" : "SIGTERM");
    } catch {
      // 이미 종료된 경우는 무시한다.
    }
  }
}

export async function stopProcessTree(child, { graceMs = 3_000 } = {}) {
  if (!child?.pid || child.exitCode !== null) {
    return;
  }

  await terminateProcessTree(child.pid, false);

  if (await waitForChildExit(child, graceMs)) {
    return;
  }

  await terminateProcessTree(child.pid, true);
  await waitForChildExit(child, 1_000);
}

export function captureProcessOutput(child, maxLength = 20_000) {
  let output = "";

  const append = (chunk) => {
    output += chunk.toString();

    if (output.length > maxLength) {
      output = output.slice(-maxLength);
    }
  };

  child.stdout?.on("data", append);
  child.stderr?.on("data", append);

  return () => output;
}
