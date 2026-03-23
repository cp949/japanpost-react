import type { JapanAddress } from "@cp949/japanpost-react";

/**
 * Japan Post minimal-api adapter가 사용하는 타입 모음.
 *
 * 이 파일은 두 범주의 타입을 함께 둔다.
 * 1. Japan Post upstream 요청/응답 payload 타입
 * 2. adapter 외부 계약과 내부 상태를 설명하는 타입
 *
 * 특히 upstream 쪽 타입은 "공식 스펙 전체"가 아니라 현재 이 저장소의 adapter가
 * 실제로 읽거나 조립하는 subset을 우선 모델링한다. 따라서 공식 응답에 더 많은
 * 필드가 있더라도, 여기서는 현재 코드 경로에 의미가 있는 필드만 유지한다.
 */

/**
 * 토큰 발급 응답의 subset.
 *
 * 대응 upstream:
 * - `POST /api/v2/j/token`
 *
 * 현재 adapter 사용 방식:
 * - `token`은 이후 모든 주소 조회 요청의 `Authorization: Bearer ...` 값으로 사용한다.
 * - `expires_in`은 토큰 캐시 만료 시각 계산에 사용한다.
 * - `token_type`은 현재 로직에서 직접 사용하지 않지만, 토큰 응답 구조를 읽기 쉽게
 *   남겨 둔 필드다.
 */
export type JapanPostTokenResponse = {
  /**
   * access token 문자열.
   * 없으면 adapter는 "토큰 응답이 비정상"이라고 판단하고 502로 처리한다.
   */
  token?: string;

  /**
   * 토큰 종류. 일반적으로 bearer 계열 응답에서 내려오지만, 현재 adapter는 값을
   * 분기하지 않고 `Bearer <token>` 형식으로 고정해서 사용한다.
   */
  token_type?: string;

  /**
   * 토큰 유효 기간(초 단위).
   * 현재 adapter는 이 값을 기준으로 `expiresAt`을 계산하고, 최소 60초 보장을 둔다.
   */
  expires_in?: number;
};

/**
 * Japan Post 오류 응답의 subset.
 *
 * 대응 upstream:
 * - 토큰 발급 실패 응답
 * - `searchcode`, `addresszip` 요청 실패 응답
 *
 * 현재 adapter 사용 방식:
 * - `message`를 우선 사용자 친화적인 에러 문구로 사용한다.
 * - `error_code`, `request_id`는 원인 추적을 돕기 위해 에러 메시지 뒤에 덧붙인다.
 */
export type JapanPostErrorResponse = {
  /**
   * upstream 오류 코드.
   * 현재 adapter는 별도 분기 키로 쓰지 않고, 문자열 메시지에만 포함한다.
   */
  error_code?: string;

  /**
   * upstream이 제공하는 설명 메시지.
   * 있으면 `readErrorMessage()`가 기본 메시지 뒤에 이어 붙인다.
   */
  message?: string;

  /**
   * upstream 요청 추적용 식별자.
   * 운영 환경에서 문의나 장애 분석 시 유용한 메타데이터라서 메시지에 보존한다.
   */
  request_id?: string;
};

/**
 * `searchcode` / `addresszip` 응답의 주소 레코드 subset.
 *
 * 대응 upstream:
 * - `GET /api/v2/searchcode/{search_code}` 의 `addresses[]`
 * - `POST /api/v2/addresszip` 의 `addresses[]`
 *
 * 주의:
 * - 이름은 기존 adapter 코드와 diff를 최소화하려고 `JapanPostSearchCodeAddress`를 유지한다.
 * - 실제로는 `searchcode` 전용 타입이 아니라 두 엔드포인트가 공통으로 돌려주는
 *   주소 레코드의 "현재 adapter 사용 subset"이다.
 * - 공식 응답에는 `pref_code`, `city_code`, `roma`, 좌표 등 더 많은 필드가 있지만,
 *   현재 정규화 로직은 아래 필드만 읽는다.
 */
