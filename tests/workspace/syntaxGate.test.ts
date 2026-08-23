import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  findFirstSyntaxDivergence,
  loadBaseline,
} from "@repo/browser-baseline";

const packageDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../packages/japanpost-react",
);

/** 게이트가 실제로 쓰는 타깃과 같은 경로로 파생한다. */
const syntaxTarget = loadBaseline(packageDir).esbuildTarget;

describe("findFirstSyntaxDivergence", () => {
  it("타깃이 비면 던진다", async () => {
    await expect(
      findFirstSyntaxDivergence("const a = 1;\n", []),
    ).rejects.toThrow(/syntaxTarget이 비었다/);
  });

  it("계약 타깃에서도 동일하게 출력되는 소스는 null을 돌려준다", async () => {
    const source = "const value = 1;\nconsole.log(value);\n";

    await expect(
      findFirstSyntaxDivergence(source, syntaxTarget),
    ).resolves.toBeNull();
  });

  it("계약 타깃이 지원하는 nullish coalescing은 불일치로 보지 않는다", async () => {
    // Chrome 80은 ??를 네이티브 지원한다. es2019 타깃과 달리 하향되지 않는다.
    const source = "const value = a ?? b;\n";

    await expect(
      findFirstSyntaxDivergence(source, syntaxTarget),
    ).resolves.toBeNull();
  });

  it("optional chaining이 있는 소스는 불일치를 보고하고 actual이 원본 줄과 맞는다", async () => {
    // esbuild compat-table은 ?.를 Chrome 91로 판정하므로 chrome80 타깃에서 하향된다.
    const source = "const value = a?.b;\n";

    const result = await findFirstSyntaxDivergence(source, syntaxTarget);

    expect(result).not.toBeNull();
    expect(result?.line).toBe(1);
    // esnext 재출력은 소스를 그대로 통과시키므로 actual은 원본의 해당 줄과 같다.
    expect(result?.actual).toBe(source.split("\n")[(result?.line ?? 1) - 1]);
    expect(result?.lowered).not.toBe(result?.actual);
  });

  it("호이스트가 끼는 소스에서 보고된 lowered가 var _ 호이스트 줄이 아니다", async () => {
    // obj?.method?.() 는 하향 시 `var _a;` 호이스트 줄을 문장보다 위에 끼워 넣는다.
    // 하향 결과:
    //   var _a;
    //   (_a = obj == null ? void 0 : obj.method) == null ? void 0 : _a.call(obj);
    //   console.log(1);
    const source = "obj?.method?.();\nconsole.log(1);\n";

    const result = await findFirstSyntaxDivergence(source, syntaxTarget);

    expect(result).not.toBeNull();
    expect(result?.lowered).not.toMatch(/^\s*var _/);
  });
});
