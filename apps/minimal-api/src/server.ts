import { createServer } from "node:http";

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
  const port = Number(process.env.PORT ?? "8788");
  const adapter = createJapanPostAdapter();
  const server = createMinimalApiServerWithAdapter(adapter, process.env);

  server.listen(port, async () => {
    // 부팅 로그에 readiness 상태를 함께 남겨 자격 증명 문제를 빠르게 파악한다.
    const health = await adapter.getHealth();
    console.log(
      `Minimal API listening on http://localhost:${port}${health.ok ? "" : " (not ready)"}`,
    );
  });
}
