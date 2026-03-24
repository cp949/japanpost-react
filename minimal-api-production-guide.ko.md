# `japanpost-react` 연동 서버 개발 가이드

이 문서는 다른 프로젝트에서 `japanpost-react` 라이브러리를 사용하기 위해, 서버
사이드에 `apps/minimal-api`와 같은 역할의 백엔드를 구현할 때 참고하는 한글
가이드다.

초점은 demo 앱이 아니라 `japanpost-react` 라이브러리가 기대하는 조회 계약에 있다.
즉 이 문서는 "브라우저 앞에 어떤 서버를 두어야 이 라이브러리를 안정적으로 쓸 수
있는가"를 정리한다.

## 1. 전제

이 저장소의 현재 지원 방식은 항상 서버 연동 방식이다. 브라우저가 Japan Post API를
직접 호출하는 구조는 지원 기준으로 삼지 않는다.

라이브러리 사용 앱은 아래 형태로 동작한다.

```text
React 앱
  -> 앱의 백엔드 API
  -> Japan Post 인증/조회 처리
  -> 정규화된 주소 응답 반환
```

서버가 필요한 이유는 다음과 같다.

- Japan Post 자격정보를 브라우저에 노출하지 않기 위해
- 토큰 발급과 재사용을 서버에서 관리하기 위해
- 업스트림 응답을 앱 친화적인 형식으로 정규화하기 위해
- 업스트림 오류를 라이브러리가 다루기 쉬운 형태로 정리하기 위해

## 2. 라이브러리가 실제로 기대하는 계약

`japanpost-react`는 서버의 특정 프레임워크나 라우팅 방식을 요구하지 않는다. 중요한
것은 라이브러리 사용 앱이 `JapanAddressDataSource`를 구현할 수 있어야 한다는 점이다.

라이브러리 관점에서 필요한 기능은 두 가지뿐이다.

- 우편번호 조회
- 자유어 주소 검색

즉 서버는 최소한 아래 두 조회를 지원해야 한다.

- `lookupPostalCode(postalCode)`
- `searchAddress(query)`

라이브러리 자체는 `/health`를 요구하지 않는다.

## 3. 권장 서버 인터페이스

참고 구현인 `apps/minimal-api`는 아래 두 엔드포인트를 사용한다. 다른 프로젝트에서도
이 형태를 그대로 써도 되고, 앱의 API 규칙에 맞게 경로를 바꿔도 된다. 중요한 것은
클라이언트 측 `dataSource`가 두 메서드를 안정적으로 구현할 수 있어야 한다는 점이다.

### 3.1 우편번호 조회

권장 예시:

```http
POST /q/japanpost/searchcode
```

요청 body 예시:

```json
{
  "value": "1020072",
  "pageNumber": 0,
  "rowsPerPage": 10
}
```

성공 응답 예시:

```json
{
  "elements": [
    {
      "postalCode": "1020072",
      "prefecture": "東京都",
      "prefectureKana": "トウキョウト",
      "city": "千代田区",
      "cityKana": "チヨダク",
      "town": "飯田橋",
      "townKana": "イイダバシ",
      "address": "東京都 千代田区 飯田橋",
      "provider": "japan-post"
    }
  ],
  "totalElements": 1,
  "pageNumber": 0,
  "rowsPerPage": 10
}
```

### 3.2 주소 검색

권장 예시:

```http
POST /q/japanpost/addresszip
```

요청 body 예시:

```json
{
  "freeword": "千代田",
  "pageNumber": 0,
  "rowsPerPage": 20,
  "includeCityDetails": false,
  "includePrefectureDetails": false
}
```

성공 응답 예시:

```json
{
  "elements": [
    {
      "postalCode": "1020072",
      "prefecture": "東京都",
      "prefectureKana": "トウキョウト",
      "city": "千代田区",
      "cityKana": "チヨダク",
      "town": "飯田橋",
      "townKana": "イイダバシ",
      "address": "東京都 千代田区 飯田橋",
      "provider": "japan-post"
    }
  ],
  "totalElements": 1,
  "pageNumber": 0,
  "rowsPerPage": 20
}
```

