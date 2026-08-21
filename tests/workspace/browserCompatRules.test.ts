import { describe, expect, it } from "vitest";

import {
  createScanner,
  FORBIDDEN_APIS,
} from "../../packages/japanpost-react/scripts/browser-compat-rules.mjs";

/** 계약의 현재 하한이다. 정본에서 파생되는지는 browserBaseline.test.ts가 검증한다. */
const scanner = createScanner({ minChrome: 80 });

describe("createScanner", () => {
  it("minChrome이 정수가 아니면 던진다", () => {
    // 타입 경계가 이미 막지만, 파생 실패를 폴백 없이 던지는지 런타임에서도 확인한다.
    // @ts-expect-error minChrome은 number다. 런타임 가드를 검증하려고 일부러 위반한다.
    expect(() => createScanner({ minChrome: "80" })).toThrow(/정수여야 한다/);
  });

  it("하한 이하에서 지원되는 항목은 검사 대상에서 뺀다", () => {
    // Intl.DisplayNames는 Chrome 81이므로 하한 80에서는 검사하고 90에서는 빼야 한다.
    const source = "const names = new Intl.DisplayNames([], {});\n";

    expect(
      scanner.scan(source, "dist/index.es.js").map((violation) => violation.name),
    ).toEqual(["Intl.DisplayNames"]);
    expect(
      createScanner({ minChrome: 90 }).scan(source, "dist/index.es.js"),
    ).toEqual([]);
  });

  it("하한을 올리면 검사 규칙 수가 줄어든다", () => {
    expect(createScanner({ minChrome: 80 }).rules.length).toBe(
      FORBIDDEN_APIS.length,
    );
    expect(createScanner({ minChrome: 120 }).rules.length).toBeLessThan(
      FORBIDDEN_APIS.length,
    );
  });
});

describe("scanner.scan", () => {
  it("Chrome 80 미지원 전역을 검출한다", () => {
    const violations = scanner.scan(
      "const copy = structuredClone(value);\n",
      "dist/index.es.js",
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      file: "dist/index.es.js",
      line: 1,
      name: "structuredClone",
      chrome: 98,
    });
  });

  it("Chrome 80 미지원 프로토타입 메서드를 검출한다", () => {
    const violations = scanner.scan(
      "const last = items.at(-1);\n",
      "dist/client.es.js",
    );

    expect(violations.map((violation) => violation.name)).toEqual([".at()"]);
  });

  it("addEventListener의 signal 옵션을 검출한다", () => {
    const source =
      'target.addEventListener("abort", onAbort, { signal: controller.signal });\n';

    expect(
      scanner.scan(source, "dist/index.es.js").map((violation) => violation.name),
    ).toEqual(["addEventListener({ signal })"]);
  });

  it("addEventListener의 signal 축약 표기를 검출한다", () => {
    const source = 'el.addEventListener("abort", onAbort, { signal });\n';

    expect(
      scanner.scan(source, "dist/index.es.js").map((violation) => violation.name),
    ).toEqual(["addEventListener({ signal })"]);
  });

  it("addEventListener 세 번째 인자에 화살표 함수가 오는 형태에서도 signal 옵션을 검출한다", () => {
    const source =
      'el.addEventListener("abort", () => cleanup(), { signal: ctrl.signal });\n';

    expect(
      scanner.scan(source, "dist/index.es.js").map((violation) => violation.name),
    ).toEqual(["addEventListener({ signal })"]);
  });

  it("AbortSignal.reason 프로퍼티 접근을 검출한다", () => {
    const source = "if (signal.reason) throw signal.reason;\n";

    expect(
      scanner.scan(source, "dist/index.es.js").map((violation) => violation.name),
    ).toEqual(["AbortSignal.reason"]);
  });

  it("URL.canParse 정적 메서드를 검출한다", () => {
    const source = "const ok = URL.canParse(input);\n";

    expect(
      scanner.scan(source, "dist/index.es.js").map((violation) => violation.name),
    ).toEqual(["URL.canParse"]);
  });

  it("Response.json 정적 메서드를 검출한다", () => {
    const source = "return Response.json(payload);\n";

    expect(
      scanner.scan(source, "dist/index.es.js").map((violation) => violation.name),
    ).toEqual(["Response.json()"]);
  });

  it("Chrome 80이 지원하는 API는 검출하지 않는다", () => {
    const source = [
      "const value = globalThis.fetch;",
      "const settled = Promise.allSettled([]);",
      "const matches = text.matchAll(pattern);",
      "const merged = rows.flatMap((row) => row);",
      "const trimmed = label.trimStart();",
      'signal.addEventListener("abort", onAbort, { once: true });',
      "if (signal.aborted) return;",
    ].join("\n");

    expect(scanner.scan(source, "dist/index.es.js")).toEqual([]);
  });

  it("여러 위반을 줄 번호 오름차순으로 반환한다", () => {
    const source = [
      "const a = 1;",
      'const b = text.replaceAll("x", "y");',
      "const c = 2;",
      "const d = structuredClone(a);",
    ].join("\n");

    const violations = scanner.scan(source, "dist/index.es.js");

    expect(
      violations.map((violation) => [violation.line, violation.name]),
    ).toEqual([
      [2, ".replaceAll()"],
      [4, "structuredClone"],
    ]);
  });

  it("같은 줄에 위반이 두 개면 이름 사전순으로 정렬한다", () => {
    const source = "const x = a.at(0), y = structuredClone(b);\n";

    const violations = scanner.scan(source, "dist/index.es.js");

    expect(
      violations.map((violation) => [violation.line, violation.name]),
    ).toEqual([
      [1, ".at()"],
      [1, "structuredClone"],
    ]);
  });

  it("allowed 예외에 등록된 항목은 해당 파일에서만 건너뛴다", () => {
    const source = "const last = items.at(-1);\n";
    const allowingScanner = createScanner({
      minChrome: 80,
      allowed: [
        { file: "dist/index.es.js", name: ".at()", reason: "테스트용 예외" },
      ],
    });

    expect(allowingScanner.scan(source, "dist/index.es.js")).toEqual([]);
    expect(
      allowingScanner
        .scan(source, "dist/client.es.js")
        .map((violation) => violation.name),
    ).toEqual([".at()"]);
  });
});
