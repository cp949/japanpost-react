import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createScanner } from "@repo/browser-baseline";

/** 계약의 현재 하한이다. 정본에서 파생되는지는 browserBaseline.test.ts가 검증한다. */
const scanner = createScanner({ minChrome: 80 });

/** 소스를 스캔해 위반 이름만 정렬해 돌려준다. */
function names(source: string, fileName = "dist/index.es.js"): string[] {
  return scanner
    .scan(source, fileName)
    .map((violation) => violation.name)
    .sort();
}

describe("브라우저 하한에 맞는 스캐너를 생성한다", () => {
  it("minChrome이 정수가 아니면 던진다", () => {
    // @ts-expect-error minChrome은 number다. 런타임 가드를 검증하려고 일부러 위반한다.
    expect(() => createScanner({ minChrome: "80" })).toThrow(/정수여야 한다/);
  });

  it("파싱할 수 없는 소스는 던진다", () => {
    // dist가 파싱되지 않으면 검사 불가다. 통과가 아니다.
    expect(() => scanner.scan("const = ;", "dist/index.es.js")).toThrow(
      /파싱할 수 없다/,
    );
  });

  it("indexSize는 색인 세 갈래 크기의 합이다", () => {
    // "진단·테스트용"이라 선언만 해두고 아무도 읽지 않았다.
    // globals 14 + statics 2611 + members 201 = 2826(minChrome 80 실측치).
    expect(scanner.indexSize).toBe(2826);
  });
});

describe("전역 식별자를 확정 위반으로 판정한다", () => {
  it("전역 함수 호출을 검출한다", () => {
    const violations = scanner.scan(
      "const c = structuredClone(v);\n",
      "dist/index.es.js",
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      file: "dist/index.es.js",
      line: 1,
      name: "structuredClone",
      chrome: 98,
      tier: 1,
    });
  });

  it("전역 생성자를 검출한다", () => {
    expect(
      names("new WeakRef(v); new FinalizationRegistry(f); reportError(e);"),
    ).toEqual(["FinalizationRegistry", "WeakRef", "reportError"]);
  });

  it("AggregateError를 검출한다", () => {
    expect(
      names("catchAll().catch((e) => e instanceof AggregateError);"),
    ).toEqual(["AggregateError"]);
  });

  it("지역에서 가려진 전역은 위반이 아니다", () => {
    const source = [
      'import structuredClone from "polyfill";',
      "const copy = structuredClone(value);",
    ].join("\n");

    expect(names(source)).toEqual([]);
  });

  it("문자열 리터럴 안의 토큰은 위반이 아니다", () => {
    expect(names('const s = "structuredClone(x)";')).toEqual([]);
  });

  it("주석 안의 토큰은 위반이 아니다", () => {
    expect(names("// structuredClone(x)\n/* WeakRef */\nconst a = 1;")).toEqual(
      [],
    );
  });

  it("클래스 표현식의 이름과 같은 전역은 오탐이 아니다", () => {
    // I2: ClassExpression.id가 자기 스코프에 바인딩되지 않으면 전역 참조로
    // 오판된다. Tier 1은 오탐이 없어야 한다(spec §6) — 이 테스트가 그걸 pin한다.
    expect(names("const X = class WeakRef {};")).toEqual([]);
  });

  it("static block의 var와 같은 바깥 전역을 검출한다", () => {
    const source =
      "class C { static { var structuredClone = 1; } }\nstructuredClone(v);";

    expect(names(source)).toEqual(["structuredClone"]);
  });
});

describe("전역의 static 멤버를 확정 위반으로 판정한다", () => {
  it("javascript.builtins의 static을 검출한다", () => {
    expect(
      names(
        "Object.hasOwn(o, 'k'); Promise.any([]); Array.fromAsync(x); Map.groupBy(a, f);",
      ),
    ).toEqual([
      "Array.fromAsync",
      "Map.groupBy",
      "Object.hasOwn",
      "Promise.any",
    ]);
  });

  it("Object.groupBy를 검출한다", () => {
    expect(names("const g = Object.groupBy(rows, keyOf);")).toEqual([
      "Object.groupBy",
    ]);
  });

  it("api.*의 static을 검출한다", () => {
    expect(
      names(
        "URL.canParse(u); Response.json(p); AbortSignal.abort(); AbortSignal.timeout(1); AbortSignal.any([]);",
      ),
    ).toEqual([
      "AbortSignal.abort",
      "AbortSignal.any",
      "AbortSignal.timeout",
      "Response.json",
      "URL.canParse",
    ]);
  });

  it("Intl 네임스페이스 멤버를 검출한다", () => {
    expect(
      names("new Intl.DisplayNames([], {}); new Intl.Segmenter();"),
    ).toEqual(["Intl.DisplayNames", "Intl.Segmenter"]);
  });

  it("Response.json의 Chrome 버전이 BCD 값과 맞는다", () => {
    // 낡은 데니리스트는 93으로 적혀 있었다. BCD는 105다.
    const violations = scanner.scan("Response.json(p);", "dist/index.es.js");

    expect(violations[0]).toMatchObject({ name: "Response.json", chrome: 105 });
  });
});