upstream `addresszip` 자체는 `pref_code`, `pref_name`, `pref_kana`,
`pref_roma`, `city_code`, `city_name`, `city_kana`, `city_roma`, `town_name`,
`town_kana`, `town_roma`, `freeword`, `flg_getcity`, `flg_getpref`, `page`,
`limit` request body와 `ec_uid` query parameter를 지원하지만, 현재
`minimal-api` high-level은 Kotlin 계약에 맞춘 camelCase body를 받고 내부에서
업스트림 request body로 매핑한다.

## 4. 응답 정규화 규칙

서버는 Japan Post 원본 응답을 그대로 프런트엔드에 넘기지 말고, 라이브러리 사용 앱이
바로 소비할 수 있는 주소 객체 배열로 정규화하는 것이 좋다.

권장 필드는 다음과 같다.

- `postalCode`
- `prefecture`
- `prefectureKana`
- `city`
- `cityKana`
- `town`
- `townKana`
- `address`
- `provider`

권장 규칙은 다음과 같다.

- 우편번호는 숫자 7자리 문자열로 통일한다.
- 빈 문자열, 공백, `null`은 일관되게 정리한다.
- `address`는 사람이 읽기 좋은 완성 주소 문자열로 만든다.
- 업스트림 필드명이 바뀌어도 앱이 받는 응답 shape는 가능한 한 유지한다.

이렇게 해두면 `dataSource`는 `payload`를 `Page<JapanAddress>` 그대로
반환하면 되고, `japanpost-react` 훅들도 그 축소된 page payload를 그대로
노출할 수 있다.

## 5. 입력 검증 규칙

서버는 조회 전에 입력을 먼저 검증하는 편이 좋다.

우편번호 조회:

- 하이픈과 공백을 제거한 뒤 숫자만 남긴다.
- 결과가 `3~7자리 숫자`가 아니면 `400`을 반환한다.
- `3~6자리` 입력은 prefix 조회로 upstream `searchcode`에 그대로 전달한다.

주소 검색:

- 검색 필드를 trim 처리한다.
- 모든 검색 필드가 비어 있으면 `400`을 반환한다.

이 검증을 서버에서 해두면 클라이언트 구현이 단순해지고, 잘못된 입력을 업스트림까지
보내지 않아도 된다.

## 6. 인증과 업스트림 호출

`apps/minimal-api/src/japanPostAdapter.ts`는 orchestration entry point이고,
실제 세부 책임은 `apps/minimal-api/src/adapter/*`로 나눠 둘 수 있다. 예를 들면
설정 파싱은 `config.ts`, 토큰 캐시는 `tokenClient.ts`, 인증된 upstream 호출은
`japanPostGateway.ts`, 응답 정규화는 `normalizers.ts`가 맡는다. 다른 프로젝트에서도
이 책임 자체는 서버에 두는 것이 맞다.

필수 설정:

- `JAPAN_POST_CLIENT_ID`
- `JAPAN_POST_SECRET_KEY`

선택 설정:

- `JAPAN_POST_BASE_URL`
- `JAPAN_POST_TOKEN_PATH`
- `JAPAN_POST_SEARCH_CODE_PATH`
- `JAPAN_POST_ADDRESS_ZIP_PATH`
- `JAPAN_POST_EC_UID`
- `JAPAN_POST_X_FORWARDED_FOR`

권장 구현 원칙:

- 토큰은 서버에서 캐시한다.
- 만료 직전까지 쓰지 말고 여유 시간을 두고 갱신한다.
- 동시에 여러 요청이 들어오면 토큰 재발급은 한 번만 일어나게 한다.
- 업스트림 `401`이 오면 캐시를 비우고 1회만 재시도한다.
- 토큰 요청과 주소 조회 요청 모두 타임아웃을 둔다.
- upstream `addresszip`는 `ec_uid` query parameter와 다양한 주소 필드 request body를 지원한다.
- 현재 이 저장소는 `freeword + flg_getcity: 0 + flg_getpref: 0 + page: 1 + limit: 20`만 보내는 구체적인 subset을 사용한다.
- upstream `searchcode`는 원문 기준으로 `page`, `limit`, `ec_uid`, `choikitype`, `searchtype` query parameter를 지원한다.
- 현재 이 저장소는 `ec_uid` 외에 `choikitype`, `searchtype`도 필요 시 보낼 수 있게 타입을 구체화해 두었다.
  `choikitype`는 `1 | 2`, `searchtype`도 `1 | 2`로 모델링한다.

