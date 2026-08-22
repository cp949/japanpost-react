import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { checkPackageBaseline, formatReport } from "@repo/browser-baseline";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures/browser-baseline",
);

describe("checkPackageBaseline", () => {
  it("fixture 디렉터리의 exports에서 files를 파생하고 위반을 findings로 모은다", async () => {
    const packageDir = path.join(fixturesDir, "violations");

    const result = await checkPackageBaseline({ packageDir });

    expect(result.files).toEqual(["bundle/index.mjs"]);
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        kind: "api",
        file: "bundle/index.mjs",
        name: ".at()",
        tier: 2,
      }),
    );
  });

  it("dist 파일이 없으면 kind:error finding을 남기고 ok는 false다", async () => {
    const packageDir = path.join(fixturesDir, "missing-dist");

    const result = await checkPackageBaseline({ packageDir });

    expect(result.ok).toBe(false);
    expect(result.findings).toEqual([
      {
        kind: "error",
        file: "bundle/index.mjs",
        message: "dist 산출물이 없다. 먼저 pnpm build를 실행한다.",
      },
    ]);
  });

  it("위반이 없으면 ok는 true이고 findings는 빈 배열이다", async () => {
    const packageDir = path.join(fixturesDir, "clean");

    const result = await checkPackageBaseline({ packageDir });

    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("allow 항목이 일치하면 해당 finding이 사라진다", async () => {
    const packageDir = path.join(fixturesDir, "violations");

    const result = await checkPackageBaseline({
      packageDir,
      allow: [{ file: "bundle/index.mjs", name: ".at()", reason: "테스트용 예외" }],
    });

    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
  });
});

describe("formatReport", () => {
  it("tier 2 위반이 있으면 browserBaseline.allow 해소 경로를 안내한다", async () => {
    const packageDir = path.join(fixturesDir, "violations");
    const result = await checkPackageBaseline({ packageDir });

    const lines = formatReport(result);

    expect(lines.some((line) => line.includes("browserBaseline.allow"))).toBe(
      true,
    );
  });
});
