import type { JapanAddress, NormalizedJapanAddressRecord } from "./types";

/**
 * 내부 정규화 레코드를 최종 공개 계약으로 변환하는 모듈이다.
 * 업스트림별 원본 필드 차이는 이 단계 이전에 흡수하고, 여기서는 라이브러리 공개 형태만 조립한다.
 */

/**
 * 빈 문자열을 제거한 뒤 공백으로 이어붙여 전체 주소 문자열을 만든다.
 * 예: ["東京都", "千代田区", "丸の内"] → "東京都 千代田区 丸の内"
 */
function joinAddressParts(parts: string[]): string {
  return parts.filter(Boolean).join(" ").trim();
}

/**
 * 정규화된 내부 주소 레코드를 라이브러리 공개 JapanAddress 형태로 변환한다.
 * address는 표시용 convenience 필드이므로, 구조화된 필드와 같은 순서를 유지해 예측 가능성을 보장한다.
 */
export function normalizeJapanPostAddressRecord(
  record: NormalizedJapanAddressRecord,
): JapanAddress {
  // 각 주소 파트를 공백으로 연결해 표시용 주소 문자열 생성
  const address = joinAddressParts([
    record.prefecture,
    record.city,
    record.town,
    record.detail ?? "",
  ]);

  return {
    postalCode: record.postalCode,
    prefecture: record.prefecture,
    prefectureKana: record.prefectureKana,
    city: record.city,
    cityKana: record.cityKana,
    town: record.town,
    townKana: record.townKana,
    address,
    provider: "japan-post",
  };
}
