/** 판정 단계다. 1은 확정, 2는 수신자 미상, 3은 옵션 서브피처다. */
export type ViolationTier = 1 | 2 | 3;

/** 계약을 넘는 런타임 API 사용 하나다. */
export interface Violation {
  /** 검사 대상의 패키지 기준 상대 경로다. 예: "dist/index.es.js" */
  file: string;
  /** 1부터 세는 줄 번호다. */
  line: number;
  /** 판정 이름이다. ALLOWED의 매칭 키와 같은 형식이다. */
  name: string;
  /** 이 API가 처음 지원된 Chrome 버전이다. */
  chrome: number;
  /** 위반이 있는 줄의 원문이다. 앞뒤 공백은 없다. */
  text: string;
  /** 판정 단계다. */
  tier: ViolationTier;
}

/** 오탐 예외 하나다. */
export interface AllowedEntry {
  /** 검사 대상의 상대 경로다. "*"는 전체를 뜻한다. */
  file: string;
  /** Violation.name과 같은 형식의 이름이다. */
  name: string;
  /** 왜 안전한지다. 필수다. */
  reason: string;
}

/** 오탐 예외 목록이다. dist는 생성물이라 인라인 주석을 넣을 수 없다. */
export const ALLOWED: AllowedEntry[];

/** 계약의 Chrome 하한에 맞춰 만든 스캐너다. */
export interface Scanner {
  /** 파생 기준이 된 Chrome 하한이다. */
  minChrome: number;
  /** 색인에 담긴 판정 대상 수다. 진단용이다. */
  indexSize: number;
  /**
   * source를 파싱해 계약을 넘는 런타임 API 사용을 모은다.
   * 줄 번호 오름차순, 동률이면 이름 사전순으로 정렬해 돌려준다.
   * 파싱에 실패하면 던진다.
   */
  scan(source: string, fileName?: string): Violation[];
}

/**
 * 계약의 Chrome 하한에 맞춰 스캐너를 만든다.
 * minChrome이 정수가 아니거나 allowed 항목이 잘못됐으면 던진다.
 */
export function createScanner(options: {
  minChrome: number;
  allowed?: AllowedEntry[];
}): Scanner;