## 7. 라이브러리 친화적인 오류 매핑

서버 오류는 업스트림 원문을 그대로 노출하기보다, 앱의 `dataSource`가
`createJapanAddressError(...)`로 변환하기 쉬운 형태로 정리하는 편이 좋다.

권장 HTTP 기준:

- 잘못된 우편번호: `400`
- 빈 검색어: `400`
- 결과 없음: `404`
- 업스트림 인증/연동 실패: `502`
- 업스트림 타임아웃: `504`
- 예상하지 못한 서버 오류: `500`

응답 예시:

```json
{ "error": "No matching addresses found" }
```

이 구조면 클라이언트 `dataSource`는 상태 코드와 `error` 메시지를 읽어 다음처럼
맵핑하기 쉽다.

- `400 /q/japanpost/searchcode` -> `invalid_postal_code`
- `400 /q/japanpost/addresszip` -> `invalid_query`
- `404` -> `not_found`
- `504` -> `timeout`
- 네트워크 실패 -> `network_error`
- 그 외 -> `data_source_error`

## 8. `dataSource` 구현 관점에서 중요한 점

`japanpost-react`는 서버 전체를 알지 못하고, 오직 `JapanAddressDataSource`만 본다.
따라서 서버 구현에서 중요한 것은 "라이브러리 전용 SDK"를 만드는 것이 아니라, 앱이
아래 형태의 `dataSource`를 만들기 쉽게 하는 것이다.

```ts
type JapanAddressDataSource = {
  lookupPostalCode: (postalCode: string) => Promise<JapanAddress[]>;
  searchAddress: (query: string) => Promise<JapanAddress[]>;
};
```

즉 서버는 다음 조건만 만족하면 된다.

- 각 조회 엔드포인트가 `addresses` 배열을 안정적으로 반환한다.
- 실패 시 HTTP 상태 코드와 읽을 수 있는 `error` 메시지를 제공한다.
- abort, timeout, network error를 클라이언트가 구분할 수 있게 한다.

## 9. 운영 환경에서 반드시 챙길 것

이 문서의 초점은 라이브러리 연동이지만, 운영 서버라면 아래 항목은 기본으로 챙겨야
한다.

- CORS 허용 origin 제한
- 시크릿 안전 보관
- 요청/응답 로깅과 요청 ID
- 업스트림 타임아웃
- 레이트 리밋 또는 abuse 방어
- 장애 분석을 위한 메트릭

중요한 점은, 이 서버가 `japanpost-react`를 위한 단순 어댑터 역할을 하더라도 운영
환경에서는 외부 API를 대신 호출하는 경계면이라는 사실이 바뀌지 않는다는 점이다.

## 10. 참고 구현에서 직접 볼 파일

이 저장소에서 실제 참고할 파일은 아래가 핵심이다.

- `apps/minimal-api/src/server.ts`
- `apps/minimal-api/src/japanPostAdapter.ts`
- `apps/minimal-api/src/http/routes.ts`
- `apps/minimal-api/src/adapter/config.ts`
- `apps/minimal-api/src/adapter/tokenClient.ts`
- `apps/minimal-api/src/adapter/japanPostGateway.ts`
- `apps/minimal-api/src/adapter/normalizers.ts`
- `apps/minimal-api/src/http/routes.ts`
- `apps/minimal-api/src/adapter/config.ts`
- `apps/minimal-api/src/adapter/tokenClient.ts`
- `apps/minimal-api/src/adapter/japanPostGateway.ts`
- `apps/minimal-api/src/adapter/normalizers.ts`

그리고 라이브러리 사용 계약은 아래 문서에서 확인하면 된다.

- `packages/japanpost-react/docs/README.ko.md`

## 11. `/health`에 대한 정리

`/health`는 `japanpost-react` 라이브러리 계약의 일부가 아니다.

이 저장소에서 `/health`는 demo 앱이 검색 UI를 활성화하기 전에 API 준비 상태를
확인하기 위해 쓰는 demo app 용 엔드포인트다. 다른 프로젝트에서 라이브러리를 붙일
때는 필요하면 별도로 둘 수 있지만, `japanpost-react`를 쓰기 위해 반드시 구현해야
하는 엔드포인트는 아니다.
