import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { resolveDistEntries } from "@repo/browser-baseline";

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

  it(".mjs와 .cjs 산출물도 검사 대상에 넣는다", () => {
    const dir = createPackageDirWith({
      ".": { require: "./dist/index.cjs", import: "./dist/index.mjs" },
    });

    expect(resolveDistEntries(dir)).toEqual([
      "dist/index.cjs",
      "dist/index.mjs",
    ]);
  });

  it("exports가 문자열 단축 표기여도 검사 대상을 파생한다", () => {
    const dir = createPackageDirWith("./dist/index.es.js");

    expect(resolveDistEntries(dir)).toEqual(["dist/index.es.js"]);
  });

  it("배열 폴백 exports의 모든 후보를 검사 대상에 넣는다", () => {
    const dir = createPackageDirWith({
      ".": [{ import: "./dist/a.js" }, "./dist/b.js"],
    });

    expect(resolveDistEntries(dir)).toEqual(["dist/a.js", "dist/b.js"]);
  });

  it("JavaScript가 아닌 exports 값은 검사 대상에서 뺀다", () => {
    const dir = createPackageDirWith({
      ".": { import: "./dist/index.es.js" },
      "./package.json": "./package.json",
      "./styles.css": "./dist/styles.css",
    });

    expect(resolveDistEntries(dir)).toEqual(["dist/index.es.js"]);
  });

  it("패키지 밖을 가리키는 exports 값은 조용히 고치지 않고 던진다", () => {
    const dir = createPackageDirWith({ ".": "../outside/index.js" });

    expect(() => resolveDistEntries(dir)).toThrow(/"\.\/"로 시작하지 않는다/);
  });

  it("절대 경로 exports 값은 던진다", () => {
    const dir = createPackageDirWith({ ".": "/opt/index.js" });

    expect(() => resolveDistEntries(dir)).toThrow(/"\.\/"로 시작하지 않는다/);
  });

  it("숨김 디렉터리의 앞 점을 지우지 않는다", () => {
    const dir = createPackageDirWith({ ".": "./.output/index.js" });

    expect(resolveDistEntries(dir)).toEqual([".output/index.js"]);
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
