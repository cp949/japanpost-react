# Japan Post 연동 개발 가이드 (japanpost-react)

이 문서는 이 저장소의 코드와 실제 API 응답을 함께 확인해 유지하는 내부 개발 가이드다.
시간이 지나며 업스트림 응답이나 운영 정책이 바뀔 수 있으므로, 변경이 생기면 이 문서를 함께 갱신한다.

비밀값은 문서에 재기재하지 않는다. 자격정보는 `.secrets/env`를 참고한다.

## English Summary

This guide is the repository's internal development reference for the `japanpost-react` workspace.
The repository has three main parts: the reusable library in `packages/japanpost-react`, the local proxy server in `apps/minimal-api`, and the demo app in `apps/demo`.

The supported integration model in this repository is always server-backed.
During local development, the demo app calls `/minimal-api/*` through the Vite dev server, which forwards requests to `http://localhost:8788`, and `minimal-api` authenticates against the real Japan Post service.

Common commands:

- `pnpm demo:full`: start `minimal-api`, wait for `/health`, then run the demo app
- `pnpm api:dev`: run the local `minimal-api` server
- `pnpm test`: run the repository test flow
- `pnpm check-types`: run workspace type checks

The sample `minimal-api` currently uses `access-control-allow-origin: "*"`.
That setting is only for local development and demo verification.
In production, allowed origins must be restricted explicitly.

## 1. 구조 개요

이 저장소는 세 개의 주요 컴포넌트로 이루어진다.

| 컴포넌트    | 경로                       | 역할                                               |
| ----------- | -------------------------- | -------------------------------------------------- |
| 라이브러리  | `packages/japanpost-react` | React hooks와 headless UI 컴포넌트 제공            |
| Minimal API | `apps/minimal-api`         | Japan Post 실제 서버와 연동하는 로컬 서버 구현     |
| 데모 앱     | `apps/demo`                | 라이브러리와 서버 연동 흐름을 확인하는 React 앱    |

### 요청 흐름

중요: 이 저장소에서 말하는 현재 지원 방식은 항상 서버 연동 방식이다.
아래 `/minimal-api` 경로는 데모 개발 편의를 위한 로컬 경로 매핑일 뿐, 지원 정책상
별도의 연동 모델이 아니다.

```text
demo (브라우저)
  → Vite dev server (:5173)  /minimal-api/* 개발 경로를 localhost:8788로 연결
  → minimal-api (:8788)      자격정보로 Japan Post 실제 서버에 인증 후 요청
  → Japan Post API           운영 서버 응답 반환
```

demo가 `/minimal-api/q/japanpost/searchcode`를 요청하면, Vite 개발 서버가 개발 중에만
`/minimal-api` 접두어를 제거하고 `http://localhost:8788/q/japanpost/searchcode`로
연결한다.

`pnpm demo:full`은 minimal-api를 먼저 띄운 뒤 `/health`를 반복 확인한다.
이때 단순 TCP 연결 성공만으로 준비 완료로 보지 않고, HTTP `200`과
`{ "ok": true }` 응답이 모두 확인되고 그 응답이 방금 띄운 minimal-api
인스턴스에서 온 것까지 검증될 때만 demo 앱을 시작한다. `503` 또는
`{ "ok": false }`면 자격정보 또는 업스트림 준비 상태를 점검해야 한다.

### 1.1 라이브러리 공개 계약 정렬 (`packages/japanpost-react`)

중요: minimal-api가 Kotlin high-level 계약으로 정렬되면서,
`packages/japanpost-react`의 공개 계약도 같은 pager-aware 구조로 맞춰졌다.
소비자 문서에서 노출하는 pager 타입명은 반드시 `Page<T>`이며,
`MomoPagerData`를 public contract 이름으로 사용하지 않는다.

현재 공개 계약 기준:

- `Page<T>`는 `elements`, `totalElements`, `pageNumber`, `rowsPerPage`만
  가진다.
- `JapanAddressDataSource.lookupPostalCode`와 `searchAddress`는 둘 다
  `Promise<Page<JapanAddress>>`를 반환한다.
- `JapanPostalCodeLookupResult`, `JapanAddressSearchResult`는 공개적으로
  `Page<JapanAddress>`에 정렬된다.
