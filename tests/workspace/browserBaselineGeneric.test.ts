import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { checkPackageBaseline, formatReport } from "@repo/browser-baseline";

/**
 * @repo/browser-baseline의 범용성 증명이다.
 *
 * Task 6의 clean·violations·missing-dist 픽스처는 이 module이 지금의 유일한
 * 소비자 패키지 하나만 다뤄도 동작한다는 것만 보인다. 소비자가 하나뿐인 상태에서
 * 경계가 진짜 범용인지 알 방법은 합성 픽스처뿐이다 — 그래서 이 파일은 그 소비자
 * 패키지의 package.json·dist·경로를 단 하나도 읽지 않는다. 모든 기대값은 이
 * 파일이 만든 합성 픽스처에서만 나온다.
 *
 * Chrome 버전 숫자는 이 파일에 리터럴로 등장하지 않는다. 계약(browserslist)과
 * BCD 파생값(API별 최소 지원 버전)은 픽스처의 package.json과 dist 소스 안에만
 * 있다 — 이 테스트는 finding의 이름·kind·tier로만 단언한다.
 */
const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures/browser-baseline",
);

describe("chrome90 픽스처: 하한이 80이 아니어도 색인과 문법 게이트가 함께 반응한다", () => {
  it("Object.hasOwn을 걸러내고 optional chaining 문법도 함께 위반으로 잡는다", async () => {
    const packageDir = path.join(fixturesDir, "chrome90");

    const result = await checkPackageBaseline({ packageDir });

    expect(result.ok).toBe(false);

    // 문법 게이트: esbuild가 optional chaining을 원형 유지하는 경계보다 낮은
    // 하한이므로 하향되고, 그 불일치가 kind:"syntax" finding으로 남는다.
    // 이 finding은 하한이 80이든 90이든 나온다(esbuild가 ?.를 91부터 원형
    // 유지) — 판별력은 없지만 kind:"syntax" 경로를 실행하는 유일한 자리다.
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        kind: "syntax",
        file: "bundle/index.mjs",
      }),
    );

    // 런타임 API 게이트: 이 하한에서는 아직 지원되지 않는 정적 멤버라 걸린다.
    // Object.hasOwn(93)은 하한 80·90 어느 쪽에서도 걸린다 — 판별력은 없다.
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        kind: "api",
        file: "bundle/index.mjs",
        name: "Object.hasOwn",
        tier: 1,
      }),
    );

    // 음성 대조군 1: queueMicrotask(≤80)는 하한 80·90 어느 쪽에서도 안 걸린다.
    // "전부 위반"으로 과보고하지 않는다는 증거이지만, 이것 역시 하한이 정말
    // 90인지 80인지는 구별하지 못한다.
    expect(
      result.findings.some(
        (finding) => "name" in finding && finding.name === "queueMicrotask",
      ),
    ).toBe(false);

    // 판별 단언: Promise.any는 BCD 실측 Chrome 85로, 81~90 구간에 엄격히
    // 들어간다(buildCompatIndex로 직접 조회해 확인했다 —
    // chrome90/bundle/index.mjs의 주석 참고).
    // 하한이 실제로 90이면 85<=90이라 findings에서 빠져야 한다.
    // 이 하한이 80으로 하드코딩된 구현이라면 85>80이라 위반으로 잡혀 이
    // 단언이 실패한다 — 그래서 이 표 행의 "하한이 80이 아니어도 색인이
    // 따라가는가"를 실제로 판별하는 단언은 이것뿐이다.
    expect(
      result.findings.some(
        (finding) => "name" in finding && finding.name === "Promise.any",
      ),
    ).toBe(false);
  });
});

describe("chrome111 픽스처: 하한을 올리면 통과선도 함께 올라간다", () => {
  it("이미 지원되는 structuredClone은 통과시키고 아직 못 미친 Array.fromAsync만 걸러낸다", async () => {
    const packageDir = path.join(fixturesDir, "chrome111");

    const result = await checkPackageBaseline({ packageDir });

    expect(result.ok).toBe(false);
    // toEqual(정확히 1건)로 단언해 structuredClone이 findings에 전혀 없음을
    // 함께 증명한다 — containToEqual만 쓰면 "안 걸림"은 증명하지 못한다.
    expect(result.findings).toEqual([
      expect.objectContaining({
        kind: "api",
        file: "bundle/index.mjs",
        name: "Array.fromAsync",
        tier: 1,
      }),
    ]);
  });
});