export type JapanPostSearchCodeAddress = {
  /**
   * 우편번호.
   * upstream이 문자열/숫자 어느 쪽으로 보내도 adapter가 숫자만 남겨 7자리로 정규화한다.
   */
  zip_code?: string | number | null;

  /**
   * 도도부현명.
   * `normalizeAddressRecord()`에서 `prefecture`로 매핑한다.
   */
  pref_name?: string | null;

  /**
   * 도도부현명 가나 표기.
   * 비어 있지 않으면 `prefectureKana`로 전달한다.
   */
  pref_kana?: string | null;

  /**
   * 시구정촌명.
   * `normalizeAddressRecord()`에서 `city`로 사용한다.
   */
  city_name?: string | null;

  /**
   * 시구정촌명 가나 표기.
   * 비어 있지 않으면 `cityKana`로 전달한다.
   */
  city_kana?: string | null;

  /**
   * 町域/동네 이름.
   * searchcode의 `choikitype` 설정에 따라 괄호 포함 여부가 달라질 수 있다.
   */
  town_name?: string | null;

  /**
   * 町域/동네 이름의 가나 표기.
   */
  town_kana?: string | null;

  /**
   * 번지/블록 이름.
   * 현재 adapter는 구조화 주소를 만들 때 `pref_name`, `city_name`, `town_name` 뒤에
   * 이어 붙인다.
   */
  block_name?: string | null;

  /**
   * 기타 상세 주소.
   * 현재 adapter는 구조화 주소 조합 시 마지막 조각으로 사용한다.
   */
  other_name?: string | null;

  /**
   * upstream이 이미 조합해서 내려주는 원본 전체 주소 문자열.
   * 현재 adapter는 구조화 주소와 비교해 중복이 적은 쪽을 최종 `address`로 선택한다.
   */
  address?: string | null;
};

/**
 * `searchcode` 응답 payload의 subset.
 *
 * 대응 upstream:
 * - `GET /api/v2/searchcode/{search_code}`
 *
 * 현재 adapter 사용 방식:
 * - `addresses` 배열만 사용한다.
 * - 배열이 아니면 upstream 계약 위반으로 간주하고 502를 던진다.
 */
export type JapanPostSearchCodeResponse = {
  /**
   * 검색 결과 주소 목록.
   * 우편번호 prefix 조회를 허용하는 현재 adapter에서는 0건일 수 있고, 그 경우 404로
   * 변환되기 전에 먼저 빈 배열인지 검사한다.
   */
  addresses?: JapanPostSearchCodeAddress[] | null;
};

/**
 * `searchcode` 요청의 `choikitype` 제한 값.
 *
 * 대응 upstream:
 * - `GET /api/v2/searchcode/{search_code}?choikitype=...`
 *
 * 값 의미:
 * - `1`: 괄호 없는 町域 필드를 반환한다.
 * - `2`: 괄호 있는 町域 필드를 반환한다.
 *
 * 현재 adapter 사용 방식:
 * - `JAPAN_POST_SEARCH_CODE_CHOIKITYPE` env 값이 `"1"` 또는 `"2"`일 때만 query에 넣는다.
 * - 설정이 없거나 다른 값이면 upstream 기본값에 맡긴다.
 */
export type JapanPostSearchCodeChoikiType = 1 | 2;

/**
 * `searchcode` 요청의 `searchtype` 제한 값.
 *
 * 대응 upstream:
 * - `GET /api/v2/searchcode/{search_code}?searchtype=...`
 *
 * 값 의미:
 * - `1`: 우편번호, 사업소 개별 우편번호, 디지털 주소를 모두 검색한다.
 * - `2`: 우편번호와 디지털 주소만 검색하고, 사업소 개별 우편번호는 제외한다.
 *
 * 현재 adapter 사용 방식:
 * - `JAPAN_POST_SEARCH_CODE_SEARCHTYPE` env 값이 `"1"` 또는 `"2"`일 때만 query에 넣는다.
 * - 설정이 없으면 upstream 기본 검색 범위를 그대로 사용한다.
 */
export type JapanPostSearchCodeSearchType = 1 | 2;

/**
 * `searchcode` 요청 query parameter의 현재 모델.
 *
 * 대응 upstream:
 * - `GET /api/v2/searchcode/{search_code}`
 *
 * 현재 adapter 사용 방식:
 * - `ec_uid`, `choikitype`, `searchtype`만 env 기반으로 조건부 전송한다.
 * - `page`, `limit`는 타입으로는 열어 두었지만 현재 구현에서는 보내지 않는다.
 */
export type JapanPostSearchCodeQuery = {
  /**
   * 페이지 번호.
   * upstream은 지원하지만 현재 저장소의 adapter는 값을 채우지 않고 기본값을 따른다.
   */
  page?: number;

  /**
   * 최대 조회 건수.
   * upstream은 지원하지만 현재 저장소의 adapter는 값을 채우지 않고 기본값을 따른다.
   */
  limit?: number;

  /**
   * provider 쪽 사용자 식별자.
   * 현재 adapter는 `JAPAN_POST_EC_UID`가 설정된 경우에만 query string에 넣는다.
   */
  ec_uid?: string;

  /**
   * 町域 필드 반환 방식 선택.
   */
  choikitype?: JapanPostSearchCodeChoikiType;

  /**
   * 검색 대상 범위 선택.
   */
  searchtype?: JapanPostSearchCodeSearchType;
};

