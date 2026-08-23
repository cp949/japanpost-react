import { describe, expect, it } from "vitest";

import {
  buildCompatIndex,
  normalizeChromeSupport,
} from "@repo/browser-baseline";

describe("Chrome 지원 버전을 판정 값으로 정규화한다", () => {
  it("숫자 문자열을 숫자로 바꾼다", () => {
    expect(normalizeChromeSupport({ version_added: "93" })).toBe(93);
  });

  it("소수점 버전은 정수 부분을 쓴다", () => {
    expect(normalizeChromeSupport({ version_added: "103.1" })).toBe(103);
  });

  it("false는 Chrome 미지원이므로 Infinity다", () => {
    expect(normalizeChromeSupport({ version_added: false })).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it("preview는 지원이 아니므로 Infinity다", () => {
    expect(normalizeChromeSupport({ version_added: "preview" })).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it("≤N 형태는 경계값 N을 도입 버전으로 본다", () => {
    // "이 버전 이하에서 도입, 정확한 시점 미상"이다.
    // 경계값을 쓰면 실제 도입이 더 일러도 과보고 쪽이라 계약을 깨지 않는다.
    expect(normalizeChromeSupport({ version_added: "≤80" })).toBe(80);
    expect(normalizeChromeSupport({ version_added: "<=31" })).toBe(31);
  });

  it("true는 버전 미상이나 지원이므로 0이다", () => {
    expect(normalizeChromeSupport({ version_added: true })).toBe(0);
  });

  it("null은 지원 여부 미상이므로 판정하지 않는다", () => {
    expect(normalizeChromeSupport({ version_added: null })).toBeNull();
  });

  it("support 자체가 없으면 판정하지 않는다", () => {
    expect(normalizeChromeSupport(undefined)).toBeNull();
  });

  it("flags가 붙은 지원은 기본 지원이 아니므로 Infinity다", () => {
    expect(
      normalizeChromeSupport({
        version_added: "85",
        flags: [{ type: "preference" }],
      }),
    ).toBe(Number.POSITIVE_INFINITY);
  });

  it("prefix가 붙은 지원은 표준 표면이 아니므로 Infinity다", () => {
    expect(
      normalizeChromeSupport({ version_added: "85", prefix: "webkit" }),
    ).toBe(Number.POSITIVE_INFINITY);
  });

  it("alternative_name이 붙은 지원은 다른 이름이므로 Infinity다", () => {
    expect(
      normalizeChromeSupport({
        version_added: "85",
        alternative_name: "mozFoo",
      }),
    ).toBe(Number.POSITIVE_INFINITY);
  });

  it("partial_implementation은 지원으로 센다", () => {
    // 부분 구현까지 위반으로 올리면 과보고가 된다.
    expect(
      normalizeChromeSupport({
        version_added: "103",
        partial_implementation: true,
      }),
    ).toBe(103);
  });

  it("배열에서 한정자 붙은 원소를 걷어낸다", () => {
    const support = [
      { version_added: "103", partial_implementation: true },
      { version_added: "94", prefix: "webkit" },
    ];

    expect(normalizeChromeSupport(support)).toBe(103);
  });

  it("구간이 이어지면 가장 이른 시작점을 취한다", () => {
    // 실제 api.AbortSignal.timeout_static의 형태다.
    // 103~123이 partial, 124부터 완전 구현이며 그 사이에 끊김이 없다.
    // 첫 원소만 보면 124가 나오지만 이 API는 103부터 계속 존재했다.
    const support = [
      { version_added: "124" },
      {
        partial_implementation: true,
        version_added: "103",
        version_last: "123",
        version_removed: "124",
      },
    ];

    expect(normalizeChromeSupport(support)).toBe(103);
  });

  it("구간이 끊겼으면 현재 구간의 시작점만 취한다", () => {
    // 도입 32 → 제거 60 → 재도입 73. Chrome 65에는 없었다.
    // 최솟값을 답하면 이미 사라졌던 버전을 지원으로 세어 미탐이 된다.
    const support = [
      { version_added: "73" },
      { version_added: "32", version_last: "59", version_removed: "60" },
    ];

    expect(normalizeChromeSupport(support)).toBe(73);
  });

  it("plain support의 현재 기록이 제거됐으면 Infinity다", () => {
    expect(
      normalizeChromeSupport({
        version_added: "22",
        version_removed: "69",
      }),
    ).toBe(Number.POSITIVE_INFINITY);
  });

  it("배열의 최신 유효 표준 기록이 제거됐으면 Infinity다", () => {
    const support = [
      { version_added: "22", version_removed: "69" },
      { version_added: "4", version_removed: "22" },
    ];

    expect(normalizeChromeSupport(support)).toBe(Number.POSITIVE_INFINITY);
  });

  it("version_removed가 false면 현재 지원 기록으로 본다", () => {
    expect(
      normalizeChromeSupport({ version_added: "22", version_removed: false }),
    ).toBe(22);
    expect(
      normalizeChromeSupport([{ version_added: "22", version_removed: false }]),
    ).toBe(22);
  });

  it("세 구간이 모두 이어지면 가장 오래된 시작점까지 내려간다", () => {
    const support = [
      { version_added: "110" },
      { version_added: "100", version_removed: "110" },
      { version_added: "90", version_removed: "100" },
    ];

    expect(normalizeChromeSupport(support)).toBe(90);
  });

  it("중간 원소에 version_removed가 없으면 그 지점에서 멈춘다", () => {
    // 100에는 version_removed가 없다 — 110과 실제로 이어진다는 증거가 없다.
    // 증거 없이 더 파고들어 90까지 내려가면 이미 사라졌던 버전을 지원으로
    // 세어 미탐이 될 수 있다. 보수적으로 110에서 멈춘다.
    const support = [
      { version_added: "110" },
      { version_added: "100" },
      { version_added: "90", version_removed: "100" },
    ];

    expect(normalizeChromeSupport(support)).toBe(110);
  });

  it("첫 원소에 한정자가 있으면 걷어내고 남은 것으로 판정한다", () => {
    const support = [
      { version_added: "94", flags: [{ type: "preference" }] },
      { version_added: "103" },
    ];

    expect(normalizeChromeSupport(support)).toBe(103);
  });

  it("배열 전체가 한정자뿐이면 Infinity다", () => {
    const support = [
      { version_added: "94", prefix: "webkit" },
      { version_added: "90", flags: [{ type: "preference" }] },
    ];

    expect(normalizeChromeSupport(support)).toBe(Number.POSITIVE_INFINITY);
  });

  it("한정자 붙은 원소와 판정 불가 원소가 섞이면 판정하지 않는다", () => {
    // 첫 원소는 flags로 걸러지고 남는 건 version_added가 null인 원소뿐이다.
    // 원소 하나가 한정자로 걸러졌다고 남은 원소까지 임의로 판정하면 안 된다 —
    // entries.length가 0이 아니므로(위 테스트의 Infinity 분기가 아니므로)
    // null로 떨어지는 경로가 별도로 있다.
    const support = [
      { version_added: "94", flags: [{ type: "preference" }] },
      { version_added: null },
    ];

    expect(normalizeChromeSupport(support)).toBeNull();
  });

  it("빈 배열은 판정하지 않는다", () => {
    expect(normalizeChromeSupport([])).toBeNull();
  });
});

/** 계약의 현재 하한이다. 정본에서 파생되는지는 browserBaseline.test.ts가 검증한다. */
const index = buildCompatIndex({ minChrome: 80 });

describe("브라우저 하한에 맞는 호환성 색인을 생성한다", () => {
  it("minChrome이 정수가 아니면 던진다", () => {
    // @ts-expect-error minChrome은 number다. 런타임 가드를 검증하려고 일부러 위반한다.
    expect(() => buildCompatIndex({ minChrome: "80" })).toThrow(
      /정수여야 한다/,
    );
  });

  it("색인이 비면 던진다", () => {
    // 검사 대상 0은 통과가 아니라 파생 실패다.
    // 도달 가능한 하한 중 가장 높은 값을 줘도 색인이 비지 않아야 한다.
    expect(() => buildCompatIndex({ minChrome: 100000 })).toThrow(
      /색인이 비었다/,
    );
  });
});

describe("전역 API 색인을 BCD에서 파생한다", () => {
  it("api/_globals에서 전역 함수를 파생한다", () => {
    // 전역 함수는 javascript.builtins가 아니라 api.*에 있다.
    expect(index.globals.get("structuredClone")).toMatchObject({
      chrome: 98,
      path: "api.structuredClone",
    });
    expect(index.globals.get("reportError")).toMatchObject({
      chrome: 95,
      path: "api.reportError",
    });
  });

  it("javascript.builtins 최상위 생성자를 전역으로 넣는다", () => {
    expect(index.globals.get("AggregateError")).toMatchObject({ chrome: 85 });
    expect(index.globals.get("WeakRef")).toMatchObject({ chrome: 84 });
    expect(index.globals.get("FinalizationRegistry")).toMatchObject({
      chrome: 84,
    });
  });

  it("하한 이하에서 지원되는 전역은 색인에 없다", () => {
    // Promise는 Chrome 32다. 하한 80에서는 검사 대상이 아니다.
    expect(index.globals.has("Promise")).toBe(false);
    expect(index.globals.has("Map")).toBe(false);
  });
});

describe("static 멤버 색인을 BCD에서 파생한다", () => {
  it("javascript.builtins의 static 멤버를 넣는다", () => {
    expect(index.statics.get("Object.hasOwn")).toMatchObject({
      chrome: 93,
      path: "javascript.builtins.Object.hasOwn",
    });
    expect(index.statics.get("Promise.any")).toMatchObject({ chrome: 85 });
    expect(index.statics.get("Array.fromAsync")).toMatchObject({ chrome: 121 });
    expect(index.statics.get("Promise.withResolvers")).toMatchObject({
      chrome: 119,
    });
    expect(index.statics.get("Intl.supportedValuesOf")).toMatchObject({
      chrome: 99,
    });
  });

  it("api.*의 _static 접미사를 벗겨 넣는다", () => {
    expect(index.statics.get("URL.canParse")).toMatchObject({
      chrome: 120,
      path: "api.URL.canParse_static",
    });
    expect(index.statics.get("Response.json")).toMatchObject({ chrome: 105 });
    expect(index.statics.get("AbortSignal.abort")).toMatchObject({
      chrome: 93,
    });
    expect(index.statics.get("AbortSignal.timeout")).toMatchObject({
      chrome: 103,
    });
    expect(index.statics.get("AbortSignal.any")).toMatchObject({ chrome: 116 });
  });

  it("Intl 네임스페이스 멤버를 static으로 넣는다", () => {
    expect(index.statics.get("Intl.DisplayNames")).toMatchObject({
      chrome: 81,
    });
    expect(index.statics.get("Intl.Segmenter")).toMatchObject({ chrome: 87 });
  });

  it("instance 멤버는 statics에 넣지 않는다", () => {
    // Array.prototype.at은 instance다. spec_url이 .prototype.을 포함한다.
    expect(index.statics.has("Array.at")).toBe(false);
    expect(index.statics.has("String.replaceAll")).toBe(false);
  });
});

describe("인스턴스 멤버 색인을 제한된 소유 타입에서 파생한다", () => {
  it("수신자 미상 프로토타입 메서드를 넣는다", () => {
    expect(index.members.get("at")).toMatchObject({ chrome: 92 });
    expect(index.members.get("replaceAll")).toMatchObject({ chrome: 85 });
    expect(index.members.get("findLast")).toMatchObject({ chrome: 97 });
    expect(index.members.get("toSorted")).toMatchObject({ chrome: 110 });
    expect(index.members.get("with")).toMatchObject({ chrome: 110 });
    expect(index.members.get("isWellFormed")).toMatchObject({ chrome: 111 });
  });

  it("api.* 인스턴스 멤버를 넣는다", () => {
    expect(index.members.get("replaceChildren")).toMatchObject({ chrome: 86 });
    expect(index.members.get("throwIfAborted")).toMatchObject({ chrome: 100 });
    expect(index.members.get("showPicker")).toMatchObject({ chrome: 99 });
    expect(index.members.get("checkVisibility")).toMatchObject({ chrome: 105 });
  });

  it("소유 타입 허용목록이 최소 버전 계산을 좁힌다", () => {
    // reason은 CloseEvent(15)·PromiseRejectionEvent(49)가 소유자에 섞이면
    // 최소값이 15로 떨어져 색인에서 빠진다. 허용목록이 AbortSignal(98)만 남긴다.
    expect(index.members.get("reason")).toMatchObject({ chrome: 98 });
    expect(index.members.get("reason")?.owners).toContain("api.AbortSignal");
  });

  it("허용목록 밖 소유 타입만 가진 이름은 색인에 없다", () => {
    // createContext는 api.ML(WebNN)만, resolve는 api.FileSystemDirectoryHandle만 소유한다.
    // 둘 다 허용목록 밖이라 색인에서 빠진다 — 실제 dist의 오탐 2건이 이것이다.
    expect(index.members.has("createContext")).toBe(false);
    expect(index.members.has("resolve")).toBe(false);
  });

  it("하한 이하에서 지원되는 멤버는 색인에 없다", () => {
    expect(index.members.has("flatMap")).toBe(false);
    expect(index.members.has("trimStart")).toBe(false);
    expect(index.members.has("matchAll")).toBe(false);
  });

  it("static 멤버는 members에 넣지 않는다", () => {
    expect(index.members.has("hasOwn")).toBe(false);
    expect(index.members.has("fromAsync")).toBe(false);
  });
});

describe("옵션 서브피처 색인을 고정 경로에서 파생한다", () => {
  it("옵션 서브피처 두 개를 고정 키로 넣는다", () => {
    expect(index.special.get("Error.cause")).toMatchObject({
      chrome: 93,
      path: "javascript.builtins.Error.Error.options_cause_parameter",
    });
    expect(index.special.get("addEventListener.signal")).toMatchObject({
      chrome: 90,
      path: "api.EventTarget.addEventListener.options_parameter.options_signal_parameter",
    });
  });

  it("special은 하한과 무관하게 항상 해석된다", () => {
    // 하한을 올려 위반이 아니게 되더라도 키 자체는 해석돼야 한다.
    // 해석 실패는 매핑이 낡았다는 뜻이므로 조용히 통과시키면 안 된다.
    const high = buildCompatIndex({ minChrome: 130 });

    expect(high.special.get("Error.cause")).toMatchObject({ chrome: 93 });
  });
});

describe("타입이 고정된 전역을 인터페이스에 연결한다", () => {
  it("타입이 고정된 전역을 인터페이스로 잇는다", () => {
    expect(index.knownGlobalTypes.get("crypto")).toBe("Crypto");
    expect(index.knownGlobalTypes.get("navigator")).toBe("Navigator");
    expect(index.knownGlobalTypes.get("document")).toBe("Document");
  });

  it("고정 전역의 인스턴스 멤버가 statics로 조회된다", () => {
    // crypto.randomUUID와 navigator.userAgentData는 수신자가 변수가 아니라
    // 타입이 고정된 전역이므로 Tier 1으로 확정 판정한다.
    expect(index.statics.get("Crypto.randomUUID")).toMatchObject({
      chrome: 92,
    });
    expect(index.statics.get("Navigator.userAgentData")).toMatchObject({
      chrome: 90,
    });
  });

  it("현재 Chrome에서 제거된 고정 전역 멤버를 미지원으로 넣는다", () => {
    expect(index.statics.get("Document.createTouchList")).toMatchObject({
      chrome: Number.POSITIVE_INFINITY,
      path: "api.Document.createTouchList",
    });
  });
});

describe("브라우저 하한 상향에 맞춰 호환성 색인을 줄인다", () => {
  it("하한을 올리면 색인이 줄어든다", () => {
    const raised = buildCompatIndex({ minChrome: 120 });

    expect(raised.members.size).toBeLessThan(index.members.size);
    expect(raised.globals.size).toBeLessThan(index.globals.size);
    expect(raised.members.has("at")).toBe(false);
    expect(raised.globals.has("structuredClone")).toBe(false);
  });

  it("members 색인이 측정된 크기와 맞는다", () => {
    // spec §3.1의 R2 측정값은 201이다. BCD 8.0.12 + 연속 구간 규칙 +
    // Chrome 미출시 소유 타입 제외에서 재현된다.
    // 이 수가 크게 흔들리면 파생 규칙이 바뀐 것이다.
    expect(index.members.size).toBeGreaterThan(180);
    expect(index.members.size).toBeLessThan(230);
  });

  it("members의 chrome 값은 전부 유한하다", () => {
    // Chrome 미출시 소유 타입은 후보에서 빠지므로 Infinity가 남을 수 없다.
    for (const [name, entry] of index.members) {
      expect(Number.isFinite(entry.chrome), name).toBe(true);
    }
  });
});
