# @cp949/japanpost-react

React + TypeScript 기반의 일본 우편번호/주소 검색 훅과 headless 입력
컴포넌트 라이브러리입니다.

이 문서는 배포 패키지 사용 가이드입니다. `pnpm demo:full` 같은 저장소 수준 보조
명령은 루트의 Node 기반 진입점을 통해 Windows native 셸에서도 실행할 수 있고,
직접 `scripts/*.sh`를 호출하는 경로만 Bash/Linux/WSL 전제를 유지합니다.
자세한 저장소 운영 방법은 루트 README에서 다룹니다.

## 설치

```bash
pnpm add @cp949/japanpost-react
```

- 지원 React 버전: React 18, React 19

이 패키지는 ESM으로 배포됩니다. 기본 앱 엔트리는
`@cp949/japanpost-react`이며, 요청/응답/페이지 타입도 이 루트 엔트리에서
`import type`으로 가져오세요. Next.js App Router client component 엔트리는
`@cp949/japanpost-react/client`입니다.
`require("@cp949/japanpost-react")`,
`require("@cp949/japanpost-react/client")`는 지원되지 않으며, CommonJS
소비자는 `const pkg = await import("@cp949/japanpost-react");` 같은 ESM
interop을 사용해야 합니다.

breaking change: 전용 `./contracts` 서브패스는 제거되었고, 이제 루트 엔트리가
공개 타입의 단일 출처입니다.

## 엔트리 포인트

- `@cp949/japanpost-react`: 유틸리티, 훅, headless 입력 컴포넌트, 공개 타입을
  위한 기본 엔트리
- `@cp949/japanpost-react/client`: Next.js App Router client component용
  엔트리

## Next.js

Next.js App Router에서 훅이나 headless 입력 컴포넌트를 쓸 때는
클라이언트 컴포넌트 안에서 `@cp949/japanpost-react/client` 경로를
사용하는 것을 권장합니다. 유틸리티 함수와 백엔드나 sample server와 공유할
요청/응답/페이지 타입은 루트 엔트리에서 `import type`으로 가져오세요.

```tsx
"use client";

import { PostalCodeInput, useJapanPostalCode } from "@cp949/japanpost-react/client";
import { normalizeJapanPostalCode, type JapanAddressDataSource } from "@cp949/japanpost-react";
```

## 빠른 시작

```tsx
import { useJapanPostalCode } from "@cp949/japanpost-react";
import type {
  JapanAddressDataSource,
  JapanAddressRequestOptions,
} from "@cp949/japanpost-react";
import type { JapanAddress, Page } from "@cp949/japanpost-react";
import { createJapanAddressError } from "@cp949/japanpost-react";

// 현재 지원 방식은 실제 서버 연동뿐입니다.
// 앱의 백엔드 API 경로에 맞게 dataSource를 연결하세요.
// 현재 beta 호환 백엔드에서는 빈 addresszip 검색과 우편번호 miss가
// HTTP 200 + empty page로 올 수 있으며, 이런 경우는 정상 Page 결과로 유지합니다.
// 아래 status 매핑은 non-OK 응답에만 적용됩니다.
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function resolveErrorCode(path: string, status: number) {
  if (status === 404) {
    return "not_found";
  }

  if (status === 504) {
    return "timeout";
  }

  if (status === 400) {
    return path === "/q/japanpost/searchcode"
      ? "invalid_postal_code"
      : "invalid_query";
  }

  return "data_source_error";
}

async function readPage(
  path: string,
  request: unknown,
  options?: JapanAddressRequestOptions,
): Promise<Page<JapanAddress>> {
  let res: Response;

  try {
    res = await fetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
      signal: options?.signal,
    });
  } catch (error) {
    throw createJapanAddressError(
      isAbortError(error) ? "timeout" : "network_error",
      isAbortError(error) ? "Request timed out" : "Network request failed",
      {
        cause: error,
      },
    );
  }

  if (!res.ok) {
    const message = `Request failed with status ${res.status}`;

    throw createJapanAddressError(resolveErrorCode(path, res.status), message, {
      status: res.status,
    });
  }

  let payload: unknown;

  try {
    payload = await res.json();
  } catch (error) {
    throw createJapanAddressError(
      "bad_response",
      "Response payload was not valid JSON",
      {
        cause: error,
      },
    );
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    !Array.isArray((payload as { elements?: unknown }).elements) ||
    typeof (payload as { totalElements?: unknown }).totalElements !== "number" ||
    typeof (payload as { pageNumber?: unknown }).pageNumber !== "number" ||
    typeof (payload as { rowsPerPage?: unknown }).rowsPerPage !== "number"
  ) {
    throw createJapanAddressError(
      "bad_response",
      "Response payload must include a valid page payload",
    );
  }

  return payload as Page<JapanAddress>;
}

const dataSource: JapanAddressDataSource = {
  async lookupPostalCode(request, options) {
    return readPage(`/q/japanpost/searchcode`, request, options);
  },
  async searchAddress(request, options) {
    return readPage(`/q/japanpost/addresszip`, request, options);
  },
};

export function PostalForm() {
  const { loading, data, error, search } = useJapanPostalCode({ dataSource });

  return (
    <div>
      <button onClick={() => void search("100-0001")}>조회</button>
      {loading && <p>조회 중...</p>}
      {error && (
        <p>
          {error.code}: {error.message}
        </p>
      )}
      <p>전체 결과 수: {data?.totalElements ?? 0}</p>
      {data?.elements.map((addr) => (
        <p key={addr.postalCode + addr.address}>{addr.address}</p>
      ))}
    </div>
  );
}
```

