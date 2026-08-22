/** BCD에서 파생한 항목 하나다. */
export interface CompatEntry {
  /** Chrome 도입 버전. 미지원·프리뷰 전용은 Infinity다. */
  chrome: number;
  /** 파생 근거가 된 BCD 키 경로. 진단용이다. */
  path: string;
}

/** 수신자 타입을 모르는 멤버 후보다. */
export interface MemberEntry {
  /** 모든 소유 타입 중 최소 Chrome 도입 버전이다. */
  chrome: number;
  /** 이 이름을 가진 소유 타입의 BCD 경로 목록이다. */
  owners: string[];
}

/** 계약의 Chrome 하한에 맞춰 파생한 판정 색인이다. */
export interface CompatIndex {
  /** 파생 기준이 된 Chrome 하한이다. */
  minChrome: number;
  /** 전역 식별자. 키는 전역 이름이다. 예: "structuredClone" */
  globals: Map<string, CompatEntry>;
  /**
   * 전역의 static 멤버 + api.*의 instance 멤버. 키는 "소유.멤버"다.
   * static의 예: "Object.hasOwn". api.* instance의 예: "Crypto.randomUUID" —
   * knownGlobalTypes가 "crypto" → "Crypto"로 잇는 조회가 여기로 들어온다.
   * 2,770개 항목(minChrome 80) 중 2,555개가 여기 있다 — 대부분은 api.*
   * instance 멤버이지 static이 아니다.
   */
  statics: Map<string, CompatEntry>;
  /** 수신자 미상 멤버. 키는 멤버 이름이다. 예: "at", "reason" */
  members: Map<string, MemberEntry>;
  /** 옵션·파라미터 서브피처. 키는 "Error.cause", "addEventListener.signal"이다. */
  special: Map<string, CompatEntry>;
  /** 타입이 고정된 전역과 그 인터페이스다. 예: "crypto" → "Crypto" */
  knownGlobalTypes: Map<string, string>;
}

/**
 * BCD support.chrome 값 하나를 Chrome 도입 버전 숫자로 바꾼다.
 * 판정할 수 없으면 null이다.
 */
export function normalizeChromeSupport(support: unknown): number | null;

/**
 * 계약의 Chrome 하한에 맞춰 판정 색인을 만든다.
 * minChrome이 정수가 아니거나 색인이 비면 던진다.
 */
export function buildCompatIndex(options: { minChrome: number }): CompatIndex;
