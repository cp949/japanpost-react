import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const rootPackageJsonPath = path.join(repoRoot, "package.json");
const packagePackageJsonPath = path.join(
  repoRoot,
  "packages/japanpost-react/package.json",
);
const contributingPath = path.join(repoRoot, "CONTRIBUTING.md");

function readPackageJson(packageJsonPath: string): {
  scripts?: Record<string, string>;
} {
  return JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
    scripts?: Record<string, string>;
  };
}

function readText(filePath: string) {
  return fs.readFileSync(filePath, "utf8");
}

describe("repository verification scripts", () => {
  it("exposes the standard repository verification path at the repository root", () => {
    const rootPackageJson = readPackageJson(rootPackageJsonPath);

    expect(rootPackageJson.scripts).toEqual(
      expect.objectContaining({
        test: "node ./scripts/test.mjs",
        "test:package": "pnpm --filter @cp949/japanpost-react test",
      }),
    );
    expect(rootPackageJson.scripts).not.toHaveProperty("verify:release");
  });

  it("makes the package release script reuse the root repository verification path", () => {
    const packagePackageJson = readPackageJson(packagePackageJsonPath);

    expect(packagePackageJson.scripts).toEqual(
      expect.objectContaining({
        release: expect.stringContaining(
          "pnpm lint && pnpm check-types && pnpm --dir ../.. test && pnpm build && pnpm publish --access public",
        ),
      }),
    );
  });

  it("documents which verification entrypoints are cross-platform and which direct script paths remain Bash-only in contributing docs", () => {
    const contributing = readText(contributingPath);

    expect(contributing).toContain(
      "`pnpm test`, `pnpm demo:full`, and `pnpm api:check`",
    );
    expect(contributing).toContain(
      "run through Node-based entrypoints and do not require Bash.",
    );
    expect(contributing).toContain(
      "Direct `scripts/*.sh` execution remains a Bash-only convenience path.",
    );
  });
});