describe("타입이 고정된 전역의 멤버를 확정 위반으로 판정한다", () => {
  it("crypto.randomUUID를 검출한다", () => {
    const violations = scanner.scan(
      "const id = crypto.randomUUID();",
      "dist/index.es.js",
    );

    expect(violations[0]).toMatchObject({
      name: "crypto.randomUUID",
      chrome: 92,
      tier: 1,
    });
  });

  it("navigator.userAgentData를 검출한다", () => {
    const violations = scanner.scan(
      "const d = navigator.userAgentData;",
      "dist/index.es.js",
    );

    expect(violations[0]).toMatchObject({
      name: "navigator.userAgentData",
      chrome: 90,
      tier: 1,
    });
  });

  it("현재 Chrome에서 제거된 document API를 검출한다", () => {
    const violations = scanner.scan(
      "document.createTouchList();",
      "dist/index.es.js",
    );

    expect(violations).toEqual([
      expect.objectContaining({
        name: "document.createTouchList",
        chrome: Number.POSITIVE_INFINITY,
        tier: 1,
      }),
    ]);
  });

  it("globalThis 접두로 부른 전역도 검출한다", () => {
    // 교체 전 정규식은 \b 덕분에 접두 형태를 잡았다. 놓치면 회귀다.
    const violations = scanner.scan(
      "const c = globalThis.structuredClone(v);",
      "dist/index.es.js",
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      name: "globalThis.structuredClone",
      chrome: 98,
      tier: 1,
    });
  });

  it("window·self 접두도 같은 전역으로 본다", () => {
    expect(names("window.reportError(e); self.structuredClone(v);")).toEqual([
      "self.structuredClone",
      "window.reportError",
    ]);
  });

  it("접두 전역 멤버 접근을 한 번만 보고한다", () => {
    // 전역 객체 자체(globalThis)는 색인에 없으므로 멤버 판정 하나만 나온다.
    expect(
      scanner.scan("globalThis.WeakRef;", "dist/index.es.js"),
    ).toHaveLength(1);
  });

  it("globals와 statics 소유자가 겹치는 이름은 한 번만 보고한다", () => {
    // globals ∩ statics 소유자 = AggregateError, SuppressedError, Temporal 셋이다.
    // claimed.add(node.object) 계열의 줄이 없으면 Temporal.Now.instant()가
    // "Temporal.Now"(이 멤버 판정)와 바깥 전역 "Temporal" 둘로 이중 보고된다.
    // 이 테스트는 그 줄을 지우면 실제로 깨진다 — 위 WeakRef 테스트와 달리
    // 방어용이 아니라 살아 있는 pin이다.
    expect(names("Temporal.Now.instant();")).toEqual(["Temporal.Now"]);
  });

  it("typeof 가드는 위반이 아니다", () => {
    // 기능 탐지 관용구다. 선언되지 않은 이름에 써도 던지지 않는다.
    const source = [
      'if (typeof structuredClone === "function") { use(); }',
      'if (typeof globalThis.reportError === "function") { use(); }',
      'if (typeof crypto.randomUUID === "function") { use(); }',
      'if (typeof Object.hasOwn === "function") { use(); }',
    ].join("\n");

    expect(names(source)).toEqual([]);
  });

  it("가려진 고정 전역은 Tier 1이 아니라 Tier 2로 내려간다", () => {
    // 매개변수가 crypto를 가리면 수신자 타입을 더 이상 증명할 수 없다.
    // Tier 1의 확정 판정은 사라지지만 이름 기반 Tier 2 판정은 남는다 —
    // 실제로 Crypto를 담고 있을 수 있으므로 통과시키는 것은 틀렸다.
    const violations = scanner.scan(
      "function f(crypto) { return crypto.randomUUID(); }",
      "dist/index.es.js",
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ name: ".randomUUID()", tier: 2 });
  });
});

