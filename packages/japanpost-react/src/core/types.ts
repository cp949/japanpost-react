import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * 일본우정 API에서 반환되는 원본 주소 레코드 형태.
 * 공개 API 표면에는 직접 노출하지 않고 내부에서만 사용한다.
 */
export type JapanPostApiAddressRecord = {
  /*
   * 우편번호 (숫자 또는 문자열로 올 수 있음)
   */
  zip_code?: string | number | null;

  /*
   * 도도부현 코드
   */
  pref_code?: string | number | null;

  /*
   * 도도부현 이름 (예: 東京都)
   */
  pref_name?: string | null;

  /*
   * 도도부현 이름 (가나 표기)
   */
  pref_kana?: string | null;

  /*
   * 시구정촌 이름
   */
  city_name?: string | null;

  /*
   * 시구정촌 이름 (가나 표기)
   */
  city_kana?: string | null;

  /*
   * 동·번지 이름
   */
  town_name?: string | null;

  /*
   * 동·번지 이름 (가나 표기)
   */
  town_kana?: string | null;

  /*
   * 블록(번지) 정보
   */
  block_name?: string | null;

  /*
   * 기타 주소 정보
   */
  other_name?: string | null;

  /*
   * 업스트림이 주는 원본 전체 주소 문자열
   * 구조화된 필드와 의미가 겹칠 수 있으므로 그대로 이어붙일 때는 주의가 필요하다.
   */
  address?: string | null;
};

/**
 * 우편번호로 주소를 검색할 때(searchcode) API 응답 형태.
 */
export type JapanPostSearchCodeResponse = {
  /*
   * 검색된 주소 목록
   */
  addresses?: JapanPostApiAddressRecord[] | null;

  /*
   * API 메시지 (오류 시 포함)
   */
  message?: string | null;

  /*
   * HTTP 상태 코드
   */
  status?: number;
};

/**
 * 주소 키워드로 검색할 때(addresszip) API 응답 형태.
 */
export type JapanPostAddressZipResponse = {
  /*
   * 검색된 주소 목록
   */
  addresses?: JapanPostApiAddressRecord[] | null;

  /*
   * API 메시지 (오류 시 포함)
   */
  message?: string | null;

  /*
   * HTTP 상태 코드
   */
  status?: number;
};

// 두 응답 타입을 하나로 묶은 유니온 타입
export type JapanPostApiResponse =
  | JapanPostSearchCodeResponse
  | JapanPostAddressZipResponse;

/**
 * API 응답을 정규화한 후의 중간 주소 레코드 형태.
 * 내부 data source 처리 후 공개 JapanAddress 타입으로 변환되기 전에 사용된다.
 */
export type NormalizedJapanAddressRecord = {
  /*
   * 정규화된 7자리 우편번호
   */
  postalCode: string;

  /*
   * 도도부현 이름
   */
  prefecture: string;

  /*
   * 도도부현 이름 (가나)
   */
  prefectureKana?: string;

  /*
   * 시구정촌 이름
   */
  city: string;

  /*
   * 시구정촌 이름 (가나)
   */
  cityKana?: string;

  /*
   * 동·번지 이름
   */
  town: string;

  /*
   * 동·번지 이름 (가나)
   */
  townKana?: string;

  /*
   * 블록·기타 상세 주소
   */
  detail?: string;
};

/**
 * 라이브러리 공개 주소 타입. 훅과 클라이언트가 외부로 반환하는 최종 형태.
 */
export type JapanAddress = {
  /*
   * 우편번호 (7자리 숫자)
   */
  postalCode: string;

  /*
   * 도도부현
   */
  prefecture: string;

  /*
   * 도도부현 (가나)
   */
  prefectureKana?: string;

  /*
   * 시구정촌
   */
  city: string;

  /*
   * 시구정촌 (가나)
   */
  cityKana?: string;

  /*
   * 동·번지
   */
  town: string;

  /*
   * 동·번지 (가나)
   */
  townKana?: string;

  /*
   * 공백으로 이어붙인 전체 주소
   */
  address: string;

  /*
   * 데이터 출처 식별자
   */
  provider: "japan-post";
};

/**
 * Kotlin/minimal-api와 호환되는 공개 페이징 응답 타입.
 */
export type Page<T> = {
  /*
   * 현재 페이지 요소 목록
   */
  elements: T[];

  /*
   * 전체 요소 수
   */
  totalElements: number;

  /*
   * 현재 페이지 번호 (0-based)
   */
  pageNumber: number;

  /*
   * 페이지당 요소 수
   */
  rowsPerPage: number;
};

/**
 * 우편번호 조회 결과. Kotlin/minimal-api와 동일하게 pager payload를 그대로 반환한다.
 */
export type JapanPostalCodeLookupResult = Page<JapanAddress>;

/**
 * 키워드 주소 검색 결과. Kotlin/minimal-api와 동일하게 pager payload를 그대로 반환한다.
 */
export type JapanAddressSearchResult = Page<JapanAddress>;

/**
 * 라이브러리 전용 오류 코드 목록.
 */
export type JapanAddressErrorCode =
  | "invalid_postal_code" // 유효하지 않은 우편번호 형식
  | "invalid_query"       // 빈 검색어 등 유효하지 않은 쿼리
  | "network_error"       // 네트워크 통신 실패
  | "timeout"             // 요청 시간 초과
  | "not_found"           // 해당하는 주소 없음
  | "bad_response"        // API가 예상치 못한 응답을 반환함
  | "data_source_error";  // 기타 data source 레벨 오류

