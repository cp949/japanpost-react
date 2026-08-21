/**
 * dist 산출물이 브라우저 지원 계약을 지키는지 검사한다.
 *
 * 게이트 1(문법): syntax-gate.mjs가 같은 소스를 esnext와 es2019로 각각
 *   재출력해 비교한다. 차이가 남으면 ES2019를 초과하는 문법이 있다는 뜻이다.
 * 게이트 2(런타임 API): esbuild가 다운레벨할 수 없는 API를 데니리스트로 스캔한다.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { scanForbiddenApis } from "./browser-compat-rules.mjs";
import { SYNTAX_TARGET, findFirstSyntaxDivergence } from "./syntax-gate.mjs";

const RUNTIME_BASELINE = "Chrome 80";

const packageDir = path.resolve(import.meta.dirname, "..");
const distFileNames = ["index.es.js", "client.es.js"];

let failed = false;

for (const fileName of distFileNames) {
  const filePath = path.join(packageDir, "dist", fileName);

  try {
    const source = await readFile(filePath, "utf8");

    const divergence = await findFirstSyntaxDivergence(source);

    if (divergence !== null) {
      failed = true;
      console.error(
        `[syntax] ${fileName}: ${SYNTAX_TARGET}를 초과하는 문법이 남아 있다.`,
      );

      if (divergence.line > 0) {
        console.error(`  첫 불일치 line ${divergence.line}`);
        console.error(`    현재:   ${divergence.actual.trim()}`);
        console.error(`    ${SYNTAX_TARGET}: ${divergence.lowered.trim()}`);
      }

      console.error("  전체 범위는 다음으로 확인한다:");
      console.error(
        `    npx esbuild dist/${fileName} --target=esnext --format=esm > /tmp/modern.js`,
      );
      console.error(
        `    npx esbuild dist/${fileName} --target=${SYNTAX_TARGET} --format=esm > /tmp/legacy.js && diff /tmp/modern.js /tmp/legacy.js`,
      );
    }

    const apiViolations = scanForbiddenApis(source, fileName);

    if (apiViolations.length > 0) {
      failed = true;
      console.error(
        `[api] ${fileName}: ${RUNTIME_BASELINE} 미지원 API ${apiViolations.length}건`,
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
    `\nbrowser compat check 실패: 문법은 ${SYNTAX_TARGET}, 런타임 API는 ${RUNTIME_BASELINE} 기준이다.`,
  );
  process.exit(1);
}

console.log(
  `browser compat check 통과: 문법 ${SYNTAX_TARGET}, 런타임 API ${RUNTIME_BASELINE}.`,
);
