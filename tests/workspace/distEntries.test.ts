import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { resolveDistEntries } from "../../packages/japanpost-react/scripts/dist-entries.mjs";

const packageDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../packages/japanpost-react",
);

const tempDirs: string[] = [];

/** exports 필드만 갈아 끼운 임시 package.json 디렉터리를 만든다. */
function createPackageDirWith(exportsField: unknown): string {
  const dir = mkdtempSync(path.join(tmpdir(), "dist-entries-"));
  tempDirs.push(dir);

  const manifest =
    exportsField === undefined
      ? { name: "probe" }
      : { name: "probe", exports: exportsField };

  writeFileSync(path.join(dir, "package.json"), JSON.stringify(manifest), "utf8");

  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop() as string, { force: true, recursive: true });
  }
});

describe("resolveDistEntries", () => {
  it("정본 package.json의 exports에서 검사 대상을 파생한다", () => {
    expect(resolveDistEntries(packageDir)).toEqual([
      "dist/client.es.js",
      "dist/index.es.js",
    ]);
  });

  it("엔트리를 추가하면 검사 대상이 따라온다", () => {
    const dir = createPackageDirWith({
      ".": { types: "./dist/index.d.ts", import: "./dist/index.es.js" },
      "./client": { types: "./dist/client.d.ts", import: "./dist/client.es.js" },
      "./server": { types: "./dist/server.d.ts", import: "./dist/server.es.js" },
    });

    expect(resolveDistEntries(dir)).toEqual([
      "dist/client.es.js",
      "dist/index.es.js",
      "dist/server.es.js",
    ]);
  });

  it("types 조건은 실행되지 않으므로 검사 대상에서 뺀다", () => {
    const dir = createPackageDirWith({
      ".": { types: "./dist/index.d.ts", import: "./dist/index.es.js" },
    });

    expect(resolveDistEntries(dir)).toEqual(["dist/index.es.js"]);
  });

  it("문자열 단축 표기도 검사 대상으로 받는다", () => {
    expect(resolveDistEntries(createPackageDirWith({ ".": "./dist/index.es.js" }))).toEqual(
      ["dist/index.es.js"],
    );
  });

  it("중첩된 조건부 exports도 따라 내려간다", () => {
    const dir = createPackageDirWith({
      ".": {
        types: "./dist/index.d.ts",
        browser: { import: "./dist/index.browser.js" },
        import: "./dist/index.es.js",
      },
    });

    expect(resolveDistEntries(dir)).toEqual([
      "dist/index.browser.js",
      "dist/index.es.js",
    ]);
  });

  it("exports 필드가 없으면 던진다", () => {
    expect(() => resolveDistEntries(createPackageDirWith(undefined))).toThrow(
      /exports 필드가 없다/,
    );
  });

  it("JavaScript 산출물이 없으면 통과시키지 않고 던진다", () => {
    const dir = createPackageDirWith({ ".": { types: "./dist/index.d.ts" } });

    expect(() => resolveDistEntries(dir)).toThrow(
      /검사 대상이 비면 통과가 아니라 실패다/,
    );
  });
});