- `useJapanPostalCode`, `useJapanAddressSearch`, `useJapanAddress`의 `data`는
  `{ postalCode, addresses }` 또는 `{ query, addresses }` wrapper가 아니라
  `Page<JapanAddress>` 자체를 그대로 유지한다.

이 변경은 breaking change로 취급한다. 소비자 migration 핵심:

- `data.addresses` → `data.elements`
- data source 반환형: `JapanAddress[]` → `Page<JapanAddress>`
- hooks 결과는 wrapper 객체가 아니라 `Page<JapanAddress>` 자체
- 유지되는 pager 필드: `elements`, `totalElements`, `pageNumber`,
  `rowsPerPage`
- 제거된 필드: `totalPages`, `offset`, `isFirst`, `isLast`, `nextKey`

예시:

```ts
// before
const addresses = data?.addresses ?? [];

// after
const addresses = data?.elements ?? [];
const total = data?.totalElements ?? 0;
```

## 2. Minimal API 외부 인터페이스

`apps/minimal-api/src/server.ts`가 진입점인 로컬 HTTP 서버. 기본 포트 `8788`.
실제 라우팅과 응답 helper는 `apps/minimal-api/src/http/*`로 분리되어 있지만,
이 서버는 브라우저가 직접 Japan Post와 통신하지 않고 실제 서버 연동 방식으로
조회하도록 돕는 현재 기준의 참고 구현이라는 점은 같다.

### 2.1 엔드포인트 목록

| Method | Path                   | 설명                          |
| ------ | ---------------------- | ----------------------------- |
| `GET`  | `/health`                  | 서버 연동 준비 상태 확인      |
| `POST` | `/q/japanpost/searchcode` | 우편번호로 주소 조회          |
| `POST` | `/q/japanpost/addresszip` | 조건으로 주소 검색            |

`/health`는 `GET`, 검색 엔드포인트는 `POST`를 사용한다. `OPTIONS`는 CORS
preflight용으로 `204`를 반환한다.

현재 참고 구현은 `access-control-allow-origin: "*"`를 사용한다. 이는 로컬 개발과
데모 검증 편의를 위한 설정이며, 프로덕션에서는 허용 origin을 명시적으로 제한해야
한다. 인증, 쿠키, 사내망 연동 등 실제 운영 정책이 들어가는 환경에서는 이 예제를
그대로 배포하지 않는다.

### 2.2 GET /health

`코드상 확인`

Japan Post 토큰 취득이 성공하면 `200`, 실패하면 `503`을 반환한다.

정상 응답 (`200`):

```json
{ "ok": true, "instanceId": "..." }
```

비정상 응답 (`503`):

```json
{ "ok": false, "error": "...", "instanceId": "..." }
```

`instanceId`는 스크립트가 자신이 기동한 minimal-api 프로세스를 식별하기 위한
선택 필드다. 일반적인 클라이언트 연동에서는 무시해도 된다.

demo의 `useDemoApiHealth`는 초기 마운트 시 이 엔드포인트를 1회 확인하고, 사용자가
수동으로 재시도 버튼을 눌렀을 때 다시 확인한다. 이 결과로 서버 연동 가능 여부를
판단하고 검색 버튼 활성화 여부를 결정한다.

### 2.3 POST /q/japanpost/searchcode

`코드상 확인 + 운영 호출로 확인`

우편번호로 주소를 조회한다. 요청 body는 Kotlin 공개 계약과 동일한
`value`, `pageNumber`, `rowsPerPage`, `includeParenthesesTown`,
`includeBusinessAddresses`를 받는다.

요청 예시:

```http
POST /q/japanpost/searchcode
```

응답 (`200`), 실제 확인:

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

최상위 필드:

| 필드            | 의미                          |
| --------------- | ----------------------------- |
| `elements`      | 현재 페이지의 주소 목록       |
| `totalElements` | 업스트림 전체 매칭 건수       |
| `pageNumber`    | 현재 페이지 번호 (0부터 시작) |
| `rowsPerPage`   | 페이지당 행 수                |

`elements[]` 내부 필드 → 2.5절 참고.

### 2.4 POST /q/japanpost/addresszip

`코드상 확인 + 운영 호출로 확인`

주소를 검색한다. 요청 body는 Kotlin 공개 계약과 동일한 camelCase 필드와
`pageNumber`, `rowsPerPage`, `includeCityDetails`,
`includePrefectureDetails`를 받는다.

