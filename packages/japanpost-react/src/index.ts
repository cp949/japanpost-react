// ──────────────────────────────────────────────────────────────────────────────
// japanpost-react 공개 API 진입점
// 컴포넌트, 훅, 유틸리티, 타입을 모두 이 파일에서 내보낸다.
// ──────────────────────────────────────────────────────────────────────────────

// UI 컴포넌트
export { AddressSearchInput } from "./components/AddressSearchInput";
export { PostalCodeInput } from "./components/PostalCodeInput";

// 에러 생성 함수
export { createJapanAddressError } from "./core/errors";

// fetch 기반 data source 팩토리
export { createJapanPostApiDataSource } from "./core/dataSource";
export { createJapanPostFetchDataSource } from "./core/dataSource";

// 우편번호 포맷·정규화 유틸리티
export {
  formatJapanPostalCode,
  normalizeJapanPostalCode,
} from "./core/formatters";

// 주소 표시 유틸리티
export {
  formatJapanAddressDisplay,
  formatJapanAddressSearchResultLabel,
} from "./core/addressDisplay";

// 주소 레코드 정규화 유틸리티
export { normalizeJapanPostAddressRecord } from "./core/normalizers";

// 공개 타입
export type {
  JapanAddress,
  JapanPostApiClient,
  JapanPostApiDataSourceOptions,
  JapanPostAddresszipRequest,
  JapanPostFetchDataSourceOptions,
  JapanPostFetchDataSourcePaths,
  JapanPostSearchcodeRequest,
  Page,
} from "./core/types";
export type {
  AddressSearchInputProps,
  JapanAddressDataSource,
  JapanAddressError,
  JapanAddressErrorCode,
  JapanAddressSearchInput,
  JapanAddressRequestOptions,
  JapanAddressSearchResult,
  JapanPostalCodeLookupResult,
  JapanPostalCodeSearchInput,
  NormalizedJapanAddressRecord,
  PostalCodeInputProps,
  UseJapanAddressOptions,
  UseJapanAddressResult,
  UseJapanAddressSearchOptions,
  UseJapanAddressSearchResult,
  UseJapanPostalCodeOptions,
  UseJapanPostalCodeResult,
} from "./core/types";

// 우편번호 유효성 검사 유틸리티
export { isValidJapanPostalCode } from "./core/validators";

// React 훅
export { useJapanAddress } from "./react/useJapanAddress";
export { useJapanAddressSearch } from "./react/useJapanAddressSearch";
export { useJapanPostalCode } from "./react/useJapanPostalCode";