describe("전역 객체 접두가 붙은 참조를 확정 위반으로 판정한다", () => {
  it("globalThis 두 단계 접두로 부른 static 12개를 전부 검출한다", () => {
    // C1: node.object가 Identifier가 아니라 MemberExpression인 두 단계
    // 접두(globalThis.Object.hasOwn 등)는 한 단계 접두 판정만으로는 잡히지
    // 않았다. 데니리스트 31개 중 static 형식 12개 전부를 회귀로 고정한다.
    const cases: Array<[string, string, number]> = [
      ["globalThis.Object.hasOwn(o, 'k');", "globalThis.Object.hasOwn", 93],
      [
        "globalThis.Object.groupBy(rows, keyOf);",
        "globalThis.Object.groupBy",
        117,
      ],
      ["globalThis.Map.groupBy(a, f);", "globalThis.Map.groupBy", 117],
      ["globalThis.Promise.any([]);", "globalThis.Promise.any", 85],
      ["globalThis.Array.fromAsync(x);", "globalThis.Array.fromAsync", 121],
      ["globalThis.AbortSignal.abort();", "globalThis.AbortSignal.abort", 93],
      [
        "globalThis.AbortSignal.timeout(1);",
        "globalThis.AbortSignal.timeout",
        103,
      ],
      ["globalThis.AbortSignal.any([]);", "globalThis.AbortSignal.any", 116],
      ["globalThis.URL.canParse(u);", "globalThis.URL.canParse", 120],
      ["globalThis.Response.json(p);", "globalThis.Response.json", 105],
      [
        "new globalThis.Intl.DisplayNames([], {});",
        "globalThis.Intl.DisplayNames",
        81,
      ],
      ["new globalThis.Intl.Segmenter();", "globalThis.Intl.Segmenter", 87],
    ];

    expect(cases).toHaveLength(12);

    for (const [source, name, chrome] of cases) {
      const violations = scanner.scan(source, "dist/index.es.js");

      expect(violations, `놓침: ${source}`).toHaveLength(1);
      expect(violations[0]).toMatchObject({ name, chrome, tier: 1 });
    }
  });

  it("window·self 두 단계 접두도 같은 규칙으로 검출한다", () => {
    // globalThis 하나만으로는 일반화를 증명하지 않는다 — 다른 전역 객체
    // 접두도 같은 판정 경로를 타는지 본다.
    expect(names("window.URL.canParse(u); self.Response.json(p);")).toEqual([
      "self.Response.json",
      "window.URL.canParse",
    ]);
  });

  it("고정 전역 인스턴스에도 두 단계 접두가 적용된다", () => {
    // 보너스: 한 단계 접두 해석으로는 globalThis.crypto.randomUUID()의
    // .randomUUID()가 Tier 2로 내려갔다. 두 단계 언랩 후에는 Tier 1로 확정된다.
    const violations = scanner.scan(
      "globalThis.crypto.randomUUID();",
      "dist/index.es.js",
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      name: "globalThis.crypto.randomUUID",
      chrome: 92,
      tier: 1,
    });
  });

  it("반복된 전역 객체 접두를 깊이 제한 없이 Tier 1로 검출한다", () => {
    const cases: Array<[string, string, number]> = [
      [
        "globalThis.globalThis.Object.hasOwn(o, k);",
        "globalThis.globalThis.Object.hasOwn",
        93,
      ],
      [
        "globalThis.globalThis.structuredClone(v);",
        "globalThis.globalThis.structuredClone",
        98,
      ],
      [
        "globalThis.globalThis.window.self.Object.hasOwn(o, k);",
        "globalThis.globalThis.window.self.Object.hasOwn",
        93,
      ],
      [
        'self["self"]["self"]["structuredClone"](v);',
        "self.self.self.structuredClone",
        98,
      ],
    ];

    for (const [source, name, chrome] of cases) {
      expect(scanner.scan(source, "dist/index.es.js")).toEqual([
        expect.objectContaining({ name, chrome, tier: 1 }),
      ]);
    }
  });

  it("반복 접두의 동적 computed 키는 판정하지 않는다", () => {
    const source = [
      "globalThis[prefix].Object.hasOwn(o, k);",
      "globalThis.globalThis.Object[method](o, k);",
    ].join("\n");

    expect(names(source)).toEqual([]);
  });
});

