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
const MAX_REPORTED_DIFFS = 5;

const packageDir = path.resolve(import.meta.dirname, "..");
const distFileNames = ["index.es.js", "client.es.js"];

async function findSyntaxViolations(source) {
  const [modern, legacy] = await Promise.all([
    transform(source, { target: "esnext", format: "esm", loader: "js" }),
    transform(source, { target: SYNTAX_TARGET, format: "esm", loader: "js" }),
  ]);

  if (modern.code === legacy.code) {
    return [];
  }

  const modernLines = modern.code.split("\n");
  const legacyLines = legacy.code.split("\n");
  const lineCount = Math.max(modernLines.length, legacyLines.length);
  const diffs = [];

  for (let index = 0; index < lineCount; index += 1) {
    const actual = modernLines[index] ?? "";
    const lowered = legacyLines[index] ?? "";

    if (actual !== lowered) {
      diffs.push({ line: index + 1, actual, lowered });
    }
  }

  return diffs;
}

let failed = false;

for (const fileName of distFileNames) {
  const filePath = path.join(packageDir, "dist", fileName);
  const source = await readFile(filePath, "utf8");

  const syntaxDiffs = await findSyntaxViolations(source);

  if (syntaxDiffs.length > 0) {
    failed = true;
    console.error(
      `[syntax] ${fileName}: ${SYNTAX_TARGET}를 초과하는 문법 ${syntaxDiffs.length}곳`,
    );

    for (const diff of syntaxDiffs.slice(0, MAX_REPORTED_DIFFS)) {
      console.error(`  line ${diff.line}`);
      console.error(`    현재:   ${diff.actual.trim()}`);
      console.error(`    ${SYNTAX_TARGET}: ${diff.lowered.trim()}`);
    }

    if (syntaxDiffs.length > MAX_REPORTED_DIFFS) {
      console.error(`  ... 외 ${syntaxDiffs.length - MAX_REPORTED_DIFFS}곳`);
    }
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