예시 `resolveErrorCode()` helper는 non-OK 응답만 분류합니다. 현재 beta 호환
계약에서는 빈 주소 검색 요청과 우편번호 miss가 `200 + empty page`로 정상
성공할 수 있고, `404 -> not_found`는 miss를 오류로 노출하는 백엔드에서만
선택적으로 쓰면 됩니다.

Next.js에서도 `dataSource`는 자체 서버 API를 바라보도록 두고, Japan Post
업스트림 자격 증명과 토큰 교환은 브라우저가 아니라 서버에서 처리하세요.

## Consumer Helpers

루트 엔트리에는 직접 소비자 UI를 만들 때 유용한 헬퍼도 함께 있습니다.

- `formatJapanAddressDisplay(address)`는 `address.address`를 읽기 쉬운 한 줄 문자열로 정리합니다.
- `formatJapanAddressSearchResultLabel(address)`는 접근성용 결과 라벨 앞에 포맷된 우편번호를 붙입니다.
- `createJapanPostFetchDataSource({ baseUrl, ... })`는 패키지의 요청/응답 계약을 따르는 fetch 기반 백엔드를 감쌉니다.
- `createJapanPostApiDataSource(api, options?)`는 기존 `searchcode` / `addresszip` 클라이언트를 `JapanAddressDataSource`로 어댑터합니다. 이 어댑터는 기존 클라이언트가 이미 가진 에러 처리와 에러 형태를 그대로 유지하고, 요청/컨텍스트 연결과 선택적인 페이지 매핑에만 집중합니다.

### Formatter Usage

```tsx
import {
  formatJapanAddressDisplay,
  formatJapanAddressSearchResultLabel,
} from "@cp949/japanpost-react";

const displayText = formatJapanAddressDisplay(address);
const labelText = formatJapanAddressSearchResultLabel(address);
```

### Fetch-Based Data Source Usage

```tsx
import {
  createJapanPostFetchDataSource,
  useJapanPostalCode,
} from "@cp949/japanpost-react";

export function PostalCodeLookupExample() {
  const dataSource = createJapanPostFetchDataSource({
    baseUrl: "/minimal-api",
  });
  const postalCode = useJapanPostalCode({ dataSource });

  return <button onClick={() => void postalCode.search("1000001")}>Search</button>;
}
```

### API-Client Adapter Usage

```tsx
import {
  createJapanPostApiDataSource,
  useJapanAddressSearch,
  type JapanAddress,
  type JapanPostApiClient,
  type Page,
} from "@cp949/japanpost-react";

declare const apiClient: JapanPostApiClient<unknown, Page<JapanAddress>>;

export function AddressSearchExample() {
  const dataSource = createJapanPostApiDataSource(apiClient);
  const addressSearch = useJapanAddressSearch({ dataSource });

  return <button onClick={() => void addressSearch.search("Tokyo")}>Search</button>;
}
```

API client가 전송 계층과 에러 정규화를 이미 담당하고 있을 때 이 어댑터를 사용하세요. 패키지의 fetch 기반 에러 매핑이 필요하다면 `createJapanPostFetchDataSource(...)`를 사용하는 편이 맞습니다.

## Exports

