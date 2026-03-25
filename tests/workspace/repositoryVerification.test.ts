import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const rootPackageJsonPath = path.join(repoRoot, "package.json");
const packagePackageJsonPath = path.join(
  repoRoot,
  "packages/japanpost-react/package.json",
);
const rootReadmePath = path.join(repoRoot, "README.md");
const rootReadmeKoPath = path.join(repoRoot, "README.ko.md");
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
  it("exposes a standard release-grade verification path at the repository root", () => {
    const rootPackageJson = readPackageJson(rootPackageJsonPath);

    expect(rootPackageJson.scripts).toEqual(
      expect.objectContaining({
        test: "node ./scripts/test.mjs",
        "test:package": "pnpm --filter @cp949/japanpost-react test",
        "verify:release":
          "pnpm test && pnpm --filter @cp949/japanpost-react test:artifacts",
      }),
    );
  });

  it("makes the package release script reuse the root release-grade verification path", () => {
    const packagePackageJson = readPackageJson(packagePackageJsonPath);

    expect(packagePackageJson.scripts).toEqual(
      expect.objectContaining({
        release:
          "pnpm --dir ../.. readme:package && pnpm lint && pnpm check-types && pnpm --dir ../.. verify:release && pnpm build && pnpm publish --access public",
      }),
    );
  });

  it("documents which verification entrypoints are cross-platform and which direct script paths remain Bash-only", () => {
    const readme = readText(rootReadmePath);
    const readmeKo = readText(rootReadmeKoPath);
    const contributing = readText(contributingPath);

    expect(readme).toContain(
      "`pnpm test`: run the cross-platform repository verification path.",
    );
    expect(readme).toContain(
      "Direct `scripts/*.sh` entrypoints remain Bash-only convenience wrappers",
    );

    expect(readmeKo).toContain(
      "`pnpm test`와 `pnpm verify:release`는 Node 기반 진입점이라 Windows native",
    );
    expect(readmeKo).toContain(
      "직접 `scripts/*.sh`를 실행하는 경로만 Bash/Linux/WSL 전제를 유지합니다.",
    );

    expect(contributing).toContain(
      "`pnpm test`, `pnpm verify:release`, `pnpm demo:full`, and `pnpm api:check`",
    );
    expect(contributing).toContain(
      "run through Node-based entrypoints and do not require Bash.",
    );
    expect(contributing).toContain(
      "Direct `scripts/*.sh` execution remains a Bash-only convenience path.",
    );
  });
});
