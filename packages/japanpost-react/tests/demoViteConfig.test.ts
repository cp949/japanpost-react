import { describe, expect, it } from "vitest";

import { resolveDemoApiProxyTarget } from "../../../apps/demo/vite.config";

describe("demo vite proxy target", () => {
  it("defaults to the local minimal api port", () => {
    expect(resolveDemoApiProxyTarget({})).toBe("http://127.0.0.1:8788");
  });

  it("uses the configured PORT when no explicit proxy target is provided", () => {
    expect(resolveDemoApiProxyTarget({ PORT: "9999" })).toBe(
      "http://127.0.0.1:9999",
    );
  });

  it("prefers an explicit proxy target override", () => {
    expect(
      resolveDemoApiProxyTarget({
        DEMO_API_PROXY_URL: "http://demo-api.internal:3010",
        PORT: "9999",
      }),
    ).toBe("http://demo-api.internal:3010");
  });
});
