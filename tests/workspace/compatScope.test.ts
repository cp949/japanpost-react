// 이 import는 루트 workspace의 acorn을 해석한다(packages/japanpost-react가
// 아니라 저장소 루트 package.json의 devDependency다). compat-scope.mjs가
// import하는 acorn과 버전이 어긋나면 이 테스트 파일이 통과해도 실제 스캐너가
// 다르게 동작할 수 있다 — 파서 두 벌을 쓰는 구성 자체가 drift 위험이다.
import { parse } from "acorn";
import { describe, expect, it } from "vitest";

import { collectGlobalReferences } from "../../packages/japanpost-react/scripts/compat-scope.mjs";

/** 소스에서 전역으로 해석된 식별자 이름을 정렬해 돌려준다. */
function globalNames(source: string): string[] {
  const ast = parse(source, { ecmaVersion: "latest", sourceType: "module" });
  const refs = collectGlobalReferences(ast);

  return [...refs].map((node) => (node as { name: string }).name).sort();
}

describe("collectGlobalReferences", () => {
  it("선언되지 않은 식별자를 전역으로 본다", () => {
    // 호출 대상과 인자 둘 다 미선언이므로 둘 다 전역 참조다.
    expect(globalNames("structuredClone(value);")).toEqual([
      "structuredClone",
      "value",
    ]);
  });

  it("const 선언이 전역을 가린다", () => {
    // structuredClone은 가려지고, 미선언인 f와 v만 남는다.
    expect(
      globalNames("const structuredClone = f;\nstructuredClone(v);"),
    ).toEqual(["f", "v"]);
  });

  it("let·var 선언이 전역을 가린다", () => {
    expect(
      globalNames(
        "let WeakRef = 1; var reportError = 2; WeakRef; reportError;",
      ),
    ).toEqual([]);
  });

  it("함수 선언이 전역을 가린다", () => {
    expect(globalNames("function reportError() {}\nreportError();")).toEqual(
      [],
    );
  });

  it("클래스 선언이 전역을 가린다", () => {
    expect(globalNames("class WeakRef {}\nnew WeakRef();")).toEqual([]);
  });

  it("import 바인딩이 전역을 가린다", () => {
    const source = [
      'import { forwardRef } from "react";',
      'import structuredClone from "polyfill";',
      "forwardRef(structuredClone);",
    ].join("\n");

    expect(globalNames(source)).toEqual([]);
  });

  it("import 네임스페이스와 기본 바인딩도 가린다", () => {
    const source = [
      'import * as WeakRef from "a";',
      'import AggregateError, { x } from "b";',
      "WeakRef; AggregateError; x;",
    ].join("\n");

    expect(globalNames(source)).toEqual([]);
  });

  it("매개변수가 전역을 가린다", () => {
    expect(
      globalNames("function f(structuredClone) { structuredClone(1); }"),
    ).toEqual([]);
  });

  it("구조분해 매개변수가 전역을 가린다", () => {
    const source =
      "function f({ structuredClone, a: reportError }, [WeakRef], ...AggregateError) {" +
      " structuredClone; reportError; WeakRef; AggregateError; }";

    expect(globalNames(source)).toEqual([]);
  });

  it("기본값이 있는 매개변수도 가린다", () => {
    expect(globalNames("const f = (WeakRef = 1) => WeakRef;")).toEqual([]);
  });

  it("catch 바인딩이 전역을 가린다", () => {
    const source = "try { x(); } catch (AggregateError) { AggregateError; }";

    expect(globalNames(source)).toEqual(["x"]);
  });

  it("블록 밖에서는 블록 안 let 선언이 가리지 않는다", () => {
    const source = "{ let structuredClone = 1; }\nstructuredClone(v);";

    expect(globalNames(source)).toEqual(["structuredClone", "v"]);
  });

  it("var는 함수 스코프이므로 블록 밖에서도 가린다", () => {
    const source =
      "function f() { { var structuredClone = 1; } structuredClone(); }";

    expect(globalNames(source)).toEqual([]);
  });

  it("함수 선언은 호이스팅되므로 선언 앞에서도 가린다", () => {
    const source = "reportError();\nfunction reportError() {}";

    expect(globalNames(source)).toEqual([]);
  });

  it("멤버 표현식의 프로퍼티 이름은 전역 참조가 아니다", () => {
    expect(globalNames("obj.structuredClone;")).toEqual(["obj"]);
  });

  it("computed 멤버의 키는 전역 참조다", () => {
    expect(globalNames("obj[WeakRef];")).toEqual(["WeakRef", "obj"]);
  });

  it("객체 리터럴의 non-computed 키는 전역 참조가 아니다", () => {
    expect(globalNames("({ structuredClone: 1, [WeakRef]: 2 });")).toEqual([
      "WeakRef",
    ]);
  });

  it("축약 프로퍼티는 값 참조이므로 전역 참조다", () => {
    expect(globalNames("({ structuredClone });")).toEqual(["structuredClone"]);
  });

  it("라벨은 전역 참조가 아니다", () => {
    const source = "structuredClone: for (;;) { break structuredClone; }";

    expect(globalNames(source)).toEqual([]);
  });

  it("함수 표현식의 이름은 자기 스코프 안에서만 보인다", () => {
    const source =
      "const f = function WeakRef() { return WeakRef; };\nWeakRef;";

    expect(globalNames(source)).toEqual(["WeakRef"]);
  });

  it("클래스 표현식의 이름은 스스로 전역 참조를 만들지 않는다", () => {
    // I2: ClassExpression에는 FunctionExpression과 짝이 되는 자기 스코프
    // 처리가 없었다. id가 이름 자리로도 자기 스코프 바인딩으로도 처리되지
    // 않아 일반 재귀를 타고 Identifier 케이스로 떨어져 전역 참조로 잘못
    // 세어졌다(Tier 1 오탐).
    expect(globalNames("const X = class WeakRef {};")).toEqual([]);
  });

  it("클래스 표현식의 이름은 자기 스코프 안에서만 보인다", () => {
    // 함수 표현식 테스트와 같은 모양이다 — 클래스 바디 안의 자기 참조는
    // 가려지고, 바깥의 동명 참조는 여전히 전역이다.
    const source =
      "const f = class WeakRef { static m() { return WeakRef; } };\nWeakRef;";

    expect(globalNames(source)).toEqual(["WeakRef"]);
  });

  it("같은 이름을 여러 번 참조하면 노드마다 담는다", () => {
    const ast = parse("structuredClone(structuredClone);", {
      ecmaVersion: "latest",
      sourceType: "module",
    });

    expect(collectGlobalReferences(ast).size).toBe(2);
  });

  it("export 선언이 만드는 바인딩도 가린다", () => {
    expect(globalNames("export const WeakRef = 1;\nWeakRef;")).toEqual([]);
  });

  it("new.target의 meta·property는 전역 참조가 아니다", () => {
    expect(globalNames("function f(){return new.target;}")).toEqual([]);
  });

  it("import.meta의 meta·property는 전역 참조가 아니다", () => {
    expect(globalNames("import.meta.url;")).toEqual([]);
  });

  it("export * as 별칭은 전역 참조가 아니다", () => {
    // 별칭이 실제 BCD 전역 이름(structuredClone)과 겹쳐도 스코프 참조가 아니다.
    expect(globalNames('export * as structuredClone from "mod";')).toEqual([]);
  });

  it("for...of 바인딩이 전역을 가린다", () => {
    expect(globalNames("for (const x of arr) { x; }")).toEqual(["arr"]);
  });

  it("for...in 바인딩이 전역을 가린다", () => {
    expect(globalNames("for (const k in obj) { k; }")).toEqual(["obj"]);
  });

  it("C형 for의 초기화 바인딩이 전역을 가린다", () => {
    expect(globalNames("for (let i = 0; i < n; i++) { i; }")).toEqual(["n"]);
  });

  it("객체 리터럴의 getter 이름은 이름 자리다", () => {
    expect(
      globalNames("({ get structuredClone() { return WeakRef; } });"),
    ).toEqual(["WeakRef"]);
  });

  it("객체 리터럴의 setter 이름은 이름 자리다", () => {
    expect(
      globalNames("({ set structuredClone(v) { WeakRef = v; } });"),
    ).toEqual(["WeakRef"]);
  });

  it("클래스 computed 멤버 키는 전역 참조다", () => {
    expect(globalNames("class C { [WeakRef]() {} }")).toEqual(["WeakRef"]);
  });

  it("클래스 non-computed 메서드 이름은 전역 참조가 아니다", () => {
    expect(globalNames("class C { structuredClone() {} }")).toEqual([]);
  });
});