describe("multi-entry 픽스처: exports의 서브경로와 조건 map을 resolveDistEntries가 전부 잡는다", () => {
  it("서브경로 3개와 조건 map의 양쪽 갈래를 모두 검사 대상 파일로 파생한다", async () => {
    const packageDir = path.join(fixturesDir, "multi-entry");

    const result = await checkPackageBaseline({ packageDir });

    expect(result.files).toEqual([
      "bundle/feature-a.mjs",
      "bundle/feature-b.cjs",
      "bundle/feature-b.mjs",
      "bundle/index.mjs",
    ]);

    // 각 산출물에 서로 다른 위반을 심어 뒀다. 파일마다 자기 위반이 나와야
    // "목록에 있다"뿐 아니라 "실제로 읽혀서 스캔됐다"까지 증명된다.
    const findingFiles = new Set(
      result.findings.map((finding) => finding.file),
    );
    expect(findingFiles).toEqual(new Set(result.files));
  });
});

describe("cjs-and-asset 픽스처: resolveDistEntries가 JS 확장자만 골라낸다", () => {
  it("exports에 섞인 .css·.json은 검사 대상에서 빠지고 .mjs·.cjs만 남는다", async () => {
    const packageDir = path.join(fixturesDir, "cjs-and-asset");

    const result = await checkPackageBaseline({ packageDir });

    expect(result.files).toEqual(["bundle/index.cjs", "bundle/index.mjs"]);
    expect(
      result.files.some(
        (file) => file.endsWith(".css") || file.endsWith(".json"),
      ),
    ).toBe(false);

    // .css·.json이 잘못 스캔 대상에 들어왔다면 유효한 JS가 아니라 문법 게이트가
    // 실패하고, check.mjs가 그것을 kind:"error" finding으로 남긴다. 그런 finding이
    // 없다는 것도 "걸러졌다"의 증거다.
    expect(result.findings.some((finding) => finding.kind === "error")).toBe(
      false,
    );

    // files 목록에 있다는 것과 실제로 읽혀서 스캔됐다는 것은 다른 명제다.
    // index.cjs에 심어 둔 위반이 findings로 나와야 후자가 증명된다 —
    // 이 단언이 없으면 .cjs 스캔 증거는 multi-entry 픽스처에만 있다.
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        kind: "api",
        file: "bundle/index.cjs",
        name: "Object.hasOwn",
      }),
    );
  });
});

describe("with-allow 픽스처: package.json의 browserBaseline.allow가 실제로 위반을 지운다", () => {
  it("allow 없이는 위반이 남고, allow를 넘기면 findings가 비고 formatReport도 통과 문구를 낸다", async () => {
    const packageDir = path.join(fixturesDir, "with-allow");
    const manifest = JSON.parse(
      await readFile(path.join(packageDir, "package.json"), "utf8"),
    );

    // 대조군: allow 없이 돌리면 실제로 위반이 있다는 것부터 증명한다.
    // 그래야 뒤이은 "지워진다"가 "애초에 없었다"와 구별된다.
    const withoutAllow = await checkPackageBaseline({ packageDir });

    expect(withoutAllow.ok).toBe(false);
    expect(withoutAllow.findings).toContainEqual(
      expect.objectContaining({ kind: "api", name: "Object.hasOwn" }),
    );

    const withAllow = await checkPackageBaseline({
      packageDir,
      allow: manifest.browserBaseline.allow,
    });

    expect(withAllow.ok).toBe(true);
    expect(withAllow.findings).toEqual([]);

    // formatReport의 통과 출력 경로다. 지금까지 어떤 테스트도 ok:true인
    // 결과로 formatReport를 부른 적이 없었다.
    const lines = formatReport(withAllow);
    expect(lines.some((line) => line.includes("통과"))).toBe(true);
  });
});

describe("no-browserslist 픽스처: 계약의 정본이 없으면 조용히 통과하지 않고 던진다", () => {
  it("browserslist 필드가 없는 package.json은 checkPackageBaseline을 reject시킨다", async () => {
    const packageDir = path.join(fixturesDir, "no-browserslist");

    await expect(checkPackageBaseline({ packageDir })).rejects.toThrow(
      /browserslist/,
    );
  });
});

describe("empty-exports 픽스처: 검사 대상이 비면 조용히 통과하지 않고 던진다", () => {
  it("exports에 JavaScript 산출물이 없는 package.json은 checkPackageBaseline을 reject시킨다", async () => {
    const packageDir = path.join(fixturesDir, "empty-exports");

    await expect(checkPackageBaseline({ packageDir })).rejects.toThrow(
      /JavaScript 산출물/,
    );
  });
});
