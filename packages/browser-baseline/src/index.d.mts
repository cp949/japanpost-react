/**
 * @repo/browser-baseline의 공개 표면이다.
 *
 * 소비자가 쓰는 진입점은 checkPackageBaseline과 formatReport 둘이다.
 * 나머지는 파생값이나 색인만 필요한 소비자를 위해 함께 연 조각이다.
 */
export type { BrowserBaseline } from "./baseline.mjs";
export { loadBaseline } from "./baseline.mjs";
export type {
  ApiFinding,
  BaselineCheckResult,
  ErrorFinding,
  Finding,
  SyntaxFinding,
} from "./check.mjs";
export { checkPackageBaseline } from "./check.mjs";
export type { CompatEntry, CompatIndex, MemberEntry } from "./compat-bcd.mjs";
export { buildCompatIndex, normalizeChromeSupport } from "./compat-bcd.mjs";
export type {
  AllowedEntry,
  Scanner,
  Violation,
  ViolationTier,
} from "./compat-scanner.mjs";
export { createScanner } from "./compat-scanner.mjs";
export { collectGlobalReferences } from "./compat-scope.mjs";
export { resolveDistEntries } from "./dist-entries.mjs";
export { formatReport } from "./report.mjs";
export type { SyntaxDivergence } from "./syntax-gate.mjs";
export { findFirstSyntaxDivergence } from "./syntax-gate.mjs";
