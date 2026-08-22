import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { checkPackageBaseline, formatReport } from "@repo/browser-baseline";
import type { ApiFinding, Finding } from "@repo/browser-baseline";

/** api finding만 골라내는 타입 가드다. origin·originNote는 api finding에만 있다. */
function isApiFinding(finding: Finding): finding is ApiFinding {
  return finding.kind === "api";
}

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures/browser-baseline",
);

describe("checkPackageBaseline", () => {
  it("fixture 디렉터리의 exports에서 files를 파생하고 위반을 findings로 모은다", async () => {
    const packageDir = path.join(fixturesDir, "violations");

    const result = await checkPackageBaseline({ packageDir });

    expect(result.files).toEqual(["bundle/index.mjs"]);
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        kind: "api",
        file: "bundle/index.mjs",
        name: ".at()",
        tier: 2,
      }),
    );
  });

  it("dist 파일이 없으면 kind:error finding을 남기고 ok는 false다", async () => {
    const packageDir = path.join(fixturesDir, "missing-dist");

    const result = await checkPackageBaseline({ packageDir });

    expect(result.ok).toBe(false);
    expect(result.findings).toEqual([
      {
        kind: "error",
        file: "bundle/index.mjs",
        message: "dist 산출물이 없다. 먼저 pnpm build를 실행한다.",
      },
    ]);
  });

  it("위반이 없으면 ok는 true이고 findings는 빈 배열이다", async () => {
    const packageDir = path.join(fixturesDir, "clean");

    const result = await checkPackageBaseline({ packageDir });

    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("allow 항목이 일치하면 해당 finding이 사라진다", async () => {
    const packageDir = path.join(fixturesDir, "violations");

    const result = await checkPackageBaseline({
      packageDir,
      allow: [{ file: "bundle/index.mjs", name: ".at()", reason: "테스트용 예외" }],
    });

    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
  });
});

describe("formatReport", () => {
  it("tier 2 위반이 있으면 browserBaseline.allow 해소 경로를 안내한다", async () => {
    const packageDir = path.join(fixturesDir, "violations");
    const result = await checkPackageBaseline({ packageDir });

    const lines = formatReport(result);

    expect(lines.some((line) => line.includes("browserBaseline.allow"))).toBe(
      true,
    );
  });

  it("맵이 매핑하는 줄은 origin 경로를 ← 뒤에 붙인다", async () => {
    const packageDir = path.join(fixturesDir, "with-sourcemap");
    const result = await checkPackageBaseline({ packageDir });

    const lines = formatReport(result);

    const hasOwnFinding = result.findings
      .filter(isApiFinding)
      .find((finding) => finding.name === "Object.hasOwn");
    const cloneFinding = result.findings
      .filter(isApiFinding)
      .find((finding) => finding.name === "structuredClone");

    // sources[1]에 매핑되는 위반이라 src/hasKey.ts여야 한다 — 항상
    // sources[0]을 돌려주는 잘못된 origin 조회기면 여기서 어긋난다.
    expect(hasOwnFinding?.origin).toBe("src/hasKey.ts");
    // sources[0]에 매핑되는 위반이라 위 origin과 실제로 갈린다.
    expect(cloneFinding?.origin).toBe("src/clone.ts");

    // origin이 있는데도 report.mjs가 ← 접미사를 안 붙이거나 엉뚱한 경로를
    // 붙이는 구현을 걸러낸다. Chrome 버전 숫자는 검증 대상이 아니므로
    // 줄 전체를 고정 문자열로 비교하지 않고 접미사만 본다.
    expect(
      lines.some(
        (line) =>
          line.includes("Object.hasOwn") &&
          line.endsWith("← src/hasKey.ts"),
      ),
    ).toBe(true);
    expect(
      lines.some(
        (line) =>
          line.includes("structuredClone") && line.endsWith("← src/clone.ts"),
      ),
    ).toBe(true);
  });

  it("맵은 있지만 그 줄이 매핑되지 않으면 ← (매핑 없음)을 붙인다", async () => {
    const packageDir = path.join(fixturesDir, "with-sourcemap");
    const result = await checkPackageBaseline({ packageDir });

    const lines = formatReport(result);

    const atFinding = result.findings
      .filter(isApiFinding)
      .find((finding) => finding.name === ".at()");

    expect(atFinding?.origin).toBeNull();
    expect(atFinding?.originNote).toBeNull();

    // origin이 null인 위반을 조용히 접미사 없이 찍는 구현을 걸러낸다.
    expect(
      lines.some(
        (line) => line.includes(".at()") && line.endsWith("← (매핑 없음)"),
      ),
    ).toBe(true);
    // 맵을 아예 못 쓰는 경우(원본 매핑 없음 줄)와 혼동해서도 안 된다 —
    // 이 픽스처는 맵 자체는 읽히므로 그룹 머리에 "원본 매핑 없음" 줄이
    // 없어야 한다.
    expect(lines.some((line) => line.includes("원본 매핑 없음"))).toBe(
      false,
    );
  });

  it("맵 자체를 못 쓰면 원본 매핑 없음 사유를 위반 건수와 무관하게 파일당 한 번만 낸다", async () => {
    const packageDir = path.join(fixturesDir, "no-sourcemap-pair");
    const result = await checkPackageBaseline({ packageDir });

    const lines = formatReport(result);

    // 이 픽스처는 위반이 2건이다. 위반마다 사유를 반복 출력하는 잘못된
    // 구현이면 이 줄이 두 번 나와 길이가 2가 된다 — 위반 1건짜리
    // 픽스처로는 이 실수를 잡지 못한다.
    const noteLines = lines.filter((line) =>
      line.includes("원본 매핑 없음"),
    );

    expect(noteLines).toEqual([
      "  원본 매핑 없음 — bundle/index.mjs.map이 없다.",
    ]);

    // 사유를 이미 냈으므로 개별 위반 줄에는 ← 접미사를 반복하지 않는다.
    // 반복하면 "이미 말한 사유를 줄마다 되풀이하지 않는다" 규칙이 깨진다.
    expect(
      lines.some((line) => line.startsWith("  line") && line.includes("←")),
    ).toBe(false);
  });
});
