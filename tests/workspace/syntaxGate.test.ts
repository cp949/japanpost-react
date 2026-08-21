import { describe, expect, it } from "vitest";

import {
  findFirstSyntaxDivergence,
  SYNTAX_TARGET,
} from "../../packages/japanpost-react/scripts/syntax-gate.mjs";

describe("findFirstSyntaxDivergence", () => {
  it("SYNTAX_TARGET을 es2019로 고정한다", () => {
    expect(SYNTAX_TARGET).toBe("es2019");
  });

  it("es2019에서도 동일하게 출력되는 소스는 null을 돌려준다", async () => {
    const source = "const value = 1;\nconsole.log(value);\n";

    await expect(findFirstSyntaxDivergence(source)).resolves.toBeNull();
  });

  it("optional chaining이 있는 소스는 불일치를 보고하고 actual이 원본 줄과 맞는다", async () => {
    const source = "const value = a?.b;\n";

    const result = await findFirstSyntaxDivergence(source);

    expect(result).not.toBeNull();
    expect(result?.line).toBe(1);
    // esnext 재출력은 소스를 그대로 통과시키므로 actual은 원본의 해당 줄과 같다.
    expect(result?.actual).toBe(source.split("\n")[(result?.line ?? 1) - 1]);
    expect(result?.lowered).not.toBe(result?.actual);
  });

  it("호이스트가 끼는 소스에서 보고된 lowered가 var _ 호이스트 줄이 아니다", async () => {
    // obj?.method?.() 는 es2019 하향 시 `var _a;` 호이스트 줄을
    // 문장보다 위에 끼워 넣는다(경험적으로 확인함, 아래 raw 출력 참고).
    // 하향 결과:
    //   var _a;
    //   (_a = obj == null ? void 0 : obj.method) == null ? void 0 : _a.call(obj);
    //   console.log(1);
    const source = "obj?.method?.();\nconsole.log(1);\n";

    const result = await findFirstSyntaxDivergence(source);

    expect(result).not.toBeNull();
    expect(result?.lowered).not.toMatch(/^\s*var _/);
  });
});