/**
 * 라이브러리 전용 에러 타입. 훅과 data source 전반에서 일관되게 사용된다.
 */
export type JapanAddressError = Error & {
  /*
   * 에러 식별자 (instanceof 대신 name으로 구분)
   */
  name: "JapanAddressError";

  /*
   * 세분화된 오류 코드
   */
  code: JapanAddressErrorCode;

  /*
   * 원인이 된 원본 에러
   */
  cause?: unknown;

  /*
   * HTTP 상태 코드 (해당하는 경우)
   */
  status?: number;
};

/**
 * data source 요청에 전달할 선택 옵션.
 */
export type JapanAddressRequestOptions = {
  /*
   * 요청 취소용 AbortSignal
   */
  signal?: AbortSignal;
};

/**
 * 주소 데이터를 제공하는 data source 인터페이스.
 * 커스텀 구현체로 교체할 수 있도록 추상화되어 있다.
 */
export type JapanAddressDataSource = {
  lookupPostalCode: (
    postalCode: string,
    options?: JapanAddressRequestOptions,
  ) => Promise<Page<JapanAddress>>;
  searchAddress: (
    query: string,
    options?: JapanAddressRequestOptions,
  ) => Promise<Page<JapanAddress>>;
};

/**
 * useJapanPostalCode 훅 옵션
 */
export type UseJapanPostalCodeOptions = {
  /*
   * 주소 조회에 사용할 data source
   */
  dataSource: JapanAddressDataSource;
};

/**
 * useJapanAddressSearch 훅 옵션
 */
export type UseJapanAddressSearchOptions = {
  /*
   * 주소 조회에 사용할 data source
   */
  dataSource: JapanAddressDataSource;

  /*
   * 디바운스 지연 시간 (ms)
   */
  debounceMs?: number;
};

/**
 * useJapanAddress 훅 옵션
 */
export type UseJapanAddressOptions = {
  /*
   * 주소 조회에 사용할 data source
   */
  dataSource: JapanAddressDataSource;

  /*
   * 키워드 검색 디바운스 지연 시간 (ms)
   */
  debounceMs?: number;
};

/**
 * 비동기 데이터 로딩 상태를 표현하는 제네릭 타입.
 */
export type UseAsyncState<T> = {
  /*
   * 요청 진행 중 여부
   */
  loading: boolean;

  /*
   * 성공 시 결과 데이터
   */
  data: T | null;

  /*
   * 실패 시 에러 객체
   */
  error: JapanAddressError | null;
};

/**
 * useJapanPostalCode 훅의 반환 타입
 */
export type UseJapanPostalCodeResult =
  UseAsyncState<JapanPostalCodeLookupResult> & {
    /*
     * 상태 초기화
     */
    reset: () => void;

    /*
     * 우편번호로 주소를 조회한다
     */
    search: (value: string) => Promise<JapanPostalCodeLookupResult | null>;
  };

/**
 * useJapanAddressSearch 훅의 반환 타입
 */
export type UseJapanAddressSearchResult =
  UseAsyncState<JapanAddressSearchResult> & {
    /*
     * 상태 초기화
     */
    reset: () => void;

    /*
     * 키워드로 주소를 검색한다
     */
    search: (query: string) => Promise<JapanAddressSearchResult | null>;
  };

/**
 * useJapanAddress 훅의 반환 타입 (우편번호·키워드 통합)
 */
export type UseJapanAddressResult = UseAsyncState<Page<JapanAddress>> & {
  /*
   * 상태 초기화
   */
  reset: () => void;

  /*
   * 우편번호로 주소를 조회한다
   */
  searchByPostalCode: (
    value: string,
  ) => Promise<JapanPostalCodeLookupResult | null>;

  /*
   * 키워드로 주소를 검색한다
   */
  searchByKeyword: (query: string) => Promise<JapanAddressSearchResult | null>;
};

/**
 * 검색 입력 컴포넌트들이 공유하는 공통 props
 */
type BaseTextSearchInputProps = {
  /*
   * 비제어 모드 초기값
   */
  defaultValue?: string;

  /*
   * 제어 모드 값
   */
  value?: string;

  /*
   * 입력 비활성화 여부
   */
  disabled?: boolean;

  /*
   * 입력 필드 라벨
   */
  label?: ReactNode;

  /*
   * 검색 버튼 라벨
   */
  buttonLabel?: ReactNode;

  /*
   * input 요소에 그대로 전달할 네이티브 props
   */
  inputProps?: Omit<
    ComponentPropsWithoutRef<"input">,
    "defaultValue" | "disabled" | "onChange" | "value"
  >;

  /*
   * button 요소에 그대로 전달할 네이티브 props
   */
  buttonProps?: Omit<
    ComponentPropsWithoutRef<"button">,
    "children" | "disabled" | "onClick" | "type"
  >;
};

/**
 * PostalCodeInput 컴포넌트 props
 */
export type PostalCodeInputProps = BaseTextSearchInputProps & {

  /*
   * 값 변경 콜백
   */
  onChange?: (postalCode: string) => void;

  /*
   * 폼 제출(검색) 콜백
   */
  onSearch: (postalCode: string) => void;
};

/**
 * AddressSearchInput 컴포넌트 props
 */
export type AddressSearchInputProps = BaseTextSearchInputProps & {
  /*
   * 값 변경 콜백
   */
  onChange?: (query: string) => void;

  /*
   * 폼 제출(검색) 콜백
   */
  onSearch: (query: string) => void;
};
