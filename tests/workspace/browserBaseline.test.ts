import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { loadBaseline } from "@repo/browser-baseline";

const packageDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../packages/japanpost-react",
);

const tempDirs: string[] = [];

/** browserslist 필드만 갈아 끼운 임시 package.json 디렉터리를 만든다. */
function createPackageDirWith(browserslist: unknown): string {
  const dir = mkdtempSync(path.join(tmpdir(), "baseline-"));
  tempDirs.push(dir);

  const manifest =
    browserslist === undefined ? { name: "probe" } : { name: "probe", browserslist };

  writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify(manifest),
    "utf8",
  );

  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop() as string, { force: true, recursive: true });
  }
});

describe("loadBaseline", () => {
  it("정본 package.json의 browserslist 질의를 그대로 돌려준다", () => {
    // 이 단언이 깨지면 계약 자체가 바뀐 것이다. 파생 구현이 아니라 계약을 확인한다.
    expect(loadBaseline(packageDir).query).toEqual(["chrome >= 80"]);
  });

  it("정본 질의에서 esbuild 타깃과 Chrome 하한을 파생한다", () => {
    const baseline = loadBaseline(packageDir);

    expect(baseline.esbuildTarget).toEqual(["chrome80"]);
    expect(baseline.minChrome).toBe(80);
  });

  it("질의를 바꾸면 파생값이 따라온다", () => {
    const baseline = loadBaseline(createPackageDirWith(["chrome >= 90"]));

    expect(baseline.esbuildTarget).toEqual(["chrome90"]);
    expect(baseline.minChrome).toBe(90);
  });

  it("브라우저가 여럿이면 Chrome 하한만 뽑는다", () => {
    const baseline = loadBaseline(
      createPackageDirWith(["chrome >= 90", "firefox >= 100"]),
    );

    expect(baseline.minChrome).toBe(90);
    expect(baseline.esbuildTarget).toContain("chrome90");
  });

  it("browserslist 필드가 없으면 던진다", () => {
    expect(() => loadBaseline(createPackageDirWith(undefined))).toThrow(
      /browserslist 필드가 없다/,
    );
  });

  it("browserslist 필드가 비어 있으면 던진다", () => {
    expect(() => loadBaseline(createPackageDirWith([]))).toThrow(
      /browserslist 필드가 없다/,
    );
  });

  it("Chrome을 포함하지 않는 질의는 폴백 없이 던진다", () => {
    expect(() => loadBaseline(createPackageDirWith(["firefox >= 100"]))).toThrow(
      /Chrome 하한을 구할 수 없다/,
    );
  });
});