요청 예시:

```http
POST /q/japanpost/addresszip
```

응답 (`200`), 실제 확인 (6건 중 일부):

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
    },
    {
      "postalCode": "1020082",
      "prefecture": "東京都",
      "prefectureKana": "トウキョウト",
      "city": "千代田区",
      "cityKana": "チヨダク",
      "town": "一番町",
      "townKana": "イチバンチョウ",
      "address": "東京都 千代田区 一番町",
      "provider": "japan-post"
    },
    {
      "postalCode": "1010032",
      "prefecture": "東京都",
      "prefectureKana": "トウキョウト",
      "city": "千代田区",
      "cityKana": "チヨダク",
      "town": "岩本町",
      "townKana": "イワモトチョウ",
      "address": "東京都 千代田区 岩本町",
      "provider": "japan-post"
    },
    {
      "postalCode": "1010047",
      "prefecture": "東京都",
      "prefectureKana": "トウキョウト",
      "city": "千代田区",
      "cityKana": "チヨダク",
      "town": "内神田",
      "townKana": "ウチカンダ",
      "address": "東京都 千代田区 内神田",
      "provider": "japan-post"
    },
    {
      "postalCode": "1000011",
      "prefecture": "東京都",
      "prefectureKana": "トウキョウト",
      "city": "千代田区",
      "cityKana": "チヨダク",
      "town": "内幸町",
      "townKana": "ウチサイワイチョウ",
      "address": "東京都 千代田区 内幸町",
      "provider": "japan-post"
    },
    {
      "postalCode": "1000004",
      "prefecture": "東京都",
      "prefectureKana": "トウキョウト",
      "city": "千代田区",
      "cityKana": "チヨダク",
      "town": "大手町",
      "townKana": "オオテマチ",
      "address": "東京都 千代田区 大手町",
      "provider": "japan-post"
    }
  ],
  "totalElements": 6,
  "pageNumber": 0,
  "rowsPerPage": 20
}
```

최상위 필드:

| 필드            | 의미                          |
| --------------- | ----------------------------- |
| `elements`      | 현재 페이지의 주소 목록       |
| `totalElements` | 업스트림 전체 매칭 건수       |
| `pageNumber`    | 현재 페이지 번호 (0부터 시작) |
| `rowsPerPage`   | 페이지당 행 수                |

`elements[]` 내부 필드 → 2.5절 참고.

검색 건수는 요청의 `rowsPerPage`를 그대로 따른다. 현재 demo 예시는 `20`을 사용한다.

### 2.5 JapanAddress 공통 필드

`코드상 확인 + 운영 호출로 확인`

`/searchcode`와 `/addresszip` 모두 동일한 `JapanAddress` 구조를 반환한다.

| 필드               | 타입           | 의미                                    | 비고                     |
| ------------------ | -------------- | --------------------------------------- | ------------------------ |
| `postalCode`       | `string`       | 우편번호 (7자리 숫자, 하이픈 없음)      | 항상 존재                |
| `prefecture`       | `string`       | 도도부현명                              | 항상 존재                |
| `prefectureKana`   | `string?`      | 도도부현명 카나 표기                    | 없으면 필드 자체가 없음  |
| `city`             | `string`       | 시구정촌명                              | 항상 존재                |
| `cityKana`         | `string?`      | 시구정촌명 카나 표기                    | 없으면 필드 자체가 없음  |
| `town`             | `string`       | 동/정/촌명                              | 항상 존재                |
| `townKana`         | `string?`      | 동/정/촌명 카나 표기                    | 없으면 필드 자체가 없음  |
| `address`          | `string`       | `prefecture city town` 공백 연결 문자열 | 항상 존재                |
| `provider`         | `"japan-post"` | 고정값                                  | 항상 존재                |

주소 문자열 조합 규칙:

- 기본 표시는 `prefecture`, `city`, `town`, 그리고 구조화된 추가 정보에 해당하는
  `block_name`, `other_name` 순으로 공백 결합한다.
- 원본의 자유 형식 `address` 필드는 구조화된 주소를 보강하는 fallback 성격으로만
  사용한다.
- 즉, 구조화된 주소와 원본 `address`를 단순 이어붙여 중복 문자열을 만들지 않는다.
- 원본 `address`가 구조화된 주소를 포함하는 더 완전한 전체 문자열이면 그 값을
  `address`로 사용한다.

Japan Post 원본에서 값이 `null`인 kana 필드는 응답에서 키 자체가 생략된다. (원본의 `null` 키는 노출되지 않음)

### 2.6 에러 응답

| HTTP status | 조건                                 | 응답 형식                                                      |
| ----------- | ------------------------------------ | -------------------------------------------------------------- |
| `400`       | 우편번호 형식 오류 (3~7자리 숫자 아님) | `{ "error": "Postal code must contain between 3 and 7 digits" }` |
| `400`       | JSON body 파싱 실패                  | `{ "error": "Request body must be valid JSON" }`               |
| `400`       | `pageNumber` 형식 오류               | `{ "error": "pageNumber must be a non-negative integer" }`     |
| `400`       | `rowsPerPage` 형식 오류              | `{ "error": "rowsPerPage must be a positive integer" }`        |
| `400`       | addresszip 검색 필드가 모두 비어 있음 | `{ "error": "At least one search field must be provided" }`    |
| `404`       | 검색 결과 없음                       | `{ "error": "No matching addresses found" }`                   |
| `405`       | 허용되지 않은 메서드                 | `{ "error": "Method not allowed" }`                            |
| `502`       | upstream 응답 오류 또는 파싱 실패    | `{ "error": "..." }`                                           |
| `504`       | upstream timeout (10초)              | `{ "error": "Address provider authentication timed out" }` 또는 `{ "error": "Address provider request timed out" }` |
| `500`       | 서버 내부 오류                       | `{ "error": "Unexpected server error" }`                       |

`504` 메시지는 토큰 발급 단계에서 timeout이 났는지, 실제 조회 요청 단계에서 timeout이 났는지에 따라 달라진다.

## 3. 업스트림 Japan Post API (minimal-api 내부)

`apps/minimal-api/src/japanPostAdapter.ts`와 `apps/minimal-api/src/adapter/*`가
함께 실제로 호출하는 Japan Post 운영 API.

이 절은 gateway 코드와 `.secrets/env` 기반 확인이다. 현재 지원 방식은 브라우저에서
직접 업스트림을 호출하는 것이 아니라, 이 서버 계층을 통해 Japan Post 실제 서버와
연동하는 방식이다.

### 3.1 인증

`코드상 확인`

- 방식: Bearer 토큰
- 토큰 취득: `POST /api/v2/j/token`
- 캐시: 메모리. 만료 30초 전 폐기
- 자동 재시도: `401` 수신 시 캐시 무효화 후 1회 재시도

### 3.2 Token 취득

`코드상 확인`

```http
POST https://api.da.pf.japanpost.jp/api/v2/j/token
Content-Type: application/json
```

Request body:

```json
{
  "grant_type": "client_credentials",
  "client_id": "<JAPAN_POST_CLIENT_ID>",
  "secret_key": "<JAPAN_POST_SECRET_KEY>"
}
```

중요한 고정값:

- `grant_type`는 코드에서 `"client_credentials"` 상수로 고정.
- 키 이름은 `client_secret`이 아니라 `secret_key`.

응답에서 코드가 실제로 읽는 필드: `token`, `expires_in`

### 3.3 우편번호 조회 (searchcode)

`코드상 확인`

```http
GET https://api.da.pf.japanpost.jp/api/v2/searchcode/{search_code}
Authorization: Bearer <token>
```

- upstream path parameter 이름은 `search_code`
- Japan Post 원문 스펙은 우편번호(3자리 이상 숫자), 사업소 개별 우편번호, 디지털 주소를 지원
- query parameter로 `page`, `limit`, `ec_uid`, `choikitype`, `searchtype`를 받을 수 있음
- 현재 이 저장소의 adapter는 그중 `3~7자리 숫자 우편번호` subset만 사용한다
- `ec_uid`는 `JAPAN_POST_EC_UID`가 설정된 경우에만 전달한다
- `choikitype`는 `JAPAN_POST_SEARCH_CODE_CHOIKITYPE`가 `1` 또는 `2`일 때만 전달한다
  - `1`: 괄호 없는町域 필드
  - `2`: 괄호 있는町域 필드
- `searchtype`는 `JAPAN_POST_SEARCH_CODE_SEARCHTYPE`가 `1` 또는 `2`일 때만 전달한다
  - `1`: 우편번호, 사업소 개별 우편번호, 디지털 주소 검색
  - `2`: 우편번호, 디지털 주소만 검색
- 현재 adapter는 `pageNumber + 1`을 upstream `page`로, `rowsPerPage`를 upstream
  `limit`로 전달한다
- upstream 응답의 `addresses[]`는 adapter에서 정규화된 `JapanAddress`의
  `elements[]`로 매핑된다

### 3.4 자유어 검색 (addresszip)

`코드상 확인`

```http
POST https://api.da.pf.japanpost.jp/api/v2/addresszip
?ec_uid=<provider-user-id>
Authorization: Bearer <token>
Content-Type: application/json
```

upstream query parameter:

- `ec_uid`: provider user id. 현재 adapter는 `JAPAN_POST_EC_UID`가 설정된 경우에만 전달한다.

upstream request body는 `pref_code`, `pref_name`, `pref_kana`, `pref_roma`,
`city_code`, `city_name`, `city_kana`, `city_roma`, `town_name`, `town_kana`,
`town_roma`, `freeword`, `flg_getcity`, `flg_getpref`, `page`, `limit`를
지원한다.

현재 이 저장소의 gateway 구현이 실제로 보내는 body는 freeword subset이다:

```json
{
  "freeword": "<검색어>",
  "flg_getcity": 0 or 1,
  "flg_getpref": 0 or 1,
  "page": "<pageNumber + 1>",
  "limit": "<rowsPerPage>"
}
```

- `flg_getcity` / `flg_getpref`는 코드에서 `0 | 1` 범위로 모델링되고,
  `includeCityDetails` / `includePrefectureDetails` 입력에 따라 결정된다.
- `page`는 `pageNumber + 1`로 전달된다.
- `limit`는 `rowsPerPage` 값으로 전달된다.
- 즉 upstream 전체 스펙 중에서, 현재 저장소는 Kotlin high-level 계약의
  camelCase body를 받아 upstream snake_case body로 변환한다.
- upstream 응답의 `addresses[]`는 adapter에서 정규화된 `JapanAddress`의
  `elements[]`로 매핑된다.

## 4. 정규화 규칙 (`src/adapter/normalizers.ts`)

`코드상 확인`

Japan Post API 원본 필드 → `JapanAddress` 변환 규칙:

| 원본 필드                                   | 변환 후 필드                        | 규칙                                                                          |
| ------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| `zip_code`                                  | `postalCode`                        | 숫자만 추출. 7자리 아니면 `502` 에러                                          |
| `pref_name`                                 | `prefecture`                        | trim                                                                          |
| `pref_kana`                                 | `prefectureKana`                    | trim. 빈 문자열이면 `undefined` (필드 생략)                                   |
| `city_name`                                 | `city`                              | trim                                                                          |
| `city_kana`                                 | `cityKana`                          | trim. 빈 문자열이면 `undefined` (필드 생략)                                   |
| `town_name`                                 | `town`                              | trim                                                                          |
| `town_kana`                                 | `townKana`                          | trim. 빈 문자열이면 `undefined` (필드 생략)                                   |
| `block_name`, `other_name`, `address`(원시) | `address` 일부 | 우선 `prefecture city town block_name other_name`를 공백 연결해 구조화 주소를 만든다. 이후 원시 `address`가 구조화 주소를 이미 포함하면 원시 값을 그대로 쓰고, 그렇지 않으면 구조화 주소를 우선 사용한다. |
| (없음)                                      | `provider`                          | 고정값 `"japan-post"`                                                         |

## 5. 환경 변수

`코드상 확인 + .secrets/env 확인`

실제로 사용 중인 `.secrets/env` 파일에는 아래 3개만 정의되어 있다.

| 변수명                  | 필수 | `.secrets/env` 상태 | 설명                                                                                                                |
| ----------------------- | ---- | ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `JAPAN_POST_BASE_URL`   | 필수 | 정의됨              | Japan Post 업스트림 호스트. 현재 파일에서는 프로토콜 없이 host만 넣고, gateway 코드가 자동으로 `https://`를 붙인다. |
| `JAPAN_POST_CLIENT_ID`  | 필수 | 정의됨              | Japan Post가 발급한 클라이언트 ID                                                                                   |
| `JAPAN_POST_SECRET_KEY` | 필수 | 정의됨              | 위와 짝을 이루는 비밀키                                                                                             |

현재 `.secrets/env` 예시 형식:

```bash
export JAPAN_POST_BASE_URL=...
export JAPAN_POST_CLIENT_ID=...
export JAPAN_POST_SECRET_KEY=...
```

코드상 추가로 지원하는 선택 환경 변수는 아래와 같지만, 현재 `.secrets/env`에는 없다.

| 변수명                        | 기본값               | 설명                                             |
| ----------------------------- | -------------------- | ------------------------------------------------ |
| `JAPAN_POST_TOKEN_PATH`       | `/api/v2/j/token`    | 토큰 취득 path                                   |
| `JAPAN_POST_SEARCH_CODE_PATH` | `/api/v2/searchcode` | 우편번호 검색 path                               |
| `JAPAN_POST_SEARCH_CODE_CHOIKITYPE` | -              | 설정 시 searchcode 요청의 `choikitype` query parameter (`1` 또는 `2`) |
| `JAPAN_POST_SEARCH_CODE_SEARCHTYPE` | -              | 설정 시 searchcode 요청의 `searchtype` query parameter (`1` 또는 `2`) |
| `JAPAN_POST_ADDRESS_ZIP_PATH` | `/api/v2/addresszip` | 자유어 검색 path                                 |
| `JAPAN_POST_EC_UID`           | -                    | 설정 시 `searchcode` / `addresszip` 요청의 `ec_uid` query parameter 값 |
| `JAPAN_POST_X_FORWARDED_FOR`  | -                    | 설정 시 token 요청에 `x-forwarded-for` 헤더 추가 |
| `PORT`                        | `8788`               | minimal-api 리스닝 포트                          |
| `DEMO_PORT`                   | `5173`               | Vite dev 서버 포트                               |

비밀값은 문서에 재기재하지 않고, 실제 값은 `.secrets/env`를 기준으로 본다.

## 6. 로컬 개발 실행

```bash
bash scripts/dev-demo.sh
```

1. `.secrets/env` 로드
2. minimal-api를 `$PORT`(기본 `:8788`)에서 기동
3. `/health` 응답 대기 (최대 30초)
4. Vite demo dev 서버를 `$DEMO_PORT`(기본 `:5173`)에서 기동

Vite 개발 서버 경로 연결 설정 (`apps/demo/vite.config.ts`):

```text
/minimal-api/* → http://localhost:8788/*  (경로에서 /minimal-api 접두어 제거)
```

이 설정은 개발 중 demo와 local server를 쉽게 붙이기 위한 보조 장치다. 문서나
제품 정책에서 말하는 지원 방식은 이 설정 자체가 아니라, `minimal-api` 같은 실제
서버 계층을 두고 Japan Post 운영 서버와 연동하는 구조다.

## 7. 실제 응답 확인 예시

`운영 호출로 확인`

```bash
# 우편번호 조회
curl -X POST 'http://localhost:5173/minimal-api/q/japanpost/searchcode' \
  -H 'content-type: application/json' \
  --data '{"value":"1020072","pageNumber":0,"rowsPerPage":10}'

# 자유어 검색
curl -X POST 'http://localhost:5173/minimal-api/q/japanpost/addresszip' \
  -H 'content-type: application/json' \
  --data '{"freeword":"千代田","pageNumber":0,"rowsPerPage":20,"includeCityDetails":false,"includePrefectureDetails":false}'
```

두 요청 모두 정상 응답 확인. 응답 예시는 2.3절, 2.4절 참고.

확인된 사실:

- `POST /q/japanpost/searchcode`에서 `飯田橋` 1건이 정상 반환됐다.
- `POST /q/japanpost/addresszip`에서 `千代田区` 내 6건이 반환됐다 (`飯田橋`, `一番町`, `岩本町`, `内神田`, `内幸町`, `大手町`).
- `prefectureKana`, `cityKana`, `townKana` 필드가 모두 채워진 상태로 반환됐다.
- `provider` 필드는 항상 `"japan-post"`로 고정됐다.
