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

  it("브라우저 지원 기준선 리터럴이 세 파일에서 일치한다", () => {
    const tsupConfig = readText(tsupConfigPath);
    const syntaxGate = readText(syntaxGatePath);
    const packagePackageJson = readPackageJson(packagePackageJsonPath);

    expect(tsupConfig).toContain('const target = "es2019";');
    expect(syntaxGate).toContain('SYNTAX_TARGET = "es2019"');
    expect(packagePackageJson.browserslist).toEqual(["chrome >= 80"]);
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
