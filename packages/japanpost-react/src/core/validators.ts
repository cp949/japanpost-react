import { normalizeJapanPostalCode } from "./formatters";

/**
 * 입력값을 정규화했을 때 정확히 7자리 숫자인지 검사한다.
 * 하이픈(-)이 포함된 "123-4567" 형태도 유효로 판정된다.
 */
export function isValidJapanPostalCode(value: string): boolean {
  // 정규화 후 숫자 7자리인지 정규식으로 확인
  return /^\d{7}$/.test(normalizeJapanPostalCode(value));
}