describe("수신자 타입을 모르는 멤버를 모호 위반으로 판정한다", () => {
  it("프로토타입 메서드 호출을 검출한다", () => {
    const violations = scanner.scan(
      "const last = items.at(-1);",
      "dist/client.es.js",
    );

    expect(violations[0]).toMatchObject({
      file: "dist/client.es.js",
      name: ".at()",
      chrome: 92,
      tier: 2,
    });
  });

  it("데니리스트의 배열·문자열 메서드를 전부 검출한다", () => {
    const source = [
      "a.replaceAll(x, y);",
      "b.findLast(f);",
      "c.findLastIndex(f);",
      "d.toSorted();",
      "e.toReversed();",
      "g.toSpliced(0, 1);",
      "h.with(0, v);",
    ].join("\n");

    expect(names(source)).toEqual([
      ".findLast()",
      ".findLastIndex()",
      ".replaceAll()",
      ".toReversed()",
      ".toSorted()",
      ".toSpliced()",
      ".with()",
    ]);
  });

  it("데니리스트의 DOM 메서드를 검출한다", () => {
    const source = [
      "el.replaceChildren(n);",
      "s.throwIfAborted();",
      "i.showPicker();",
    ].join("\n");

    expect(names(source)).toEqual([
      ".replaceChildren()",
      ".showPicker()",
      ".throwIfAborted()",
    ]);
  });

  it("프로퍼티 접근은 괄호 없는 이름으로 보고한다", () => {
    const violations = scanner.scan(
      "if (signal.reason) throw signal.reason;",
      "dist/index.es.js",
    );

    expect(violations).toHaveLength(2);
    expect(violations[0]).toMatchObject({
      name: ".reason",
      chrome: 98,
      tier: 2,
    });
  });

  it("문자열 리터럴 안의 메서드 표기는 위반이 아니다", () => {
    // 실측 오탐 1번이다. AST는 리터럴을 안다.
    expect(names('const url = "https://x.test/docs/.at(0)";')).toEqual([]);
  });

  it("수신자 타입을 모르는 호출은 여전히 보고한다", () => {
    // 실측 오탐 2번이다. 정적으로 해소할 수 없는 구조적 한계이며 ALLOWED로 처리한다.
    expect(names("db.query(t).with(relations);")).toEqual([".with()"]);
  });

  it("전역의 static으로 이미 판정된 멤버는 중복 보고하지 않는다", () => {
    expect(names("Object.hasOwn(o, 'k');")).toEqual(["Object.hasOwn"]);
  });

  it("허용목록 밖 소유 타입만 가진 이름은 위반이 아니다", () => {
    // createContext는 api.ML만, resolve는 api.FileSystemDirectoryHandle만 소유한다.
    expect(
      names("options.createContext(); Promise.resolve(v); p.resolve(v);"),
    ).toEqual([]);
  });
});

