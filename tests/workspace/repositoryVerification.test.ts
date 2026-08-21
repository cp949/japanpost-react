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
const tsupConfigPath = path.join(
  repoRoot,
  "packages/japanpost-react/tsup.config.ts",
);
const syntaxGatePath = path.join(
  repoRoot,
  "packages/japanpost-react/scripts/syntax-gate.mjs",
);

function readPackageJson(packageJsonPath: string): {
  scripts?: Record<string, string>;
  browserslist?: string[];
} {
  return JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
    scripts?: Record<string, string>;
    browserslist?: string[];
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

  it("브라우저 지원 기준선의 정본은 package.json#browserslist 하나다", () => {
    const tsupConfig = readText(tsupConfigPath);
    const syntaxGate = readText(syntaxGatePath);
    const packagePackageJson = readPackageJson(packagePackageJsonPath);

    // 정본. 이 값을 바꾸는 것이 계약을 바꾸는 유일한 방법이어야 한다.
    expect(packagePackageJson.browserslist).toEqual(["chrome >= 80"]);

    // 소비자는 파생만 한다. 리터럴이 다시 들어오면 정본이 둘이 된다.
    expect(tsupConfig).toContain("loadBaseline(");
    expect(tsupConfig).not.toMatch(/target\s*=\s*["'`](es|chrome)/);
    expect(syntaxGate).not.toContain("SYNTAX_TARGET");
    expect(syntaxGate).not.toMatch(/["'`](es20\d\d|chrome\d+)["'`]/);
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
