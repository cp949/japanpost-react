import { createOriginLookup } from "@repo/browser-baseline";
import { describe, expect, it } from "vitest";

/**
 * VLQ 세그먼트를 손으로 만들 때 쓰는 한 글자 값이다.
 *
 * 소스맵 v3의 base64 VLQ는 |value| <= 15인 값을 문자 하나로 인코딩한다.
 * 여기 쓰는 값들은 decodeVlqFields 구현과 무관하게 VLQ 명세에서 직접 유도했다 —
 * 우리 module의 인코더가 없으므로(디코더만 있다) 인코더·디코더가 같은 버그를
 * 공유해 테스트가 거짓으로 통과할 위험이 없다.
 *
 * 유도: digit(0~31) = base64 문자 색인. continuation 비트(0x20) 없이 한 글자면
 * value = digit, 부호 = value&1, 크기 = value>>1.
 *   A(0)->0  C(2)->1  D(3)->-1  E(4)->2
 */
const ZERO = "A"; // 델타 0. 생성컬럼·원본줄·원본컬럼 자리채움으로 쓴다.
const PLUS_ONE = "C"; // 델타 +1
const MINUS_ONE = "D"; // 델타 -1
const PLUS_TWO = "E"; // 델타 +2

describe("createOriginLookup", () => {
  it("단일 소스 맵에서 줄 번호로 원본 파일을 찾는다", () => {
    // 가장 단순한 성공 경로다. 세그먼트 디코딩과 경로 합성이 기본적으로 동작하는지만 본다.
    const map = JSON.stringify({
      version: 3,
      mappings: `${ZERO}${ZERO}${ZERO}${ZERO}`,
      sources: ["src/a.ts"],
    });

    const lookup = createOriginLookup(map, { mapDir: "dist" });

    expect(lookup.originOf(1)).toBe("dist/src/a.ts");
  });

  it("sources 인덱스는 줄이 바뀌어도 초기화되지 않는 누적 델타다", () => {
    // sources: a(0), b(1), c(2).
    // 1번째 줄: 델타 +2 -> 누적 2 -> c.ts
    // 2번째 줄: 델타 -1 -> 누적 1 -> b.ts (0이 아니다!)
    //
    // sources 인덱스를 줄마다 0으로 초기화하는 잘못된 구현이면 2번째 줄은
    // "0 + (-1) = -1"을 계산한다. sources[-1]은 범위 밖이므로(길이 3인데 인덱스 -1)
    // createOriginLookup이 그 자리에서 던진다 — null로 흡수해 1번째 줄 값(c.ts)이
    // 새어나오던 이전 동작과 달리, 이제는 잘못된 구현이 예외로 드러난다.
    const map = JSON.stringify({
      version: 3,
      mappings: `${ZERO}${PLUS_TWO}${ZERO}${ZERO};${ZERO}${MINUS_ONE}${ZERO}${ZERO}`,
      sources: ["src/a.ts", "src/b.ts", "src/c.ts"],
    });

    const lookup = createOriginLookup(map, { mapDir: "dist" });

    expect(lookup.originOf(1)).toBe("dist/src/c.ts");
    expect(lookup.originOf(2)).toBe("dist/src/b.ts");
  });

  it("한 줄 안에서 원본 세그먼트를 찾은 뒤에도 나머지 세그먼트의 델타를 계속 반영한다", () => {
    // sources: a(0), b(1), c(2).
    // 1번째 줄에 세그먼트 2개: 앞은 그 줄의 파일(a.ts)을 정하고,
    // 뒤는 그 줄의 파일 판정에는 안 쓰이지만 sources 인덱스를 +2 만큼 더 옮긴다.
    // 2번째 줄은 델타 0 -> 그 누적(2)을 그대로 쓰면 c.ts다.
    //
    // "첫 원본 세그먼트를 찾으면 그 줄의 이후 세그먼트는 sources 인덱스 갱신을
    // 건너뛴다"는 잘못된 구현이면 1번째 줄 처리 후 누적이 0에 머무르고,
    // 2번째 줄은 "0 + 0 = 0"을 계산해 a.ts를 내놓는다.
    // 즉 이 구현에서는 originOf(2)가 "dist/src/a.ts"로 틀리게 나온다.
    // (브리프 동작 규약 2: "필드 2만 필요해도 전 세그먼트를 순서대로 풀어야 한다.")
    const map = JSON.stringify({
      version: 3,
      mappings: `${ZERO}${ZERO}${ZERO}${ZERO},${ZERO}${PLUS_TWO}${ZERO}${ZERO};${ZERO}${ZERO}${ZERO}${ZERO}`,
      sources: ["src/a.ts", "src/b.ts", "src/c.ts"],
    });

    const lookup = createOriginLookup(map, { mapDir: "dist" });

    expect(lookup.originOf(1)).toBe("dist/src/a.ts");
    expect(lookup.originOf(2)).toBe("dist/src/c.ts");
  });

  it("세그먼트가 없는 줄은 위쪽으로 후퇴해 앞선 줄의 값을 쓴다", () => {
    // mappings를 ";"로 나눈 가운데 토큰이 빈 문자열이면 그 생성 줄에는
    // 세그먼트가 아예 없다는 뜻이다(예: 빈 줄, 압축기가 건너뛴 줄).
    // 후퇴하지 않고 그 줄을 null로 처리하는 구현이면 originOf(2)가 null이 된다.
    const map = JSON.stringify({
      version: 3,
      mappings: `${ZERO}${ZERO}${ZERO}${ZERO};;${ZERO}${PLUS_ONE}${ZERO}${ZERO}`,
      sources: ["src/a.ts", "src/b.ts"],
    });

    const lookup = createOriginLookup(map, { mapDir: "dist" });

    expect(lookup.originOf(1)).toBe("dist/src/a.ts");
    expect(lookup.originOf(2)).toBe("dist/src/a.ts"); // 후퇴
    expect(lookup.originOf(3)).toBe("dist/src/b.ts");
  });

  it("첫 세그먼트보다 앞선 줄은 null이다", () => {
    // 후퇴할 앞선 값 자체가 없는 경계다. 후퇴 루프가 하한(1) 없이 계속 내려가면
    // 무한루프이거나 잘못된 값을 집어낼 수 있으므로 null 종료를 명시적으로 검증한다.
    const map = JSON.stringify({
      version: 3,
      mappings: `;${ZERO}${ZERO}${ZERO}${ZERO}`,
      sources: ["src/a.ts"],
    });

    const lookup = createOriginLookup(map, { mapDir: "dist" });

    expect(lookup.originOf(1)).toBeNull();
    expect(lookup.originOf(2)).toBe("dist/src/a.ts");
  });

  it("mapDir과 sources 항목을 합성해 패키지 기준 경로를 만든다", () => {
    // sources 항목은 맵 파일 위치 기준 상대경로다. mapDir을 그냥 접두어로 붙이면
    // "dist/../src/a.ts"처럼 정규화 안 된 경로가 나와 finding.file과 기준점이
    // 어긋난다. posix.normalize(posix.join(...))로 "src/a.ts"까지 정리돼야 한다.
    const map = JSON.stringify({
      version: 3,
      mappings: `${ZERO}${ZERO}${ZERO}${ZERO}`,
      sources: ["../src/a.ts"],
    });

    const lookup = createOriginLookup(map, { mapDir: "dist" });

    expect(lookup.originOf(1)).toBe("src/a.ts");
  });

  it("sourceRoot가 있으면 sources 항목 앞에 붙는다", () => {
    // sourceRoot를 무시하는 구현이면 "dist/a.ts"가 나온다.
    const map = JSON.stringify({
      version: 3,
      sourceRoot: "../src",
      mappings: `${ZERO}${ZERO}${ZERO}${ZERO}`,
      sources: ["a.ts"],
    });

    const lookup = createOriginLookup(map, { mapDir: "dist" });

    expect(lookup.originOf(1)).toBe("src/a.ts");
  });

  it("절대경로나 URL 형태의 source는 합성하지 않고 그대로 돌려준다", () => {
    // "/"로 시작하거나 "://"를 포함하면 이미 패키지 기준이 아닌 별도 좌표계다.
    // mapDir을 앞에 붙이면 존재하지 않는 경로("dist//abs/a.ts" 등)가 만들어진다.
    const map = JSON.stringify({
      version: 3,
      mappings: `${ZERO}${ZERO}${ZERO}${ZERO}`,
      sources: ["/abs/a.ts"],
    });

    const lookup = createOriginLookup(map, { mapDir: "dist" });

    expect(lookup.originOf(1)).toBe("/abs/a.ts");
  });

  it("음수 VLQ(뒤로 가는 델타)를 여러 바이트에 걸쳐 정확히 푼다", () => {
    // 앞의 테스트들은 |델타| <= 2인 한 글자 VLQ만 썼다. continuation 비트로
    // 여러 문자에 걸쳐 이어지는 큰 델타(양수 +20, 음수 -16)는 별도로 검증해야
    // shift 누적이나 부호 복원이 한 글자 케이스에서만 우연히 맞는 구현을 걸러낸다.
    // "oB" = +20, "hB" = -16 (VLQ 명세로 직접 유도, 이 module의 인코더 없이 계산).
    const sources = Array.from(
      { length: 21 },
      (_, index) => `src/f${index}.ts`,
    );
    const map = JSON.stringify({
      version: 3,
      // 1번째 줄: 0 + 20 = 20 -> f20.ts
      // 2번째 줄: 20 + (-16) = 4 -> f4.ts
      mappings: `${ZERO}oB${ZERO}${ZERO};${ZERO}hB${ZERO}${ZERO}`,
      sources,
    });

    const lookup = createOriginLookup(map, { mapDir: "dist" });

    expect(lookup.originOf(1)).toBe("dist/src/f20.ts");
    expect(lookup.originOf(2)).toBe("dist/src/f4.ts");
  });

  it("version이 3이 아니면 던진다", () => {
    // 계약 위반을 폴백 없이 던지는지 본다 — 조용히 무시하면 오래된 맵 포맷을
    // 잘못 해석해 엉뚱한 원본 파일을 지목할 수 있다.
    const map = JSON.stringify({ version: 2, mappings: "", sources: [] });

    expect(() => createOriginLookup(map, { mapDir: "dist" })).toThrow(
      /version.*3/,
    );
  });

  it("mappings가 문자열이 아니면 던진다", () => {
    const map = JSON.stringify({ version: 3, mappings: null, sources: [] });

    expect(() => createOriginLookup(map, { mapDir: "dist" })).toThrow(
      /mappings/,
    );
  });

  it("sources가 배열이 아니면 던진다", () => {
    const map = JSON.stringify({ version: 3, mappings: "", sources: {} });

    expect(() => createOriginLookup(map, { mapDir: "dist" })).toThrow(
      /sources/,
    );
  });

  it.each([
    { name: "2필드", mappings: `${ZERO}${ZERO}`, fieldCount: 2 },
    { name: "3필드", mappings: `${ZERO}${ZERO}${ZERO}`, fieldCount: 3 },
    {
      name: "6필드",
      mappings: `${ZERO}${ZERO}${ZERO}${ZERO}${ZERO}${ZERO}`,
      fieldCount: 6,
    },
  ])(
    "$name 세그먼트는 잘못된 필드 수를 드러내며 던진다",
    ({ mappings, fieldCount }) => {
      // 원본 없는 세그먼트는 1필드, 원본 있는 세그먼트는 4/5필드만 유효하다.
      // 다른 길이를 원본 세그먼트로 읽으면 누락/과잉 필드를 정상 델타로 오인한다.
      const map = JSON.stringify({
        version: 3,
        mappings,
        sources: ["src/a.ts"],
      });

      expect(() => createOriginLookup(map, { mapDir: "dist" })).toThrow(
        new RegExp(`필드 수.*${fieldCount}개`),
      );
    },
  );

  it("continuation 비트가 열린 채 끝난 VLQ는 미종결 오류를 던진다", () => {
    // "g"는 continuation 비트만 켜진 Base64 값이다. 다음 문자가 없으므로
    // 빈 필드처럼 흡수하지 말고 잘린 VLQ 자체를 계약 위반으로 판별해야 한다.
    const map = JSON.stringify({
      version: 3,
      mappings: "g",
      sources: ["src/a.ts"],
    });

    expect(() => createOriginLookup(map, { mapDir: "dist" })).toThrow(
      /미종결.*VLQ/,
    );
  });

  it("sources 인덱스가 범위를 벗어나면 파싱 시점(createOriginLookup 호출)에 던진다", () => {
    // sources 길이는 1(인덱스 0만 유효)인데 델타 +1로 인덱스 1을 가리키게 만든다.
    // null로 흡수하는 구현이면 이 호출 자체는 던지지 않는다(originOf를 호출한
    // 적조차 없다) — 그래서 이 단언은 "던지는 시점이 originOf가 아니라
    // createOriginLookup이어야 한다"는 요구를 그대로 검증한다.
    const map = JSON.stringify({
      version: 3,
      mappings: `${ZERO}${PLUS_ONE}${ZERO}${ZERO}`,
      sources: ["src/a.ts"],
    });

    expect(() => createOriginLookup(map, { mapDir: "dist" })).toThrow(
      /범위를 벗어난다/,
    );
  });

  it("JSON이 깨졌으면 던진다", () => {
    // JSON.parse 실패를 그냥 흘려보내면 네이티브 SyntaxError가 그대로 새어나가
    // "무엇이 계약을 어겼는지"를 한국어로 말하라는 규약을 못 지킨다.
    expect(() =>
      createOriginLookup("{not valid json", { mapDir: "dist" }),
    ).toThrow(/파싱/);
  });

  it("continuation이 7개 이상 이어지는 VLQ 델타는 32비트 랩어라운드 없이 정확히 계산된다", () => {
    // "g"는 continuation 비트만 켜진 값(데이터 0)이다. 7개를 이어붙이고 마지막에
    // "C"(값 2, continuation 없음)를 붙이면, 이 필드의 수학적으로 정확한 값은
    // 2 * 2^35 = 68719476736이고 부호 복원 후 델타는 +34359738368이다 — 이 값은
    // 인코더 없이 VLQ 명세(digit=2, shift=35)에서 직접 유도했다.
    //
    // shift 누적에 JS의 `<<`(32비트 연산)를 쓰는 구현은 시프트양을 32로 나눈
    // 나머지(35 % 32 = 3)만큼만 옮긴다 — 2 << 3 = 16으로 랩어라운드돼 부호/크기
    // 복원 후 델타가 +8이 된다. sources 길이가 마침 9 이상이면 "src/f8.ts"라는
    // 그럴듯하지만 완전히 무관한 원본을 조용히 반환하는 확정적 오답이 나온다.
    // 정확한 구현은 거대한 델타를 그대로 인식해 범위 초과로 던져야 한다.
    const map = JSON.stringify({
      version: 3,
      mappings: `${ZERO}gggggggC${ZERO}${ZERO}`,
      sources: Array.from({ length: 20 }, (_, index) => `src/f${index}.ts`),
    });

    expect(() => createOriginLookup(map, { mapDir: "dist" })).toThrow(
      /범위를 벗어난다/,
    );
  });

  it("sources 배열에 문자열이 아닌 항목이 있으면 계약 위반으로 던진다", () => {
    // 손상되거나 비표준인 생성기가 원본을 모르는 항목에 null을 넣을 수 있다.
    // resolveSourcePath는 source.startsWith를 그대로 호출하므로, 검증 없이
    // 들어오면 이 module의 다른 모든 계약 위반과 달리 한국어 메시지가 아닌
    // 원시 TypeError("Cannot read properties of null")가 새어나간다.
    const map = JSON.stringify({
      version: 3,
      mappings: `${ZERO}${ZERO}${ZERO}${ZERO}`,
      sources: [null],
    });

    expect(() => createOriginLookup(map, { mapDir: "dist" })).toThrow(
      /sources.*문자열/,
    );
  });
});