describe("옵션 서브피처를 특수 위반으로 판정한다", () => {
  it("new Error의 cause 옵션을 검출한다", () => {
    const violations = scanner.scan(
      "throw new Error(msg, { cause: err });",
      "dist/index.es.js",
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      name: "new Error({ cause })",
      chrome: 93,
      tier: 3,
    });
  });

  it("Error 하위 생성자의 cause 옵션도 검출한다", () => {
    const source = [
      "new TypeError(m, { cause: e });",
      "new RangeError(m, { cause: e });",
      "new AggregateError([], m, { cause: e });",
    ].join("\n");

    // Chrome 80에서는 AggregateError 생성자 자체의 Chrome 85 Tier 1 위반을
    // 먼저 보고하므로 cause 옵션의 Tier 3 위반은 억제된다.
    expect(names(source)).toEqual([
      "AggregateError",
      "new RangeError({ cause })",
      "new TypeError({ cause })",
    ]);
  });

  it("AggregateError의 cause 옵션은 생성자 지원 뒤부터 별도 위반으로 검출한다", () => {
    const source = "new AggregateError([], m, { cause: e });";

    expect(
      createScanner({ minChrome: 80 }).scan(source, "dist/index.es.js"),
    ).toEqual([
      expect.objectContaining({
        name: "AggregateError",
        chrome: 85,
        tier: 1,
      }),
    ]);

    for (const minChrome of [85, 92]) {
      expect(
        createScanner({ minChrome }).scan(source, "dist/index.es.js"),
      ).toEqual([
        expect.objectContaining({
          name: "new AggregateError({ cause })",
          chrome: 93,
          tier: 3,
        }),
      ]);
    }

    expect(
      createScanner({ minChrome: 93 }).scan(source, "dist/index.es.js"),
    ).toEqual([]);
  });

  it("cause 속성 대입은 위반이 아니다", () => {
    // src/core/errors.ts가 쓰는 형태다. Chrome 80에서 동작한다.
    const source = [
      "const error = new Error(message);",
      "error.cause = options?.cause;",
    ].join("\n");

    expect(names(source)).toEqual([]);
  });

  it("cause를 담은 객체 리터럴을 다른 함수에 넘기는 것은 위반이 아니다", () => {
    expect(
      names("createJapanAddressError(code, message, { cause: err });"),
    ).toEqual([]);
  });

  it("addEventListener의 signal 옵션을 검출한다", () => {
    const violations = scanner.scan(
      'target.addEventListener("abort", onAbort, { signal: controller.signal });',
      "dist/index.es.js",
    );

    expect(violations[0]).toMatchObject({
      name: "addEventListener({ signal })",
      chrome: 90,
      tier: 3,
    });
  });

  it("수신자 없는 addEventListener 호출도 검출한다", () => {
    // worker 전역처럼 수신자 없이 부르는 형태도 같은 서브피처다.
    expect(names('addEventListener("abort", onAbort, { signal });')).toEqual([
      "addEventListener({ signal })",
    ]);
  });

  it("signal 축약 표기도 검출한다", () => {
    expect(names('el.addEventListener("abort", onAbort, { signal });')).toEqual(
      ["addEventListener({ signal })"],
    );
  });

  it("세 번째 인자에 화살표 함수가 와도 검출한다", () => {
    expect(
      names(
        'el.addEventListener("abort", () => cleanup(), { signal: ctrl.signal });',
      ),
    ).toEqual(["addEventListener({ signal })"]);
  });

  it("signal이 아닌 옵션은 위반이 아니다", () => {
    expect(
      names('signal.addEventListener("abort", onAbort, { once: true });'),
    ).toEqual([]);
  });
});

describe("기존 게이트의 미탐 사례를 검출한다", () => {
  it("6건을 전부 검출한다", () => {
    const cases: Array<[string, string, number]> = [
      ["new Error(msg, { cause: err });", "new Error({ cause })", 93],
      [
        "const { promise } = Promise.withResolvers();",
        "Promise.withResolvers",
        119,
      ],
      ["const d = navigator.userAgentData;", "navigator.userAgentData", 90],
      ["const v = el.checkVisibility();", ".checkVisibility()", 105],
      [
        "const u = Intl.supportedValuesOf('currency');",
        "Intl.supportedValuesOf",
        99,
      ],
      ["const ok = str.isWellFormed();", ".isWellFormed()", 111],
    ];

    for (const [source, name, chrome] of cases) {
      const violations = scanner.scan(source, "dist/index.es.js");

      expect(violations, `미탐: ${source}`).toHaveLength(1);
      expect(violations[0]).toMatchObject({ name, chrome });
    }
  });
});

