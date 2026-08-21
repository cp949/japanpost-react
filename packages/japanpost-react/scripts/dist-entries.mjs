/**
 * 호환성 게이트가 검사할 dist 산출물 목록을 package.json#exports에서 파생한다.
 *
 * exports는 소비자에게 도달하는 진입점의 정본이다.
 * 목록을 손으로 복제하면 엔트리를 추가했을 때 게이트가 조용히 건너뛴다.
 * glob 대신 exports를 쓰는 이유는 이전 빌드 잔여물을 검사 대상에 넣지 않기 위해서다.
 *
 * 조용히 빠지는 경우를 만들지 않는 것이 이 module의 계약이다.
 * 알아볼 수 없는 exports 값은 건너뛰지 않고 던진다.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

/** 타입 선언은 실행되지 않으므로 런타임 호환성 검사 대상이 아니다. */
const NON_RUNTIME_CONDITIONS = new Set(["types"]);

/**
 * 런타임에 실행되는 JavaScript 확장자다.
 * .json, .css, .wasm 같은 자산 엔트리는 문법·API 게이트의 대상이 아니다.
 */
const JS_EXTENSIONS = new Set([".js", ".mjs", ".cjs"]);

/** exports 값은 명세상 "./"로 시작하는 패키지 내부 상대 경로다. */
const RELATIVE_PREFIX = /^\.\//;

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
 * exports 값을 packageDir 기준 상대 경로로 바꾼다.
 *
 * 패키지 밖을 가리키는 값은 잘라내지 않고 던진다.
 * 앞의 "../"나 "/"를 조용히 지우면 존재하지 않는 다른 경로가 만들어지고,
 * 게이트는 실제 원인과 다른 ENOENT를 보고하게 된다.
 *
 * @param {string} target exports에 적힌 값
 * @param {string} manifestPath 진단에 쓸 정본 매니페스트 경로
 */
function toPackageRelative(target, manifestPath) {
  if (!RELATIVE_PREFIX.test(target)) {
    throw new Error(
      `${manifestPath}의 exports 값 ${JSON.stringify(target)}이 "./"로 시작하지 않는다. exports는 패키지 내부 상대 경로여야 한다.`,
    );
  }

  // exports 경로는 명세상 POSIX 구분자다. Windows에서도 같은 문자열이 나오도록 posix로 정규화한다.
  const normalized = path.posix.normalize(target).replace(RELATIVE_PREFIX, "");

  if (normalized === ".." || normalized.startsWith("../")) {
    throw new Error(
      `${manifestPath}의 exports 값 ${JSON.stringify(target)}이 패키지 밖을 가리킨다.`,
    );
  }

  return normalized;
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

  // exports는 서브경로 map, 조건 map, 문자열 단축 표기 중 하나다. 셋 다 collectTargets가 처리한다.
  if (exportsField === undefined || exportsField === null) {
    throw new Error(
      `${manifestPath}에 exports 필드가 없다. 검사할 산출물 목록을 파생할 수 없다.`,
    );
  }

  const targets = new Set();

  collectTargets(exportsField, targets);

  const files = [
    ...new Set(
      [...targets]
        .filter((target) => JS_EXTENSIONS.has(path.posix.extname(target)))
        .map((target) => toPackageRelative(target, manifestPath)),
    ),
  ].sort();

  if (files.length === 0) {
    throw new Error(
      `${manifestPath}의 exports에서 JavaScript 산출물을 찾지 못했다. 검사 대상이 비면 통과가 아니라 실패다.`,
    );
  }

  return files;
}
