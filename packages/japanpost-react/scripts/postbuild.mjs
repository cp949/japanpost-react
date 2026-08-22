/**
 * tsup 빌드 직후 dist 산출물을 두 가지로 손본다.
 *
 * 1) 모든 dist/*.es.js에서 `//# sourceMappingURL=` 주석 줄을 제거한다.
 *    - 이유 1: tsup이 treeshake: true 경로에서 이 주석을 2번 출력한다(실측).
 *      esbuild가 한 번, 그 출력에 다시 도는 rollup이 한 번 붙인다.
 *    - 이유 2: .map은 package.json#files의 부정 패턴으로 npm 배포에서 빠진다.
 *      주석이 남으면 소비자 번들러가 배포본에 없는 맵을 찾는다.
 *    - 이유 3: 주석이 파일 끝에 붙으므로 제거해도 앞쪽 줄 번호가 안 바뀐다 —
 *      소스맵 좌표는 그대로 유효하다. browser-baseline 게이트는 이 주석이
 *      아니라 형제 .map 파일 규약으로 맵을 찾으므로 검사도 영향받지 않는다.
 *
 * 2) dist/client.es.js에 "use client" 지시문을 붙이고, 밀려난 만큼
 *    client.es.js.map의 좌표를 보정한다.
 *    tsup의 banner 옵션으로 넣을 수 없다 — banner는 esbuild에만 전달되고,
 *    treeshake: true면 그 출력에 rollup이 한 번 더 도는데 rollup이 module
 *    최상위 지시문을 제거한다("Module level directives cause errors when
 *    bundled" 경고, 실측). 그래서 빌드 후에 붙이고 맵을 직접 민다.
 */
import fs from "node:fs/promises";
import path from "node:path";

const packageDir = path.resolve(import.meta.dirname, "..");
const distDir = path.join(packageDir, "dist");

// 줄 단위 split/filter/join으로 지우면 파일 끝 개행까지 같이 날아가 바이트가
// 줄어든다. 줄바꿈을 매치에 포함시켜 그 줄만 정확히 걷어낸다.
const sourceMappingUrlLine = /^\/\/# sourceMappingURL=.*\r?\n?/gm;

// 뒤에 개행이 붙는다 — 지시문이 한 줄을 온전히 차지해야 그 아래 코드의 줄
// 번호 이동량이 정확히 1줄로 떨어진다.
const useClientDirective = '"use client";\n';

/**
 * 문자열이 몇 줄을 차지하는지 센다. 맵을 밀 양을 지시문에서 직접 파생하려고 쓴다.
 *
 * @param {string} text 줄 수를 셀 문자열
 * @returns {number}
 */
function countLines(text) {
  return text.split("\n").length - 1;
}

/**
 * dist의 모든 *.es.js에서 sourceMappingURL 주석 줄을 없앤다.
 */
async function stripSourceMappingUrlComments() {
  const entries = await fs.readdir(distDir);

  for (const entry of entries) {
    if (!entry.endsWith(".es.js")) {
      continue;
    }

    const filePath = path.join(distDir, entry);
    const source = await fs.readFile(filePath, "utf8");
    const stripped = source.replace(sourceMappingUrlLine, "");

    if (stripped !== source) {
      await fs.writeFile(filePath, stripped, "utf8");
    }
  }
}

/**
 * 소스맵을 읽어 mappings를 생성 줄 기준으로 lineCount만큼 아래로 민 JSON
 * 문자열을 돌려준다. 파일에 쓰지는 않는다 — 쓰기 시점과 순서는 호출부가
 * 통제해야 하기 때문이다(prependUseClientDirective의 주석 참고).
 *
 * mappings는 ";"로 생성 줄을 가른다. 앞에 ";"를 lineCount개 붙이면 원래 첫 줄이
 * lineCount+1번째 줄로 밀린다. 세그먼트 본문은 손대지 않아도 된다 — 생성 컬럼
 * 델타는 줄이 바뀔 때마다 0에서 다시 시작하고, sources/원본줄/원본컬럼 델타는
 * 세그먼트 사이에서만 누적되는데 빈 줄에는 세그먼트가 없기 때문이다.
 *
 * @param {string} mapPath 소스맵 파일 경로
 * @param {number} lineCount 아래로 밀 생성 줄 수
 * @returns {Promise<string>} 보정된 소스맵 JSON 문자열
 */
async function readShiftedMapText(mapPath, lineCount) {
  let mapText;

  try {
    mapText = await fs.readFile(mapPath, "utf8");
  } catch (cause) {
    // 폴백하지 않는다. 맵 없이 지시문만 붙이면 이후 모든 좌표가 조용히 1줄씩
    // 어긋난 채로 남아 게이트가 엉뚱한 원본 파일을 지목하게 된다.
    throw new Error(
      `소스맵을 읽을 수 없다: ${mapPath}. tsup.config.ts의 sourcemap 설정을 확인한다.`,
      { cause },
    );
  }

  const map = JSON.parse(mapText);

  if (typeof map.mappings !== "string") {
    throw new Error(`소스맵에 mappings 문자열 필드가 없다: ${mapPath}`);
  }

  map.mappings = `${";".repeat(lineCount)}${map.mappings}`;

  return JSON.stringify(map);
}

/**
 * dist/client.es.js에 "use client" 지시문을 붙이고 맵 좌표를 함께 보정한다.
 *
 * 이미 붙어 있으면 둘 다 건너뛴다 — 지시문 추가와 맵 이동은 항상 한 벌로
 * 일어나야 한다. 한쪽만 반복되면 좌표가 어긋난다.
 */
async function prependUseClientDirective() {
  const entryPath = path.join(distDir, "client.es.js");
  const mapPath = `${entryPath}.map`;
  const source = await fs.readFile(entryPath, "utf8");

  if (source.startsWith(useClientDirective)) {
    return;
  }

  // 맵을 먼저 읽고 검증해 보정본을 메모리에 만들어 둔다. 쓰기는 그 다음이다.
  //
  // 순서가 불변식을 지탱한다. JS를 먼저 쓰고 맵을 나중에 읽는 구조였다면,
  // 맵 단계가 던졌을 때 JS에는 지시문이 남고 맵은 미보정인 상태로 끝난다.
  // 그 뒤로는 위 startsWith 가드가 걸려 재실행해도 맵 이동을 영영 건너뛰므로,
  // 전 줄이 1줄 어긋난 맵이 exit 0으로 조용히 고착된다 — 게이트가 엉뚱한
  // 원본 파일을 자신 있게 지목하는 최악의 실패다.
  //
  // 맵이 없다·JSON이 깨졌다·mappings가 없다 같은 현실적인 실패는 전부 이
  // 읽기·검증 단계에서 걸린다. 그 시점에는 아무것도 쓰지 않았으므로 원인을
  // 고치고 다시 돌리면 그대로 자가 복구된다.
  //
  // 두 쓰기 중에는 JS를 먼저 한다. 맵을 먼저 쓰면 JS 쓰기가 실패했을 때
  // 재실행이 이미 밀린 맵을 한 번 더 미는 이중 보정 위험이 생긴다.
  const shiftedMapText = await readShiftedMapText(
    mapPath,
    countLines(useClientDirective),
  );

  await fs.writeFile(entryPath, `${useClientDirective}${source}`, "utf8");
  await fs.writeFile(mapPath, shiftedMapText, "utf8");
}

await stripSourceMappingUrlComments();
await prependUseClientDirective();