describe("기존 데니리스트의 판정 수준을 보존한다", () => {
  it("18/12/1로 갈린다", () => {
    // spec §8: 교체 전 regex 데니리스트 31개 전부가 여전히 잡혀야 하고,
    // 이 표가 그 31개 각각의 tier까지 고정한다. 개별 판정은 위 describe들에
    // 흩어져 있으므로, 여기서는 31개 전체와 18/12/1 분포를 한곳에 모은다.
    const cases: Array<[string, string, number]> = [
      ["structuredClone(v);", "structuredClone", 1],
      ["reportError(e);", "reportError", 1],
      ["x instanceof AggregateError;", "AggregateError", 1],
      ["new WeakRef(v);", "WeakRef", 1],
      ["new FinalizationRegistry(f);", "FinalizationRegistry", 1],
      ["Object.hasOwn(o, 'k');", "Object.hasOwn", 1],
      ["Object.groupBy(rows, keyOf);", "Object.groupBy", 1],
      ["Map.groupBy(a, f);", "Map.groupBy", 1],
      ["Promise.any([]);", "Promise.any", 1],
      ["Array.fromAsync(x);", "Array.fromAsync", 1],
      ["AbortSignal.abort();", "AbortSignal.abort", 1],
      ["AbortSignal.timeout(1);", "AbortSignal.timeout", 1],
      ["AbortSignal.any([]);", "AbortSignal.any", 1],
      ["signal.reason;", ".reason", 2],
      ["URL.canParse(u);", "URL.canParse", 1],
      ["Response.json(p);", "Response.json", 1],
      ["crypto.randomUUID();", "crypto.randomUUID", 1],
      ["new Intl.DisplayNames([], {});", "Intl.DisplayNames", 1],
      ["new Intl.Segmenter();", "Intl.Segmenter", 1],
      ["a.replaceAll(x, y);", ".replaceAll()", 2],
      ["items.at(-1);", ".at()", 2],
      ["b.findLast(f);", ".findLast()", 2],
      ["c.findLastIndex(f);", ".findLastIndex()", 2],
      ["d.toSorted();", ".toSorted()", 2],
      ["e.toReversed();", ".toReversed()", 2],
      ["g.toSpliced(0, 1);", ".toSpliced()", 2],
      ["h.with(0, v);", ".with()", 2],
      ["el.replaceChildren(n);", ".replaceChildren()", 2],
      ["s.throwIfAborted();", ".throwIfAborted()", 2],
      ["i.showPicker();", ".showPicker()", 2],
      [
        'target.addEventListener("abort", f, { signal: s });',
        "addEventListener({ signal })",
        3,
      ],
    ];

    expect(cases).toHaveLength(31);
    expect(cases.filter(([, , tier]) => tier === 1)).toHaveLength(18);
    expect(cases.filter(([, , tier]) => tier === 2)).toHaveLength(12);
    expect(cases.filter(([, , tier]) => tier === 3)).toHaveLength(1);

    for (const [source, name, tier] of cases) {
      const violations = scanner.scan(source, "dist/index.es.js");

      expect(violations, `놓침: ${source}`).toHaveLength(1);
      expect(violations[0]).toMatchObject({ name, tier });
    }
  });
});

describe("Chrome 80 지원 API를 허용한다", () => {
  it("위반으로 보고하지 않는다", () => {
    const source = [
      "const value = globalThis.fetch;",
      "const settled = Promise.allSettled([]);",
      "const matches = text.matchAll(pattern);",
      "const merged = rows.flatMap((row) => row);",
      "const trimmed = label.trimStart();",
      'signal.addEventListener("abort", onAbort, { once: true });',
      "const done = signal.aborted;",
      "const entries = Object.entries(o);",
      "const joined = parts.join('');",
    ].join("\n");

    expect(names(source)).toEqual([]);
  });
});

describe("위반 결과를 결정적인 순서로 정렬한다", () => {
  it("줄 번호 오름차순으로 돌려준다", () => {
    const source = [
      "const a = 1;",
      'const b = text.replaceAll("x", "y");',
      "const c = 2;",
      "const d = structuredClone(a);",
    ].join("\n");

    expect(
      scanner.scan(source, "dist/index.es.js").map((v) => [v.line, v.name]),
    ).toEqual([
      [2, ".replaceAll()"],
      [4, "structuredClone"],
    ]);
  });

  it("같은 줄이면 이름 사전순으로 정렬한다", () => {
    const source = "const x = a.at(0), y = structuredClone(b);\n";

    expect(
      scanner.scan(source, "dist/index.es.js").map((v) => [v.line, v.name]),
    ).toEqual([
      [1, ".at()"],
      [1, "structuredClone"],
    ]);
  });

  it("위반 줄의 원문을 담는다", () => {
    const source = "  const last = items.at(-1);\n";

    expect(scanner.scan(source, "dist/index.es.js")[0].text).toBe(
      "const last = items.at(-1);",
    );
  });
});

