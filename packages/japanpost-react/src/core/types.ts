import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * `japanpost-react`의 공개 계약과 내부 정규화 계약을 한 곳에 모아 둔 타입 모음이다.
 * 훅, 입력 컴포넌트, data source, minimal-api 연동 예제가 모두 이 정의를 기준으로 맞물리므로
 * 필드 의미를 바꿀 때는 런타임 동작뿐 아니라 외부 사용자의 기대 계약도 함께 고려해야 한다.
 */

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
 * minimal-api가 그대로 받는 공개 searchcode 요청 타입이다.
 * pageNumber/rowsPerPage를 노출하는 이유는 라이브러리와 API 예제가 같은 pager 의미 체계를 공유하기 위해서다.
 */
export type JapanPostSearchcodeRequest = {
  /*
   * 검색할 우편번호 값
   */
  postalCode: string;

  /*
   * 현재 페이지 번호 (0-based)
   */
  pageNumber: number;

  /*
   * 페이지당 요소 수
   */
  rowsPerPage: number;

  /*
   * 괄호 포함 마을명 반환 여부
   */
  includeParenthesesTown?: boolean | null;
};

/**
 * useJapanPostalCode의 공개 검색 입력 타입.
 * 문자열 입력은 기존 호환성을 유지하고, 객체 입력은 pager 옵션을 함께 전달할 수 있게 한다.
 */
export type JapanPostalCodeSearchInput =
  | string
  | {
      postalCode: string;
      pageNumber?: number;
      rowsPerPage?: number;
      includeParenthesesTown?: boolean | null;
    };

/**
 * useJapanAddressSearch의 공개 검색 입력 타입.
 * 문자열 입력은 키워드 검색 호환성을 유지하고, 객체 입력은 자유 검색과 구조화 검색 필드를 함께 전달할 수 있게 한다.
 */
export type JapanAddressSearchInput =
  | string
  | (Omit<JapanPostAddresszipRequest, "pageNumber" | "rowsPerPage"> & {
      pageNumber?: number;
      rowsPerPage?: number;
    });

/**
 * minimal-api가 그대로 받는 공개 addresszip 요청 타입이다.
 * 자유 검색(addressQuery)뿐 아니라 구조화 검색 필드도 함께 열어 두어
 * 상위 UI가 필요한 만큼만 업스트림 검색 축을 선택적으로 노출할 수 있게 한다.
 */
export type JapanPostAddresszipRequest = {
  addressQuery?: string | null;
  prefCode?: string | null;
  prefName?: string | null;
  prefKana?: string | null;
  prefRoma?: string | null;
  cityCode?: string | null;
  cityName?: string | null;
  cityKana?: string | null;
  cityRoma?: string | null;
  townName?: string | null;
  townKana?: string | null;
  townRoma?: string | null;
  pageNumber: number;
  rowsPerPage: number;
  includeCityDetails?: boolean | null;
  includePrefectureDetails?: boolean | null;
};

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
 * `address`는 표시 편의를 위한 결합 문자열이고, 나머지 필드는 후처리/재조합이 가능한 구조화 값이다.
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
 * minimal-api와 라이브러리가 공통으로 사용하는 pager 응답 계약이다.
 * 페이지 기반 UI가 아니더라도 total/page 정보를 유지해 "결과 없음"과 "일부만 조회됨"을 구분할 수 있다.
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
 * 우편번호 조회 결과.
 * 단일 주소만 기대하는 소비자도 있을 수 있지만, 업스트림 계약이 목록 + 페이징이므로 그대로 보존한다.
 */
export type JapanPostalCodeLookupResult = Page<JapanAddress>;

/**
 * 주소 검색 결과.
 * 키워드 검색과 구조화 검색 모두 postal code 조회와 같은 pager 형태를 사용해
 * 두 검색 모드를 같은 UI로 렌더링할 수 있게 한다.
 */
export type JapanAddressSearchResult = Page<JapanAddress>;

/**
 * 라이브러리 전용 오류 코드 목록.
 * 소비자는 message 문자열보다 code를 기준으로 UX를 분기하는 것이 안전하다.
 */
export type JapanAddressErrorCode =
  | "invalid_postal_code" // 유효하지 않은 우편번호 형식
  | "invalid_query" // 빈 검색어 등 유효하지 않은 쿼리
  | "network_error" // 네트워크 통신 실패
  | "timeout" // 요청 시간 초과
  | "not_found" // 해당하는 주소 없음
  | "bad_response" // API가 예상치 못한 응답을 반환함
  | "data_source_error"; // 기타 data source 레벨 오류

/**
 * 라이브러리 전용 에러 타입. 훅과 data source 전반에서 일관되게 사용된다.
 * 브라우저/서버/사용자 입력 오류를 모두 같은 형태로 감싸 public contract를 단순화한다.
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
 * 현재는 AbortSignal만 쓰지만, 추후 timeout/metadata가 필요해져도 호출부 시그니처를 크게 흔들지 않기 위한 확장 지점이다.
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
 * 즉, 훅은 fetch 구현을 모르고 pager 계약과 에러 계약만 신뢰한다.
 */
export type JapanAddressDataSource = {
  lookupPostalCode: (
    request: JapanPostSearchcodeRequest,
    options?: JapanAddressRequestOptions,
  ) => Promise<Page<JapanAddress>>;
  searchAddress: (
    request: JapanPostAddresszipRequest,
    options?: JapanAddressRequestOptions,
  ) => Promise<Page<JapanAddress>>;
};

/**
 * fetch 기반 data source가 사용할 endpoint 경로 오버라이드.
 * 기본 경로를 유지하되, minimal-api 래퍼나 커스텀 백엔드가 다른 라우팅을 쓰는 경우에만 선택적으로 덮어쓴다.
 */
