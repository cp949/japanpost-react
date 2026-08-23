import type { DependencyFinding } from "./check.mjs";

/** package manifest와 dist source 하나를 대조하는 내부 scanner다. */
export interface DependencyClosureScanner {
  /** 파싱 실패는 던지고, 판정 가능한 closure 위반은 finding으로 돌려준다. */
  scan(source: string, fileName?: string): DependencyFinding[];
}

/**
 * packageDir/package.json을 한 번 읽어 dependency closure scanner를 만든다.
 *
 * name·peerDependencies·dependencies·optionalDependencies가 closure의 정본이다.
 * 형태가 잘못되면 package.json 경로를 포함해 던진다. browserslist에서
 * 파생하는 문법·런타임 API 기준과는 독립된 계약이다.
 */
export function createDependencyClosureScanner(
  packageDir: string,
): DependencyClosureScanner;
