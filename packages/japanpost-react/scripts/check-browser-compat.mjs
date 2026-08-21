/**
 * dist 산출물이 브라우저 지원 계약을 지키는지 검사한다.
 *
 * 계약의 정본은 package.json#browserslist 하나다.
 * scripts/baseline.mjs가 거기서 esbuild 타깃과 Chrome 하한을 파생하고
 * 두 게이트가 같은 값을 쓴다.
 *
 * 게이트 1(문법): syntax-gate.mjs가 같은 소스를 esnext와 계약 타깃으로 각각
 *   재출력해 비교한다. 차이가 남으면 계약 타깃을 초과하는 문법이 있다는 뜻이다.
 * 게이트 2(런타임 API): esbuild가 다운레벨할 수 없는 API를 데니리스트로 스캔한다.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { loadBaseline } from "./baseline.mjs";
import { createScanner } from "./browser-compat-rules.mjs";
import { resolveDistEntries } from "./dist-entries.mjs";
import { findFirstSyntaxDivergence } from "./syntax-gate.mjs";

const packageDir = path.resolve(import.meta.dirname, "..");

const baseline = loadBaseline(packageDir);
const syntaxTarget = baseline.esbuildTarget;
const syntaxTargetLabel = syntaxTarget.join(", ");
const runtimeBaseline = `Chrome ${baseline.minChrome}`;

const scanner = createScanner({ minChrome: baseline.minChrome });

// 검사 대상은 package.json#exports에서 파생한다.
// 엔트리를 추가하면 게이트가 자동으로 따라온다.
const distFileNames = resolveDistEntries(packageDir);

let failed = false;

for (const fileName of distFileNames) {
  const filePath = path.join(packageDir, fileName);

  try {
    const source = await readFile(filePath, "utf8");

    const divergence = await findFirstSyntaxDivergence(source, syntaxTarget);

    if (divergence !== null) {
      failed = true;
      console.error(
        `[syntax] ${fileName}: ${syntaxTargetLabel}를 초과하는 문법이 남아 있다.`,
      );

      if (divergence.line > 0) {
        console.error(`  첫 불일치 line ${divergence.line}`);
        console.error(`    현재:   ${divergence.actual.trim()}`);
        console.error(`    ${syntaxTargetLabel}: ${divergence.lowered.trim()}`);
      }

      console.error("  전체 범위는 다음으로 확인한다:");
      console.error(
        `    npx esbuild ${fileName} --target=esnext --format=esm > /tmp/modern.js`,
      );
      console.error(
        `    npx esbuild ${fileName} --target=${syntaxTarget.join(",")} --format=esm > /tmp/legacy.js && diff /tmp/modern.js /tmp/legacy.js`,
      );
    }

    const apiViolations = scanner.scan(source, fileName);

    if (apiViolations.length > 0) {
      failed = true;
      console.error(
        `[api] ${fileName}: ${runtimeBaseline} 미지원 API ${apiViolations.length}건`,
      );

      for (const violation of apiViolations) {
        console.error(
          `  line ${violation.line}: ${violation.name} (Chrome ${violation.chrome}+)`,
        );
        console.error(`    ${violation.text}`);
      }
    }
  } catch (error) {
    failed = true;

    if (error.code === "ENOENT") {
      console.error(
        `[error] ${fileName}: dist 산출물이 없다. 먼저 pnpm build를 실행한다.`,
      );
    } else {
      console.error(`[error] ${fileName}: ${error.message}`);
    }
  }
}

if (failed) {
  console.error(
    `\nbrowser compat check 실패: 계약은 ${JSON.stringify(baseline.query)}, 문법은 ${syntaxTargetLabel}, 런타임 API는 ${runtimeBaseline} 기준이다.`,
  );
  process.exit(1);
}

console.log(
  `browser compat check 통과: 문법 ${syntaxTargetLabel}, 런타임 API ${runtimeBaseline} (browserslist ${JSON.stringify(baseline.query)}).`,
);
