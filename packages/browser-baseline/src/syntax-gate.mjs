/**
 * 문법 검사 게이트다.
 *
 * 같은 소스를 esnext와 계약 타깃으로 각각 재출력해 비교한다.
 * 양쪽 모두 esbuild 재출력이라 포맷 차이는 정규화되고,
 * 차이가 남으면 계약 타깃을 초과하는 문법이 있다는 뜻이다.
 *
 * 타깃은 상수가 아니라 인자다. 정본은 package.json#browserslist이며
 * @repo/browser-baseline가 파생값을 만든다.
 */
import { transform } from "esbuild";

/** 하향 과정에서 삽입되는 변수 호이스트 줄이다. 진단으로는 쓸모가 없다. */
const HOIST_LINE = /^\s*var _[\w$]+(?:,\s*_[\w$]+)*;\s*$/;

/**
 * 두 출력이 다른지 판정하고, 진단용으로 불일치 지점 하나를 돌려준다.
 *
 * 판정은 문자열 전체 비교라 정확하다. 진단은 근사치다.
 * 하향이 `var _a;` 같은 줄을 끼워 넣으면 그 뒤로 두 출력의 줄 번호가
 * 어긋나므로, 돌려주는 actual과 lowered가 같은 문장의 before/after라는 보장은 없다.
 * lowered 쪽이 실제로 하향된 구문을 보여주도록 호이스트 줄은 건너뛴다.
 * 전체 범위는 호출부가 안내하는 esbuild + diff 명령으로 확인한다.
 *
 * @param {string} source 검사할 소스
 * @param {string | string[]} syntaxTarget 계약에서 파생한 esbuild 타깃
 */
export async function findFirstSyntaxDivergence(source, syntaxTarget) {
  if (
    syntaxTarget === undefined ||
    (Array.isArray(syntaxTarget) && syntaxTarget.length === 0)
  ) {
    throw new Error(
      "syntaxTarget이 비었다. @repo/browser-baseline가 파생한 esbuildTarget을 넘겨야 한다.",
    );
  }

  const [modern, legacy] = await Promise.all([
    transform(source, { target: "esnext", format: "esm", loader: "js" }),
    transform(source, { target: syntaxTarget, format: "esm", loader: "js" }),
  ]);

  if (modern.code === legacy.code) {
    return null;
  }

  const modernLines = modern.code.split("\n");
  const legacyLines = legacy.code.split("\n");
  const lineCount = Math.max(modernLines.length, legacyLines.length);

  let rawFirst = null;

  for (let index = 0; index < lineCount; index += 1) {
    const actual = modernLines[index] ?? "";
    const lowered = legacyLines[index] ?? "";

    if (actual === lowered) {
      continue;
    }

    const divergence = { line: index + 1, actual, lowered };

    if (rawFirst === null) {
      rawFirst = divergence;
    }

    // 하향은 `var _a;` 같은 호이스트 줄을 원래 문장보다 위에 끼워 넣는다.
    // 그 줄이 첫 불일치로 잡히면 짝이 서로 무관한 문장이 되므로 건너뛰고
    // 실제로 문법이 바뀐 줄을 찾는다.
    if (HOIST_LINE.test(lowered)) {
      continue;
    }

    return divergence;
  }

  // 호이스트 줄만 다른 경우 raw 첫 불일치를 그대로 쓴다.
  // 두 출력이 후행 줄바꿈에서만 다르면 `?? ""` 패딩 때문에 모든 줄 짝이 같아져
  // rawFirst가 null로 남는다. 그때도 불일치 자체는 실재하므로, 위치를 특정하지
  // 못한다는 뜻의 line 0을 돌려 null 반환으로 검사가 통과하는 일을 막는다.
  return rawFirst ?? { line: 0, actual: "", lowered: "" };
}
