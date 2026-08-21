/**
 * 문법(ES2019) 검사 게이트다.
 *
 * 같은 소스를 esnext와 SYNTAX_TARGET으로 각각 재출력해 비교한다.
 * 양쪽 모두 esbuild 재출력이라 포맷 차이는 정규화되고,
 * 차이가 남으면 SYNTAX_TARGET을 초과하는 문법이 있다는 뜻이다.
 */
import { transform } from "esbuild";

export const SYNTAX_TARGET = "es2019";

/** 하향 과정에서 삽입되는 변수 호이스트 줄이다. 진단으로는 쓸모가 없다. */
const HOIST_LINE = /^\s*var _[\w$]+(?:,\s*_[\w$]+)*;\s*$/;

/**
 * 첫 불일치 지점만 보고한다.
 * es2019 하향은 줄 수를 바꾸므로(예: optional chaining을 내릴 때 `var _a;`를 끼워 넣는다)
 * 첫 불일치 이후로는 두 출력의 줄 번호가 어긋나 짝을 맞출 수 없다.
 * 첫 불일치까지는 줄 번호가 정확히 일치하므로 그 지점만 근거로 쓴다.
 */
export async function findFirstSyntaxDivergence(source) {
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

    // es2019 하향은 `var _a;` 같은 호이스트 줄을 원래 문장보다 위에 끼워 넣는다.
    // 그 줄이 첫 불일치로 잡히면 짝이 서로 무관한 문장이 되므로 건너뛰고
    // 실제로 문법이 바뀐 줄을 찾는다.
    if (HOIST_LINE.test(lowered)) {
      continue;
    }

    return divergence;
  }

  // 호이스트 줄만 다른 경우 raw 첫 불일치를 그대로 쓴다.
  // 마지막 fallback은 도달하지 않지만, 두 출력이 다른데 null을 돌려주어
  // 검사가 조용히 통과하는 일이 없도록 방어한다.
  return rawFirst ?? { line: 0, actual: "", lowered: "" };
}