- `normalizeJapanPostalCode`
- `formatJapanPostalCode`
- `formatJapanAddressDisplay`
- `formatJapanAddressSearchResultLabel`
- `normalizeJapanPostAddressRecord`
- `isValidJapanPostalCode`
- `createJapanAddressError`
- `createJapanPostFetchDataSource`
- `createJapanPostApiDataSource`
- `useJapanPostalCode`
- `useJapanAddressSearch`
- `useJapanAddress`
- `PostalCodeInput`
- `AddressSearchInput`
- `JapanAddress`, `JapanAddressDataSource`, `JapanPostalCodeSearchInput`,
  `JapanAddressSearchInput`, `JapanPostSearchcodeRequest`,
  `JapanPostAddresszipRequest`, `Page`를 포함한 공개 타입
- 요청 옵션 타입: `JapanAddressRequestOptions`
  루트 엔트리에서 `import type`으로 가져오는 공개 타입

## 유틸리티 메모

`formatJapanPostalCode()`는 정규화된 값이 정확히 7자리일 때만 하이픈을 넣습니다.
그 외 길이에서는 하이픈을 추가하지 않고 숫자만 남긴 값을 그대로 반환합니다.

## Hooks

### useJapanPostalCode

우편번호로 주소를 조회합니다. 문자열 입력과 구조화된 요청 입력을 모두
받을 수 있고, `3~6자리` 입력일 때는 prefix 검색으로 동작합니다.

```tsx
const { loading, data, error, search, cancel, reset } = useJapanPostalCode({
  dataSource,
});
```

```tsx
void search("1000001");
void search({
  postalCode: "1000001",
  pageNumber: 1,
  rowsPerPage: 10,
  includeParenthesesTown: true,
});
```

`cancel()`은 진행 중인 조회를 중단하고 현재 data/error 상태는 그대로 유지합니다.
`reset()`은 `cancel()`을 호출한 뒤 data/error까지 비워 훅을 idle 상태로
되돌립니다.

### useJapanAddressSearch

자유 형식 키워드 또는 구조화된 필드로 주소를 검색하며 `debounceMs`를 지원합니다.

```tsx
const { loading, data, error, search, cancel, reset } = useJapanAddressSearch({
  dataSource,
  debounceMs: 300,
});
```

```tsx
void search("Tokyo");
void search({
  addressQuery: "Tokyo",
  pageNumber: 1,
  rowsPerPage: 10,
  includeCityDetails: true,
});
void search({
  prefName: "東京都",
  cityName: "千代田区",
});
```

`search("Tokyo")`는 `addressQuery` 검색의 축약형입니다. 구조화된 필드는
`addressQuery` 없이도 사용할 수 있어서, 도도부현/시/동 단위로만 검색하고 싶을 때
유용합니다.

이 훅은 빈 검색어에 대해 여전히 클라이언트 선제 검증을 수행하고, 요청을 보내기
전에 `invalid_query`를 반환합니다. 이 검증은 UX 보조 장치이며 서버 검증이나
서버 계약 처리를 대체하지 않습니다.

`cancel()`은 진행 중인 요청이나 대기 중인 debounce 타이머를 중단하고,
현재 data/error 상태는 그대로 유지합니다. `reset()`은 `cancel()`을 호출한 뒤
data와 error까지 비워 훅을 idle 상태로 되돌립니다.

### useJapanAddress

우편번호 조회와 주소 질의 검색을 하나의 훅으로 합칩니다.

```tsx
const { loading, data, error, searchByPostalCode, searchByAddressQuery, reset } =
  useJapanAddress({ dataSource, debounceMs: 300 });
```

모든 훅은 런타임에서 `dataSource`가 필요합니다.

`useJapanPostalCode().search`, `useJapanAddressSearch().search`,
`useJapanAddress`의 편의 메서드는 모두 같은 공개 검색 입력 타입을 받습니다.

- `useJapanPostalCode().search(input: JapanPostalCodeSearchInput)`
- `useJapanAddressSearch().search(input: JapanAddressSearchInput)`
- `useJapanAddress().searchByPostalCode(input: JapanPostalCodeSearchInput)`
- `useJapanAddress().searchByAddressQuery(input: JapanAddressSearchInput)`

대신 훅 내부에서 `dataSource` 호출 전에 request object를 조립합니다.

- 우편번호 조회: `{ postalCode, pageNumber: 0, rowsPerPage: 100 }`
- 주소 검색: `{ addressQuery, pageNumber: 0, rowsPerPage: 100 }`

`useJapanAddressSearch`에서는 `addressQuery`를 생략한 구조화 요청도 가능하므로
도도부현, 시, 동 필드만으로 검색할 수 있습니다. `includeCityDetails`,
`includePrefectureDetails` 같은 optional flag는 기본적으로 넣지 않으며,
필요하면 사용자 data source 구현에서 직접 지정하면 됩니다.