export type JapanPostFetchDataSourcePaths = {
  lookupPostalCode?: string;
  searchAddress?: string;
};

/**
 * Japan Post fetch data source factory 옵션.
 * `baseUrl`만 필수이고, `fetch`/`paths`/`resolveErrorCode`는
 * 테스트나 커스텀 백엔드 계약에 맞출 때만 선택적으로 바꾼다.
 */
export type JapanPostFetchDataSourceOptions = {
  baseUrl: string;
  fetch?: typeof fetch;
  paths?: JapanPostFetchDataSourcePaths;
  resolveErrorCode?: (status: number, path: string) => JapanAddressErrorCode;
};

/**
 * Japan Post API 클라이언트 계약.
 * 앱이 이미 보유한 `searchcode` / `addresszip` 메서드에
 * `createJapanPostApiDataSource`를 연결하기 위한 최소 계약이다.
 */
export type JapanPostApiClient<
  TContext = unknown,
  TPage = Page<JapanAddress>,
> = {
  searchcode: (
    request: JapanPostSearchcodeRequest & { ctx?: TContext },
  ) => Promise<TPage>;
  addresszip: (
    request: JapanPostAddresszipRequest & { ctx?: TContext },
  ) => Promise<TPage>;
};

/**
 * Japan Post API 클라이언트 data source 어댑터 옵션.
 * `createContext`는 요청별 `ctx`를 주입하고,
 * `mapPage`는 업스트림 반환 타입이 기본 `Page<JapanAddress>`가 아닐 때만 필요하다.
 */
export type JapanPostApiDataSourceOptions<
  TContext = unknown,
  TPage = Page<JapanAddress>,
> = {
  createContext?: (
    options?: JapanAddressRequestOptions,
  ) => TContext | undefined;
  mapPage?: (page: TPage) => Page<JapanAddress>;
};

/**
 * useJapanPostalCode 훅 옵션.
 * data source 주입 방식으로 브라우저 직접 호출, BFF, mock을 모두 같은 훅으로 다룬다.
 */
export type UseJapanPostalCodeOptions = {
  /*
   * 주소 조회에 사용할 data source
   */
  dataSource: JapanAddressDataSource;
};

/**
 * useJapanAddressSearch 훅 옵션.
 * debounce는 UI 입력 빈도를 제어하기 위한 것이며 data source 계약을 바꾸지 않는다.
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
 * useJapanAddress 훅 옵션.
 * 통합 훅도 내부적으로는 두 검색 훅을 조합하므로 필요한 옵션만 얇게 위임한다.
 */
export type UseJapanAddressOptions = {
  /*
   * 주소 조회에 사용할 data source
   */
  dataSource: JapanAddressDataSource;

  /*
   * 주소 검색 디바운스 지연 시간 (ms)
   */
  debounceMs?: number;
};

/**
 * 비동기 데이터 로딩 상태를 표현하는 제네릭 타입.
 * 모든 훅이 같은 상태 모양을 공유하면 소비자 컴포넌트가 검색 종류와 무관하게 공통 렌더링 로직을 가질 수 있다.
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
 * useJapanPostalCode 훅의 반환 타입.
 * search는 실패나 취소 시 null을 반환해 UI가 try/catch 없이도 분기할 수 있게 한다.
 */
export type UseJapanPostalCodeResult =
  UseAsyncState<JapanPostalCodeLookupResult> & {
    /*
     * 진행 중인 검색을 취소한다
     */
    cancel: () => void;

    /*
     * 상태 초기화
     */
    reset: () => void;

    /*
     * 우편번호로 주소를 조회한다
     */
    search: (
      input: JapanPostalCodeSearchInput,
    ) => Promise<JapanPostalCodeLookupResult | null>;
  };

/**
 * useJapanAddressSearch 훅의 반환 타입.
 * debounce 취소와 오류 모두 Promise 결과 관점에서는 null로 귀결될 수 있으므로 호출부는 state와 함께 해석해야 한다.
 */
export type UseJapanAddressSearchResult =
  UseAsyncState<JapanAddressSearchResult> & {
    /*
     * 진행 중인 검색을 취소한다
     */
    cancel: () => void;

    /*
     * 상태 초기화
     */
    reset: () => void;

    /*
     * 문자열 또는 구조화된 입력으로 주소를 검색한다
     */
    search: (
      input: JapanAddressSearchInput,
    ) => Promise<JapanAddressSearchResult | null>;
  };

/**
 * useJapanAddress 훅의 반환 타입.
 * data/error는 "현재 활성 검색 모드" 기준 값이며, 두 내부 훅의 상태 전체를 그대로 노출하지는 않는다.
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
    input: JapanPostalCodeSearchInput,
  ) => Promise<JapanPostalCodeLookupResult | null>;

  /*
   * 주소 질의 또는 구조화된 주소 필드로 검색한다
   */
  searchByAddressQuery: (
    input: JapanAddressSearchInput,
  ) => Promise<JapanAddressSearchResult | null>;
};

/**
 * 검색 입력 컴포넌트들이 공유하는 공통 props.
 * 제어/비제어 모드를 모두 지원해 폼 라이브러리와 단순 데모 예제를 같은 컴포넌트로 소화한다.
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
 * PostalCodeInput 컴포넌트 props.
 * onSearch는 표시 문자열이 아니라 정규화된 우편번호를 받는다는 점이 핵심 계약이다.
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
 * AddressSearchInput 컴포넌트 props.
 * onSearch에는 trim 처리된 검색어가 전달되어 공백만 다른 입력이 별도 쿼리로 취급되지 않게 한다.
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