/**
 * `addresszip` 응답 payload의 subset.
 *
 * 대응 upstream:
 * - `POST /api/v2/addresszip`
 *
 * 현재 adapter 사용 방식:
 * - `searchcode`와 마찬가지로 `addresses` 배열만 읽고 `JapanAddress[]`로 정규화한다.
 */
export type JapanPostAddressZipResponse = {
  /**
   * 검색 결과 주소 목록.
   */
  addresses?: JapanPostSearchCodeAddress[] | null;
};

/**
 * `addresszip`의 목록 범위 제어 플래그 공통 타입.
 *
 * 대응 upstream:
 * - `flg_getcity`
 * - `flg_getpref`
 *
 * 값 의미:
 * - `0`: 전체 주소 레코드를 반환한다.
 * - `1`: 해당 레벨 목록만 반환한다.
 *
 * 현재 adapter 사용 방식:
 * - 자유어 검색에서는 둘 다 `0`으로 고정해서, 시/도도부현 목록만 축약해서 받지 않고
 *   실제 주소 레코드를 받는다.
 */
export type JapanPostAddressZipFlag = 0 | 1;

/**
 * `addresszip` 요청 body의 현재 모델.
 *
 * 대응 upstream:
 * - `POST /api/v2/addresszip`
 *
 * 주의:
 * - upstream은 여러 검색 조합을 허용한다.
 * - 현재 저장소의 adapter는 이 타입 중에서도 `freeword` 기반 subset만 실제로 쓴다.
 */
export type JapanPostAddressZipRequestBody = {
  /**
   * 도도부현 코드 검색.
   * 현재 adapter는 사용하지 않지만 upstream 조합 가능성을 문서화하기 위해 남겨 둔다.
   */
  pref_code?: string;

  /**
   * 도도부현명 검색.
   */
  pref_name?: string;

  /**
   * 도도부현명 가나 검색.
   */
  pref_kana?: string;

  /**
   * 도도부현명 로마자 검색.
   */
  pref_roma?: string;

  /**
   * 시구정촌 코드 검색.
   */
  city_code?: string;

  /**
   * 시구정촌명 검색.
   */
  city_name?: string;

  /**
   * 시구정촌명 가나 검색.
   */
  city_kana?: string;

  /**
   * 시구정촌명 로마자 검색.
   */
  city_roma?: string;

  /**
   * 町域명 검색.
   */
  town_name?: string;

  /**
   * 町域명 가나 검색.
   */
  town_kana?: string;

  /**
   * 町域명 로마자 검색.
   */
  town_roma?: string;

  /**
   * 자유어 검색 문자열.
   * 현재 저장소의 `searchAddress()`는 항상 이 필드만 채운다.
   */
  freeword?: string;

  /**
   * 시구정촌 목록만 받을지 여부.
   * - `0`: 모든 주소 정보를 받는다.
   * - `1`: 시구정촌 목록만 받는다.
   *
   * 현재 저장소는 `JapanAddress` 정규화가 필요하므로 항상 `0`을 사용한다.
   */
  flg_getcity?: JapanPostAddressZipFlag;

  /**
   * 도도부현 목록만 받을지 여부.
   * - `0`: 모든 주소 정보를 받는다.
   * - `1`: 도도부현 목록만 받는다.
   *
   * 현재 저장소는 실제 주소 후보가 필요하므로 항상 `0`을 사용한다.
   */
  flg_getpref?: JapanPostAddressZipFlag;

  /**
   * 페이지 번호.
   * 현재 저장소는 첫 페이지만 보므로 `1` 고정으로 보낸다.
   */
  page?: number;

  /**
   * 최대 조회 건수.
   * 현재 저장소는 `DEFAULT_ADDRESS_SEARCH_LIMIT` 상수값을 그대로 넣는다.
   */
  limit?: number;
};

/**
 * 현재 adapter가 실제로 조립하는 `addresszip` 자유어 검색 body.
 *
 * 대응 upstream:
 * - `POST /api/v2/addresszip` with `freeword`
 *
 * 현재 adapter 사용 방식:
 * - `searchAddress()`에서 `freeword` + `flg_getcity: 0` + `flg_getpref: 0`
 *   + `page: 1` + `limit: DEFAULT_ADDRESS_SEARCH_LIMIT` 조합만 사용한다.
 *
 * `TLimit` 제네릭은 adapter 쪽 상수 타입(`typeof DEFAULT_ADDRESS_SEARCH_LIMIT`)을
 * 그대로 연결하려고 둔 것이다. 즉, 타입 파일은 상수 값을 모르고, adapter가 자신의
 * 런타임 상수를 연결해 더 좁은 타입으로 사용할 수 있다.
 */
