/**
 * package.json#exports에서 호환성 게이트가 검사할 산출물 목록을 파생한다.
 *
 * 다음 경우에 던진다. 조용히 건너뛰면 게이트가 검사하지 않고 통과한다.
 * - exports 필드가 없다
 * - exports 값이 "./"로 시작하지 않거나 패키지 밖을 가리킨다
 * - JavaScript 산출물(.js / .mjs / .cjs)이 하나도 없다
 *
 * @returns packageDir 기준 상대 경로 목록. 구분자는 항상 "/"다
 */
export function resolveDistEntries(packageDir: string): string[];
