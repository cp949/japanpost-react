import { describe, expect, it } from "vitest";

import {
  scanForbiddenApis,
} from "../../packages/japanpost-react/scripts/browser-compat-rules.mjs";

describe("scanForbiddenApis", () => {
  it("Chrome 80 미지원 전역을 검출한다", () => {
    const violations = scanForbiddenApis(
      "const copy = structuredClone(value);\n",
      "index.es.js",
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      file: "index.es.js",
      line: 1,
      name: "structuredClone",
      chrome: 98,
    });
  });

  it("Chrome 80 미지원 프로토타입 메서드를 검출한다", () => {
    const violations = scanForbiddenApis(
      "const last = items.at(-1);\n",
      "client.es.js",
    );

    expect(violations.map((violation) => violation.name)).toEqual([".at()"]);
  });

  it("addEventListener의 signal 옵션을 검출한다", () => {
    const source =
      'target.addEventListener("abort", onAbort, { signal: controller.signal });\n';

    expect(
      scanForbiddenApis(source, "index.es.js").map((violation) => violation.name),
    ).toEqual(["addEventListener({ signal })"]);
  });

  it("Chrome 80이 지원하는 API는 검출하지 않는다", () => {
    const source = [
      "const value = globalThis.fetch;",
      "const settled = Promise.allSettled([]);",
      "const matches = text.matchAll(pattern);",
      "const merged = rows.flatMap((row) => row);",
      "const trimmed = label.trimStart();",
      'signal.addEventListener("abort", onAbort, { once: true });',
    ].join("\n");

    expect(scanForbiddenApis(source, "index.es.js")).toEqual([]);
  });

  it("여러 위반을 줄 번호 오름차순으로 반환한다", () => {
    const source = [
      "const a = 1;",
      'const b = text.replaceAll("x", "y");',
      "const c = 2;",
      "const d = structuredClone(a);",
    ].join("\n");

    const violations = scanForbiddenApis(source, "index.es.js");

    expect(
      violations.map((violation) => [violation.line, violation.name]),
    ).toEqual([
      [2, ".replaceAll()"],
      [4, "structuredClone"],
    ]);
  });

  it("ALLOWED 예외에 등록된 항목은 해당 파일에서만 건너뛴다", () => {
    const source = "const last = items.at(-1);\n";
    const allowed = [
      { file: "index.es.js", name: ".at()", reason: "테스트용 예외" },
    ];

    expect(scanForbiddenApis(source, "index.es.js", allowed)).toEqual([]);
    expect(
      scanForbiddenApis(source, "client.es.js", allowed).map(
        (violation) => violation.name,
      ),
    ).toEqual([".at()"]);
  });
});