export type JapanPostAddressZipFreewordRequest<TLimit extends number = number> =
  JapanPostAddressZipRequestBody & {
    /**
     * 현재 구현의 유일한 검색 입력.
     */
    freeword: string;

    /**
     * `0`으로 고정.
     * 시구정촌 목록만 축약해서 받지 말고 전체 주소 후보를 받으려는 의도다.
     */
    flg_getcity: 0;

    /**
     * `0`으로 고정.
     * 도도부현 목록만 축약해서 받지 말고 전체 주소 후보를 받으려는 의도다.
     */
    flg_getpref: 0;

    /**
     * 첫 페이지만 조회한다.
     */
    page: 1;

    /**
     * adapter 상수에서 주입되는 제한 건수.
     */
    limit: TLimit;
  };

/**
 * 캐시된 access token 상태.
 *
 * 현재 adapter 사용 방식:
 * - 토큰 문자열과 절대 만료 시각을 함께 보관해 재발급 호출을 줄인다.
 */
export type GatewayTokenCache = {
  /**
   * 현재 유효한 bearer token.
   */
  token: string;

  /**
   * 토큰을 더 이상 재사용하지 않을 절대 시각(ms).
   */
  expiresAt: number;
};

/**
 * Japan Post adapter 생성 옵션.
 *
 * 현재 adapter 사용 방식:
 * - 테스트에서는 `env`, `fetch`를 주입해 외부 의존성을 통제한다.
 * - 실서비스에서는 기본값으로 `process.env`, `globalThis.fetch`를 사용한다.
 */
export type AdapterOptions = {
  /**
   * 환경변수 오버라이드.
   */
  env?: NodeJS.ProcessEnv;

  /**
   * fetch 구현 오버라이드.
   */
  fetch?: typeof fetch;
};

/**
 * `/health` 응답에 대응하는 adapter 상태 타입.
 */
export type HealthStatus = {
  /**
   * 토큰 발급까지 포함한 기본 준비 상태.
   */
  ok: boolean;

  /**
   * 준비 실패 시 사람이 읽을 수 있는 에러 설명.
   */
  error?: string;

  /**
   * 서버 인스턴스 식별자.
   * adapter 자체가 채우는 값은 아니고, server 레이어가 env를 보고 덧붙일 수 있다.
   */
  instanceId?: string;
};

/**
 * `/searchcode/:code`의 adapter 반환 타입.
 */
export type PostalCodeResult = {
  /**
   * 조회에 사용한 정규화된 우편번호 문자열.
   */
  postalCode: string;

  /**
   * `JapanAddress`로 정규화된 주소 후보 목록.
   */
  addresses: JapanAddress[];
};

/**
 * `/addresszip?q=...`의 adapter 반환 타입.
 */
export type AddressSearchResult = {
  /**
   * 사용자가 입력한 검색어에서 trim만 적용한 값.
   */
  query: string;

  /**
   * `JapanAddress`로 정규화된 주소 후보 목록.
   */
  addresses: JapanAddress[];
};

/**
 * minimal-api server가 의존하는 주소 adapter 인터페이스.
 *
 * 현재 저장소 사용 방식:
 * - `server.ts`는 이 계약만 알고 있고, 실제 구현체로 Japan Post adapter를 주입한다.
 */
export type AddressAdapter = {
  /**
   * 업스트림 연결성과 인증 상태를 점검한다.
   */
  getHealth(): Promise<HealthStatus>;

  /**
   * 우편번호 기반 주소 조회.
   */
  lookupPostalCode(code: string): Promise<PostalCodeResult>;

  /**
   * 자유어 기반 주소 조회.
   */
  searchAddress(query: string): Promise<AddressSearchResult>;
};

/**
 * adapter 내부 HTTP 예외 타입.
 *
 * 현재 저장소 사용 방식:
 * - status code를 함께 담아 server 레이어에서 그대로 HTTP 응답 코드로 사용한다.
 * - `cause`는 fetch/json parse 등 원본 에러를 잃지 않으려고 optional로 보관한다.
 */
export type AdapterHttpError = Error & {
  /**
   * 원본 예외. 모든 에러에 항상 있는 것은 아니다.
   */
  cause?: unknown;

  /**
   * 최종적으로 server 응답에 반영할 HTTP status code.
   */
  statusCode: number;
};
