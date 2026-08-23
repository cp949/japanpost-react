/**
 * 패키지 하나의 dist 산출물이 브라우저 지원 계약을 지키는지 검사한다.
 *
 * 문법·런타임 API 기준의 정본은 package.json#browserslist다.
 * baseline.mjs가 거기서 esbuild 타깃과 Chrome 하한을 파생하고 두 게이트가
 * 같은 값을 쓴다. dependency closure의 정본은 별도로 package.json의 name과
 * dependency 필드다. 이 module은 어느 기준도 인자로 덮어쓰지 않는다.
 *
 * 게이트 1(문법): syntax-gate.mjs가 같은 소스를 esnext와 계약 타깃으로 각각
 *   재출력해 비교한다. 차이가 남으면 계약 타깃을 초과하는 문법이 있다는 뜻이다.
 * 게이트 2(런타임 API): esbuild가 다운레벨할 수 없는 API를 acorn AST로 판정한다.
 *   검사 대상은 @mdn/browser-compat-data에서 파생한다 — 손으로 고른 목록이 아니다.
 * 게이트 3(dependency closure): peer와 패키지 자신 외의 runtime import가
 *   dist 밖에 남아 앞의 두 게이트를 우회하지 못하게 한다. 판정은 manifest의
 *   name·peerDependencies·dependencies·optionalDependencies를 쓴다.
 *
 * 결과는 문자열이 아니라 findings 배열이다. 표시는 report.mjs가 맡는다.
 * 판정과 표시를 갈라 둬야 검사 결과를 테스트에서 그대로 들여다볼 수 있다.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { loadBaseline } from "./baseline.mjs";
import { createScanner } from "./compat-scanner.mjs";
import { createDependencyClosureScanner } from "./dependency-closure.mjs";
import { resolveDistEntries } from "./dist-entries.mjs";
import { createOriginLookup } from "./source-origin.mjs";
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
  const dependencyScanner = createDependencyClosureScanner(packageDir);

  // 검사 대상은 package.json#exports에서 파생한다.
  // 엔트리를 추가하면 게이트가 자동으로 따라온다.
  const files = resolveDistEntries(packageDir);

  const findings = [];

  for (const fileName of files) {
    const filePath = path.join(packageDir, fileName);

    try {
      const source = await readFile(filePath, "utf8");

      // 먼저 같은 AST 기반 closure를 판정한다. 여기서 파싱이 실패하면 아래
      // API scanner가 같은 파일을 다시 파싱하지 않고 catch가 error 한 건만 남긴다.
      findings.push(...dependencyScanner.scan(source, fileName));

      const divergence = await findFirstSyntaxDivergence(
        source,
        baseline.esbuildTarget,
      );

      if (divergence !== null) {
        // SyntaxFinding에는 origin을 붙이지 않는다. divergence.line은 dist
        // 원본 줄이 아니라 esbuild가 esnext·계약 타깃으로 각각 재출력한
        // 결과물의 줄이다(실측 오프셋 최대 +20줄/index, +12줄/client).
        // 소스맵은 원본 dist 산출물의 줄을 기준으로 만들어지므로, 재출력본
        // 줄을 그대로 먹이면 엉뚱한 원본 파일을 가리키게 된다.
        findings.push({
          kind: "syntax",
          file: fileName,
          line: divergence.line,
          actual: divergence.actual,
          lowered: divergence.lowered,
        });
      }

      // 맵은 형제 파일 규약으로 찾는다. `//# sourceMappingURL=` 주석에
      // 기대지 않는다 — 그 주석은 배포 산출물에서 제거될 수 있고, 주석이
      // 가리키는 경로는 신뢰 경계 밖이다.
      let originLookup = null;
      let originNote = null; // 맵을 쓸 수 없는 이유. null이면 맵을 쓸 수 있다는 뜻이다.

      try {
        const mapText = await readFile(`${filePath}.map`, "utf8");

        originLookup = createOriginLookup(mapText, {
          mapDir: path.posix.dirname(fileName),
        });
      } catch (error) {
        // 맵 문제로 파일 검사를 실패시키지 않는다. 맵은 부가 정보이지
        // 계약이 아니다 — ENOENT든 계약 위반(createOriginLookup이 던진
        // 것)이든 여기서 흡수하고 사유만 originNote에 남긴다.
        originNote =
          error.code === "ENOENT"
            ? `${fileName}.map이 없다.`
            : `소스맵을 쓸 수 없다: ${error.message}`;
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
          origin: originLookup ? originLookup.originOf(violation.line) : null,
          originNote,
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
