/**
 * 우편번호에서 숫자가 아닌 문자(하이픈 등)를 제거해 순수 숫자 문자열로 만든다.
 * 예: "123-4567" → "1234567"
 */
export function normalizeJapanPostalCode(value: string): string {
  // 숫자 이외의 모든 문자를 제거
  return value.replace(/[^\d]/g, "");
}

/**
 * 우편번호를 "NNN-NNNN" 형식으로 포맷한다.
 * 정확히 7자리가 아닐 때는 하이픈 없이 숫자만 반환한다.
 * 예: "1234567" → "123-4567"
 */
export function formatJapanPostalCode(value: string): string {
  // 먼저 숫자만 남기도록 정규화
  const normalized = normalizeJapanPostalCode(value);

  // 정확히 7자리가 아니면 포맷을 확정하지 않는다
  if (normalized.length !== 7) {
    return normalized;
  }

  // 앞 3자리와 나머지를 하이픈으로 연결
  return `${normalized.slice(0, 3)}-${normalized.slice(3)}`;
}
