/**
 * package.json#exports에서 호환성 게이트가 검사할 산출물 목록을 파생한다.
 * exports가 없거나 JavaScript 산출물이 하나도 없으면 던진다.
 *
 * @returns packageDir 기준 상대 경로 목록
 */
export function resolveDistEntries(packageDir: string): string[];
