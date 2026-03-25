import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { AddressAdapter } from "./japanPostAdapter.js";
import { createJapanPostAdapter } from "./japanPostAdapter.js";
import { handleMinimalApiRequest } from "./http/routes.js";

/**
 * minimal-api 서버 엔트리다.
 * 기본 어댑터 생성과 테스트 주입용 서버 생성을 분리해 재사용성을 높인다.
 */
type MinimalApiServerOptions = {
  env?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
};

type MinimalApiStartupEnvOptions = {
  env?: NodeJS.ProcessEnv;
  envFilePath?: string;
};

function parseExportLine(line: string): [string, string] | null {
  const trimmedLine = line.trim();

  if (!trimmedLine || trimmedLine.startsWith("#")) {
    return null;
  }

  const match = /^export\s+([A-Z0-9_]+)=(.*)$/.exec(trimmedLine);

  if (!match) {
    return null;
  }

  const key = match[1];
  const rawValue = match[2];

  if (key === undefined || rawValue === undefined) {
    return null;
  }

  const unquotedValue =
    (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
    (rawValue.startsWith("'") && rawValue.endsWith("'"))
      ? rawValue.slice(1, -1)
      : rawValue;

  return [key, unquotedValue];
}

export function loadMinimalApiEnvForStartup({
  env = process.env,
  envFilePath = resolve(import.meta.dirname, "../../..", ".secrets", "env"),
}: MinimalApiStartupEnvOptions = {}): NodeJS.ProcessEnv {
  const mergedEnv = {
    ...env,
  };

  if (!existsSync(envFilePath)) {
    return mergedEnv;
  }

  const fileContents = readFileSync(envFilePath, "utf8");

  for (const line of fileContents.split(/\r?\n/u)) {
    const parsedEntry = parseExportLine(line);

    if (!parsedEntry) {
      continue;
    }

    const [key, value] = parsedEntry;

    if (!mergedEnv[key]?.trim()) {
      mergedEnv[key] = value;
    }
  }

  return mergedEnv;
}

export function createMinimalApiServer(options: MinimalApiServerOptions = {}) {
  const adapter = createJapanPostAdapter({
    env: options.env,
    fetch: options.fetch,
  });

  return createMinimalApiServerWithAdapter(adapter, options.env);
}

export function createMinimalApiServerWithAdapter(
  adapter: AddressAdapter,
  env: NodeJS.ProcessEnv = process.env,
) {
  // 어댑터만 주입하면 테스트와 실제 서버가 동일한 라우팅 코드를 공유한다.
  return createServer(async (request, response) =>
    handleMinimalApiRequest(request, response, { adapter, env }),
  );
}

if (import.meta.main) {
  const startupEnv = loadMinimalApiEnvForStartup();
  const port = Number(startupEnv.PORT ?? "8788");
  const adapter = createJapanPostAdapter({
    env: startupEnv,
  });
  const server = createMinimalApiServerWithAdapter(adapter, startupEnv);

  server.listen(port, async () => {
    // 부팅 로그에 readiness 상태를 함께 남겨 자격 증명 문제를 빠르게 파악한다.
    const health = await adapter.getHealth();
    console.log(
      `Minimal API listening on http://localhost:${port}${health.ok ? "" : " (not ready)"}`,
    );
  });
}
