/**
 * @repo/browser-baseline의 공개 표면이다.
 *
 * 소비자가 쓰는 진입점은 둘이다.
 * checkPackageBaseline이 패키지 하나를 검사하고, formatReport가 그 결과를
 * 사람이 읽을 줄 목록으로 바꾼다. CLI도 이 둘만 호출한다.
 *
 * 나머지는 게이트를 구성하는 조각이다. 검사 전체를 돌리지 않고 파생값이나
 * 색인만 필요한 소비자(빌드 설정, README 생성기, 테스트)가 있어 함께 연다.
 */
export { loadBaseline } from "./baseline.mjs";
export { checkPackageBaseline } from "./check.mjs";
export { buildCompatIndex, normalizeChromeSupport } from "./compat-bcd.mjs";
export { createScanner } from "./compat-scanner.mjs";
export { collectGlobalReferences } from "./compat-scope.mjs";
export { resolveDistEntries } from "./dist-entries.mjs";
export { formatReport } from "./report.mjs";
export { findFirstSyntaxDivergence } from "./syntax-gate.mjs";