## 에러 처리 메모

`JapanAddressDataSource`의 두 메서드는 모두 `Page<JapanAddress>`를 직접
반환해야 합니다. 훅은 그 page payload를 그대로 유지하므로
`data.elements`, `data.totalElements`, `data.pageNumber`,
`data.rowsPerPage`를 바로 읽을 수 있습니다.

두 메서드는 선택적인 두 번째 인자도 받을 수 있습니다.

```ts
type JapanAddressRequestOptions = {
  signal?: AbortSignal;
};
```

훅은 superseded 요청, `cancel()`, `reset()`, unmount 정리 상황에서 이전
요청을 취소할 수 있도록 `signal`을 전달합니다. 백엔드 레이어가 abort를 지원하면
그대로 활용할 수 있습니다.

권장 에러 코드 매핑:

| 상황 | 권장 코드 |
| --- | --- |
| 잘못된 우편번호 입력 | `invalid_postal_code` |
| 훅 선제 검증 단계의 빈 주소 검색어 | `invalid_query` |
| 네트워크 실패 | `network_error` |
| 요청 중단 / 타임아웃 | `timeout` |
| miss를 오류로 표면화하는 백엔드에서의 검색 결과 없음 | `not_found` |
| 성공 응답 shape 이상 | `bad_response` |
| 그 외 백엔드 오류 | `data_source_error` |

이 저장소의 demo 흐름에서는 예시 `dataSource`가 실패 요청을 오직 HTTP
status code로만 분류합니다. 현재 beta와 정렬된 흐름에서는 빈 `addresszip`
요청과 우편번호 miss가 모두 `200 + empty page`로 올 수 있고, 이런 경우는 정상
성공 page로 유지합니다. 그 외 `400` 응답은 `invalid_query`로 매핑할 수 있고,
miss를 오류로 노출하는 백엔드에서는 `404 -> not_found`, `504 -> timeout`
매핑을 유지할 수 있습니다.

## Headless 컴포넌트

`PostalCodeInput`, `AddressSearchInput`은 스타일 없이 동작과 DOM 구조만
제공하므로, 앱의 디자인 시스템에 맞게 직접 꾸밀 수 있습니다.

두 컴포넌트는 네이티브 props 전달도 지원합니다.

- `inputProps`: 실제 `<input />`에 전달
- `buttonProps`: 실제 `<button />`에 전달

따라서 `id`, `name`, `placeholder`, `aria-*`, `autoComplete`, `className`,
폼 연동용 속성을 직접 넘길 수 있습니다. `PostalCodeInput`은 별도 override가
없으면 기본적으로 `inputMode="numeric"`를 사용합니다.

## Data Source와 서버 연동

이 패키지는 자체 백엔드 서버와 함께 사용하는 것을 권장합니다. Japan Post
공식 연동은 토큰 기반 인증을 사용하므로, 브라우저에서 업스트림 자격증명을
직접 보관하면 안 됩니다. 현재 지원 방식은 실제 서버 연동뿐입니다.

이 저장소의 `apps/minimal-api`는 로컬 기준 sample server 구현입니다. Japan
Post API ver 2.0을 감싸며, 로컬 개발과 통합 확인 용도로만 쓰는 구성을
목표로 합니다. demo의 `/minimal-api` 경로는 개발 편의를 위한 로컬 경로
연결입니다.
업스트림 payload에 구조화된 주소 필드와 원본 전체 주소 문자열인 `address`가 함께
있더라도, sample server는 둘을 그대로 이어붙이지 않고 중복 없는 표시 주소를
우선 사용합니다.

백엔드나 sample server 코드가 공유 계약 타입만 필요할 때는 루트 엔트리의
public types를 사용하세요. `import type`으로 가져오면 됩니다.

timeout 메시지는 토큰 발급 단계와 실제 조회 단계 중 어느 쪽에서 timeout이
발생했는지에 따라 달라질 수 있지만, 두 경우 모두 `timeout` 코드로 다루면
됩니다.

## SSR

`dataSource` 구현에서는 서버 측 API를 사용하고, 토큰 교환과 업스트림 서명은
서버에서만 처리하세요. Next.js App Router에서는 React 훅과 UI 컴포넌트를
`@cp949/japanpost-react/client`에서 import해 클라이언트 컴포넌트에서
사용하는 것이 안전합니다.
