import path from "node:path";
import { describe, expect, it } from "vitest";

import demoViteConfig, {
  demoWorkspaceAliases,
  resolveDemoApiProxyTarget,
} from "../../apps/demo/vite.config";

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

describe("demo vite workspace aliases", () => {
  it("aliases only the supported package entrypoints to workspace sources", () => {
    const packageAliases = demoWorkspaceAliases.filter(
      (alias) =>
        typeof alias.find === "string" &&
        alias.find.startsWith("@cp949/japanpost-react"),
    );

    expect(packageAliases).toHaveLength(2);
    expect(packageAliases).toEqual(
      [
        {
          find: "@cp949/japanpost-react/client",
          replacement: path.resolve(
            import.meta.dirname,
            "../../packages/japanpost-react/src/client.ts",
          ),
        },
        {
          find: "@cp949/japanpost-react",
          replacement: path.resolve(
            import.meta.dirname,
            "../../packages/japanpost-react/src/index.ts",
          ),
        },
      ],
    );
    expect(packageAliases).not.toContainEqual(
      expect.objectContaining({
        find: "@cp949/japanpost-react/contracts",
      }),
    );
    expect(demoViteConfig.resolve?.alias).toBe(demoWorkspaceAliases);
  });
});
