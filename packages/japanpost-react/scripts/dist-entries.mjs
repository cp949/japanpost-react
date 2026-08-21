/**
 * 호환성 게이트가 검사할 dist 산출물 목록을 package.json#exports에서 파생한다.
 *
 * exports는 소비자에게 도달하는 진입점의 정본이다.
 * 목록을 손으로 복제하면 엔트리를 추가했을 때 게이트가 조용히 건너뛴다.
 * glob 대신 exports를 쓰는 이유는 이전 빌드 잔여물을 검사 대상에 넣지 않기 위해서다.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

/** 타입 선언은 실행되지 않으므로 런타임 호환성 검사 대상이 아니다. */
const NON_RUNTIME_CONDITIONS = new Set(["types"]);

/** exports 값 하나에서 JavaScript 산출물 경로를 모은다. */
function collectTargets(entry, into) {
  if (typeof entry === "string") {
    into.add(entry);
    return;
  }

  if (entry === null || typeof entry !== "object") {
    return;
  }

  for (const [condition, value] of Object.entries(entry)) {
    if (NON_RUNTIME_CONDITIONS.has(condition)) {
      continue;
    }

    collectTargets(value, into);
  }
}

/**
 * packageDir의 package.json#exports에서 검사 대상 파일 목록을 만든다.
 *
 * 목록이 비면 던진다. 검사할 것이 없다는 상태는 통과가 아니라 오류다.
 *
 * @param {string} packageDir 정본 package.json이 있는 디렉터리
 * @returns {string[]} packageDir 기준 상대 경로. 예: ["dist/client.es.js", "dist/index.es.js"]
 */
export function resolveDistEntries(packageDir) {
  const manifestPath = path.join(packageDir, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const exportsField = manifest.exports;

  if (exportsField === null || typeof exportsField !== "object") {
    throw new Error(
      `${manifestPath}에 exports 필드가 없다. 검사할 산출물 목록을 파생할 수 없다.`,
    );
  }

  const targets = new Set();

  for (const entry of Object.values(exportsField)) {
    collectTargets(entry, targets);
  }

  const files = [...targets]
    .filter((target) => target.endsWith(".js"))
    .map((target) => path.normalize(target).replace(/^[.\\/]+/, ""))
    .sort();

  if (files.length === 0) {
    throw new Error(
      `${manifestPath}의 exports에서 JavaScript 산출물을 찾지 못했다. 검사 대상이 비면 통과가 아니라 실패다.`,
    );
  }

  return [...new Set(files)];
}
