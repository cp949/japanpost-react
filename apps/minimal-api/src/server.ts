import { createServer } from "node:http";

import type { AddressAdapter } from "./japanPostAdapter.js";
import { createJapanPostAdapter } from "./japanPostAdapter.js";
import { handleMinimalApiRequest } from "./http/routes.js";

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
  return createServer(async (request, response) =>
    handleMinimalApiRequest(request, response, { adapter, env }),
  );
}

if (import.meta.main) {
  const port = Number(process.env.PORT ?? "8788");
  const adapter = createJapanPostAdapter();
  const server = createMinimalApiServerWithAdapter(adapter, process.env);

  server.listen(port, async () => {
    const health = await adapter.getHealth();
    console.log(
      `Minimal API listening on http://localhost:${port}${health.ok ? "" : " (not ready)"}`,
    );
  });
}