describe("근거가 있는 위반 예외만 허용한다", () => {
  it("지정한 파일에서만 건너뛴다", () => {
    const allowing = createScanner({
      minChrome: 80,
      allowed: [
        { file: "dist/index.es.js", name: ".at()", reason: "테스트용 예외" },
      ],
    });

    expect(
      allowing.scan("const last = items.at(-1);", "dist/index.es.js"),
    ).toEqual([]);
    expect(
      allowing
        .scan("const last = items.at(-1);", "dist/client.es.js")
        .map((v) => v.name),
    ).toEqual([".at()"]);
  });

  it('file이 "*"면 전체에 적용한다', () => {
    const allowing = createScanner({
      minChrome: 80,
      allowed: [{ file: "*", name: ".with()", reason: "쿼리 빌더 메서드다" }],
    });

    expect(
      allowing.scan("db.query(t).with(rel);", "dist/client.es.js"),
    ).toEqual([]);
  });

  it("reason이 없으면 던진다", () => {
    // 왜 안전한지를 남기지 않은 예외는 시간이 지나면 근거를 잃는다.
    expect(() =>
      createScanner({
        minChrome: 80,
        // @ts-expect-error reason은 필수다. 런타임 가드를 검증하려고 일부러 빠뜨린다.
        allowed: [{ file: "*", name: ".at()" }],
      }),
    ).toThrow(/reason/);
  });

  it("접두 전역 이름의 예외를 받아들인다", () => {
    const allowing = createScanner({
      minChrome: 80,
      allowed: [
        {
          file: "*",
          name: "globalThis.structuredClone",
          reason: "폴리필이 보장된 경로다",
        },
      ],
    });

    expect(
      allowing.scan("globalThis.structuredClone(v);", "dist/index.es.js"),
    ).toEqual([]);
  });

  it("반복 접두로 보고하는 이름을 같은 ALLOWED 키로 받는다", () => {
    const source = "globalThis.globalThis.Object.hasOwn(o, k);";
    const name = "globalThis.globalThis.Object.hasOwn";

    expect(scanner.scan(source, "dist/index.es.js")).toEqual([
      expect.objectContaining({ name }),
    ]);

    const allowing = createScanner({
      minChrome: 80,
      allowed: [{ file: "*", name, reason: "폴리필이 보장된 경로다" }],
    });

    expect(allowing.scan(source, "dist/index.es.js")).toEqual([]);
  });

  it("고정 전역 이름의 예외를 인터페이스 이름으로 해석한다", () => {
    // crypto.randomUUID는 색인에 Crypto.randomUUID로 들어 있다.
    // knownGlobalTypes를 거치지 않으면 정당한 예외가 부당하게 던져진다.
    expect(() =>
      createScanner({
        minChrome: 80,
        allowed: [
          { file: "*", name: "crypto.randomUUID", reason: "폴리필 적용됨" },
        ],
      }),
    ).not.toThrow();
  });

  it("Tier 1 형식이지만 색인에 없는 name이면 던진다", () => {
    expect(() =>
      createScanner({
        minChrome: 80,
        allowed: [{ file: "*", name: "Foo.bar", reason: "오타" }],
      }),
    ).toThrow(/색인에 없다/);
  });

  it("file이 없으면 던진다", () => {
    // file 없는 항목은 isAllowed에서 절대 매칭되지 않아 조용히 무의미해진다.
    expect(() =>
      createScanner({
        minChrome: 80,
        // @ts-expect-error file은 필수다. 런타임 가드를 검증하려고 일부러 빠뜨린다.
        allowed: [{ name: ".at()", reason: "테스트용" }],
      }),
    ).toThrow(/file/);
  });

  it("어느 색인에도 없는 name이면 던진다", () => {
    // 낡은 예외가 조용히 남는 것을 막는다.
    expect(() =>
      createScanner({
        minChrome: 80,
        allowed: [{ file: "*", name: ".neverExisted()", reason: "오타" }],
      }),
    ).toThrow(/색인에 없다/);
  });
});

describe("실제 빌드 산출물이 브라우저 계약을 지킨다", () => {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const packageDir = path.resolve(currentDir, "../../packages/japanpost-react");

  it("빌드 산출물에 위반이 없다", () => {
    // 두 파일이 다 없으면 아래 루프가 assertion을 한 번도 안 돈 채 통과해
    // 버린다. hasAssertions로 "검증 안 됨"과 "검증했고 깨끗함"을 구분한다.
    expect.hasAssertions();

    const fileNames = ["dist/index.es.js", "dist/client.es.js"];

    for (const fileName of fileNames) {
      let source: string;

      try {
        source = readFileSync(path.join(packageDir, fileName), "utf8");
      } catch (error) {
        // 산출물이 없으면 이 검증은 건너뛴다. 빌드가 게이트를 따로 돌린다.
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          continue;
        }

        throw error;
      }

      expect(
        scanner.scan(source, fileName),
        `${fileName}에 위반이 있다`,
      ).toEqual([]);
    }
  });
});
