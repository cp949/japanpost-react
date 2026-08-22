/**
 * 패키지 하나의 dist 산출물이 브라우저 지원 계약을 지키는지 검사한다.
 *
 * 계약의 정본은 그 패키지의 package.json#browserslist 하나다.
 * baseline.mjs가 거기서 esbuild 타깃과 Chrome 하한을 파생하고 두 게이트가
 * 같은 값을 쓴다. 이 module은 기준을 인자로 받지 않는다 —
 * 질의를 덮어쓸 수 있으면 계약의 정본이 둘이 된다.
 *
 * 게이트 1(문법): syntax-gate.mjs가 같은 소스를 esnext와 계약 타깃으로 각각
 *   재출력해 비교한다. 차이가 남으면 계약 타깃을 초과하는 문법이 있다는 뜻이다.
 * 게이트 2(런타임 API): esbuild가 다운레벨할 수 없는 API를 acorn AST로 판정한다.
 *   검사 대상은 @mdn/browser-compat-data에서 파생한다 — 손으로 고른 목록이 아니다.
 *
 * 결과는 문자열이 아니라 findings 배열이다. 표시는 report.mjs가 맡는다.
 * 판정과 표시를 갈라 둬야 검사 결과를 테스트에서 그대로 들여다볼 수 있다.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { loadBaseline } from "./baseline.mjs";
import { createScanner } from "./compat-scanner.mjs";
import { resolveDistEntries } from "./dist-entries.mjs";
import { findFirstSyntaxDivergence } from "./syntax-gate.mjs";

/**
 * packageDir의 산출물을 계약에 비추어 검사한다.
 *
 * 기준선 파생과 검사 대상 파생은 폴백하지 않고 던진다.
 * 계약이 없거나 검사 대상이 비는 상태는 통과가 아니라 오류다.
 *
 * 파일 단위 실패는 다르다. 던지지 않고 {kind:"error"} finding으로 기록한다 —
 * 산출물 하나가 없다고 나머지를 검사하지 않으면 진단이 한 번에 한 건씩만 나온다.
 *
 * @param {{ packageDir: string, allow?: Array<{ file: string, name: string, reason: string }> }} options
 *   allow는 tier 2 오탐 예외다. 프로젝트 데이터이므로 인자로만 들어온다.
 */
export async function checkPackageBaseline({ packageDir, allow = [] }) {
  const baseline = loadBaseline(packageDir);
  const scanner = createScanner({
    minChrome: baseline.minChrome,
    allowed: allow,
  });

  // 검사 대상은 package.json#exports에서 파생한다.
  // 엔트리를 추가하면 게이트가 자동으로 따라온다.
  const files = resolveDistEntries(packageDir);

  const findings = [];

  for (const fileName of files) {
    const filePath = path.join(packageDir, fileName);

    try {
      const source = await readFile(filePath, "utf8");

      const divergence = await findFirstSyntaxDivergence(
        source,
        baseline.esbuildTarget,
      );

      if (divergence !== null) {
        findings.push({
          kind: "syntax",
          file: fileName,
          line: divergence.line,
          actual: divergence.actual,
          lowered: divergence.lowered,
        });
      }

      for (const violation of scanner.scan(source, fileName)) {
        findings.push({
          kind: "api",
          file: fileName,
          line: violation.line,
          name: violation.name,
          chrome: violation.chrome,
          text: violation.text,
          tier: violation.tier,
        });
      }
    } catch (error) {
      // ENOENT는 빌드를 건너뛴 흔한 상태다. 원인을 되짚을 필요가 없도록
      // 해소 방법을 메시지에 그대로 적는다.
      findings.push({
        kind: "error",
        file: fileName,
        message:
          error.code === "ENOENT"
            ? "dist 산출물이 없다. 먼저 pnpm build를 실행한다."
            : error.message,
      });
    }
  }

  return { ok: findings.length === 0, baseline, files, findings };
}
