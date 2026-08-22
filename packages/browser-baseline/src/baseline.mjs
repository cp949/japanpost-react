/**
 * 브라우저 지원 계약의 정본을 읽어 소비자별 파생값을 만든다.
 *
 * 정본은 package.json의 browserslist 필드 하나뿐이다.
 * 빌드 타깃(tsup), 문법 게이트, 런타임 API 게이트, README 생성이 모두
 * 이 module을 거쳐 같은 값을 본다.
 *
 * cwd에 의존하지 않는다. 호출부가 packageDir을 명시한다 —
 * 이 module의 소비자에는 워크스페이스 루트에서 실행되는 README 생성기가 있다.
 *
 * 알려진 보수성: esbuild compat-table은 optional chaining(`?.`)을 Chrome 91로
 * 판정한다. MDN 기준 Chrome 80은 `?.`를 지원하지만 esbuild는 chrome80 타깃에서도
 * 이를 하향한다. 산출물이 계약보다 보수적인 쪽이므로 계약을 깨지 않는다.
 * 실측: --target=chrome90까지 하향, --target=chrome91부터 원형 유지.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import browserslistToEsbuild from "browserslist-to-esbuild";

/** esbuild 타깃 문자열에서 Chrome 버전을 뽑는 패턴이다. 예: "chrome80" -> 80 */
const CHROME_TARGET = /^chrome(\d+)(?:\.\d+)*$/;

/**
 * packageDir의 package.json에서 browserslist 질의를 읽어 파생값을 만든다.
 *
 * 파생에 실패하면 폴백하지 않고 던진다.
 * 검사 도구가 스스로 기준을 지어내면 계약이 조용히 날조되기 때문이다.
 *
 * @param {string} packageDir 정본 package.json이 있는 디렉터리
 */
export function loadBaseline(packageDir) {
  const manifestPath = path.join(packageDir, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const query = manifest.browserslist;

  if (!Array.isArray(query) || query.length === 0) {
    throw new Error(
      `${manifestPath}에 browserslist 필드가 없다. 브라우저 지원 계약의 정본이므로 비워 둘 수 없다.`,
    );
  }

  // browserslist-to-esbuild는 브라우저별 최저 버전만 남긴다. 예: ["chrome80"]
  const esbuildTarget = browserslistToEsbuild(query);

  const chromeTargets = esbuildTarget
    .map((target) => CHROME_TARGET.exec(target))
    .filter((match) => match !== null)
    .map((match) => Number.parseInt(match[1], 10));

  if (chromeTargets.length === 0) {
    throw new Error(
      `browserslist 질의 ${JSON.stringify(query)}에서 Chrome 하한을 구할 수 없다. 파생 타깃: ${JSON.stringify(esbuildTarget)}`,
    );
  }

  return {
    query,
    minChrome: Math.min(...chromeTargets),
    esbuildTarget,
  };
}
