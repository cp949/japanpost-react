/**
 * dist 산출물이 브라우저 지원 계약을 지키는지 검사한다.
 *
 * 게이트 1(문법): 같은 소스를 esnext와 es2019로 각각 재출력해 비교한다.
 *   양쪽 모두 esbuild 재출력이라 포맷 차이는 정규화되고,
 *   차이가 남으면 ES2019를 초과하는 문법이 있다는 뜻이다.
 * 게이트 2(런타임 API): esbuild가 다운레벨할 수 없는 API를 데니리스트로 스캔한다.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { transform } from "esbuild";

import { scanForbiddenApis } from "./browser-compat-rules.mjs";

const SYNTAX_TARGET = "es2019";
const RUNTIME_BASELINE = "Chrome 80";

const packageDir = path.resolve(import.meta.dirname, "..");
const distFileNames = ["index.es.js", "client.es.js"];

/**
 * 게이트 1: 같은 소스를 esnext와 es2019로 각각 재출력해 비교한다.
 * 양쪽 모두 esbuild 재출력이라 포맷 차이는 정규화되고,
 * 결과가 다르면 ES2019를 초과하는 문법이 남아 있다는 뜻이다.
 *
 * 진단은 첫 불일치 지점만 보고한다.
 * es2019 하향은 줄 수를 바꾸므로(예: optional chaining을 내릴 때 `var _a;`를 끼워 넣는다)
 * 첫 불일치 이후로는 두 출력의 줄 번호가 어긋나 짝을 맞출 수 없다.
 * 첫 불일치까지는 줄 번호가 정확히 일치하므로 그 지점만 근거로 쓴다.
 */
async function findFirstSyntaxDivergence(source) {
  const [modern, legacy] = await Promise.all([
    transform(source, { target: "esnext", format: "esm", loader: "js" }),
    transform(source, { target: SYNTAX_TARGET, format: "esm", loader: "js" }),
  ]);

  if (modern.code === legacy.code) {
    return null;
  }

  const modernLines = modern.code.split("\n");
  const legacyLines = legacy.code.split("\n");
  const lineCount = Math.max(modernLines.length, legacyLines.length);

  for (let index = 0; index < lineCount; index += 1) {
    const actual = modernLines[index] ?? "";
    const lowered = legacyLines[index] ?? "";

    if (actual !== lowered) {
      return { line: index + 1, actual, lowered };
    }
  }

  // 줄 단위로는 모두 같은데 전체 문자열만 다른 경우다(후행 줄바꿈 차이 등).
  // 위치를 특정할 수 없으므로 line 0으로 표시한다.
  return { line: 0, actual: "", lowered: "" };
}

let failed = false;

for (const fileName of distFileNames) {
  const filePath = path.join(packageDir, "dist", fileName);
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

    console.error(
      `  전체 범위는 다음으로 확인한다: npx esbuild dist/${fileName} --target=${SYNTAX_TARGET} --format=esm`,
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
