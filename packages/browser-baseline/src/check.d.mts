import type { BrowserBaseline } from "./baseline.mjs";
import type { AllowedEntry, ViolationTier } from "./compat-scanner.mjs";

/** 문법 게이트가 잡은 위반 하나다. 계약 타깃을 초과하는 문법이 남아 있다. */
export interface SyntaxFinding {
  kind: "syntax";
  /** 검사 대상의 패키지 기준 상대 경로다. 예: "dist/index.es.js" */
  file: string;
  /** 1부터 세는 줄 번호다. 0은 위치를 특정하지 못했다는 뜻이다. */
  line: number;
  /** esnext 재출력 쪽 줄 원문이다. */
  actual: string;
  /** 계약 타깃 재출력 쪽 줄 원문이다. */
  lowered: string;
}

/** 런타임 API 게이트가 잡은 위반 하나다. */
export interface ApiFinding {
  kind: "api";
  /** 검사 대상의 패키지 기준 상대 경로다. */
  file: string;
  /** 1부터 세는 줄 번호다. */
  line: number;
  /** 판정 이름이다. allowed 예외의 매칭 키와 같은 형식이다. */
  name: string;
  /** 이 API가 처음 지원된 Chrome 버전이다. 미지원은 Infinity다. */
  chrome: number;
  /** 위반이 있는 줄의 원문이다. 앞뒤 공백은 없다. */
  text: string;
  /** 판정 단계다. */
  tier: ViolationTier;
}

/** 파일 하나를 검사하지 못했다. 다른 파일 검사는 계속된다. */
export interface ErrorFinding {
  kind: "error";
  /** 검사하지 못한 대상의 패키지 기준 상대 경로다. */
  file: string;
  /** 사람이 읽을 원인이다. 산출물이 없으면 빌드 안내가 들어간다. */
  message: string;
}

/** 게이트가 남긴 판정 하나다. kind로 갈라 읽는다. */
export type Finding = SyntaxFinding | ApiFinding | ErrorFinding;

/** 패키지 하나에 대한 검사 결과다. */
export interface BaselineCheckResult {
  /** findings가 비었는지다. 표시 계층이 판정을 다시 계산하지 않게 한다. */
  ok: boolean;
  /** 검사에 쓴 계약 파생값이다. 진단 문구가 기준을 그대로 인용한다. */
  baseline: BrowserBaseline;
  /** package.json#exports에서 파생한 검사 대상 목록이다. */
  files: string[];
  /** 검사 대상 순서대로 쌓인 판정 목록이다. */
  findings: Finding[];
}

/**
 * packageDir의 dist 산출물을 문법·런타임 API 두 게이트로 검사한다.
 *
 * 기준은 packageDir의 package.json#browserslist에서 파생한다.
 * 질의를 덮어쓰는 인자는 없다 — 계약의 정본은 하나여야 한다.
 *
 * 계약을 읽지 못하거나 검사 대상이 비면 던진다.
 * 파일 단위 실패는 던지지 않고 ErrorFinding으로 기록한다.
 *
 * @param options.allow tier 2 오탐 예외다. 기본값은 빈 목록이다
 */
export function checkPackageBaseline(options: {
  packageDir: string;
  allow?: AllowedEntry[];
}): Promise<BaselineCheckResult>;
