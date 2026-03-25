import {
  formatJapanPostalCode,
  type JapanAddress,
} from "@cp949/japanpost-react";

// 라이브러리 응답에는 공백과 줄바꿈이 섞일 수 있어
// 데모 화면에서는 하나의 깔끔한 주소 문자열로 정규화해 사용한다.
export function formatJapanAddressDisplay(address: JapanAddress): string {
  return address.address.replace(/\s+/g, " ").trim();
}

// 검색 결과 항목에 접근성 라벨을 줄 때는
// 우편번호와 정리된 주소를 함께 붙여서 읽히도록 구성한다.
export function formatJapanAddressSearchResultLabel(
  address: JapanAddress,
): string {
  return `${formatJapanPostalCode(address.postalCode)} ${formatJapanAddressDisplay(address)}`;
}
