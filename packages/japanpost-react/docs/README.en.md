# @cp949/japanpost-react

React hooks, headless input components, and utilities for Japan postal-code
and address lookup.

This package does not call Japan Post directly. You provide a
`JapanAddressDataSource` that talks to your own backend API.

## Install

```bash
pnpm add @cp949/japanpost-react
```

- Peer dependencies: React 18 or React 19
- Package source in this repository:
  `packages/japanpost-react`
- Demo app in this repository: `apps/demo`

## What The Package Provides

- Hooks for postal-code lookup and address search:
  `useJapanPostalCode`, `useJapanAddressSearch`, `useJapanAddress`
- Headless form components:
  `PostalCodeInput`, `AddressSearchInput`
- Utilities:
  `normalizeJapanPostalCode`, `formatJapanPostalCode`,
  `isValidJapanPostalCode`, `normalizeJapanPostAddressRecord`,
  `createJapanAddressError`
- Public types for the request, response, error, and data-source contracts

## Quick Start

The package expects a `JapanAddressDataSource` with two methods:

- `lookupPostalCode(request, options?)`
- `searchAddress(request, options?)`

Both methods return `Promise<Page<JapanAddress>>`.

```tsx
import {
  PostalCodeInput,
  createJapanAddressError,
  useJapanPostalCode,
  type JapanAddress,
  type JapanAddressDataSource,
  type JapanAddressRequestOptions,
  type Page,
} from "@cp949/japanpost-react";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isPagePayload(payload: unknown): payload is Page<JapanAddress> {
  return (
    typeof payload === "object" &&
    payload !== null &&
    Array.isArray((payload as { elements?: unknown }).elements) &&
    typeof (payload as { totalElements?: unknown }).totalElements === "number" &&
    typeof (payload as { pageNumber?: unknown }).pageNumber === "number" &&
    typeof (payload as { rowsPerPage?: unknown }).rowsPerPage === "number"
  );
}

async function readPage(
  path: string,
  request: unknown,
  options?: JapanAddressRequestOptions,
): Promise<Page<JapanAddress>> {
  let response: Response;

  try {
    response = await fetch(path, {
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
      { cause: error },
    );
  }

  if (!response.ok) {
    throw createJapanAddressError(
      "data_source_error",
      `Request failed with status ${response.status}`,
      { status: response.status },
    );
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error) {
    throw createJapanAddressError(
      "bad_response",
      "Response payload was not valid JSON",
      { cause: error },
    );
  }

  if (!isPagePayload(payload)) {
    throw createJapanAddressError(
      "bad_response",
      "Response payload must include a valid page payload",
    );
  }

  return payload;
}

const dataSource: JapanAddressDataSource = {
  lookupPostalCode(request, options) {
    return readPage("/q/japanpost/searchcode", request, options);
  },
  searchAddress(request, options) {
    return readPage("/q/japanpost/addresszip", request, options);
  },
};

export function PostalCodeLookupExample() {
  const { loading, data, error, search } = useJapanPostalCode({ dataSource });

  return (
    <div>
      <PostalCodeInput
        buttonLabel="Search"
        label="Postal code"
        onSearch={(postalCode) => {
          void search({ postalCode });
        }}
      />

      {loading ? <p>Loading...</p> : null}
      {error ? <p>{error.message}</p> : null}

      <ul>
        {(data?.elements ?? []).map((address) => (
          <li key={`${address.postalCode}-${address.address}`}>
            {address.address}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

The example paths above match this repository's reference backend. In your own
app, the backend routes can be different as long as your `dataSource`
implementation returns the same public types.

## Core Contract

`Page<T>` is the result shape shared by the hooks and the reference backend:

```ts
type Page<T> = {
  elements: T[];
  totalElements: number;
  pageNumber: number;
  rowsPerPage: number;
};
```

`JapanAddress` is the normalized address shape returned by the package:

```ts
type JapanAddress = {
  postalCode: string;
  prefecture: string;
  prefectureKana?: string;
  city: string;
  cityKana?: string;
  town: string;
  townKana?: string;
  address: string;
  provider: "japan-post";
};
```

The hooks keep this page payload as-is, so consumers read
`data?.elements`, `data?.totalElements`, `data?.pageNumber`, and
`data?.rowsPerPage` directly.

## Hooks

### `useJapanPostalCode`

- Accepts `string` or `JapanPostalCodeSearchInput`
- Normalizes the input to digits before calling the data source
- Allows `3-7` digits, so prefix lookup is possible
- Builds `{ postalCode, pageNumber: 0, rowsPerPage: 100 }` by default
- Exposes `loading`, `data`, `error`, `search`, `cancel`, and `reset`

```tsx
const postalCode = useJapanPostalCode({ dataSource });

void postalCode.search("100-0001");
void postalCode.search({
  postalCode: "1000001",
  pageNumber: 1,
  rowsPerPage: 10,
  includeParenthesesTown: true,
});
```

### `useJapanAddressSearch`

- Accepts `string` or `JapanAddressSearchInput`
- Supports free-form search and structured fields in the same request type
- Rejects a fully blank query before calling the data source
- Omits `includeCityDetails` and `includePrefectureDetails` unless you set them
- Supports `debounceMs`
- Exposes `loading`, `data`, `error`, `search`, `cancel`, and `reset`

```tsx
const addressSearch = useJapanAddressSearch({
  dataSource,
  debounceMs: 300,
});

void addressSearch.search("千代田");
void addressSearch.search({
  prefName: "東京都",
  cityName: "千代田区",
  pageNumber: 0,
  rowsPerPage: 10,
});
```

### `useJapanAddress`

- Combines postal-code lookup and address search in one hook
- Reuses the same `dataSource`
- Exposes `searchByPostalCode`, `searchByAddressQuery`, and `reset`
- Returns `data` and `error` for the currently active search mode only

```tsx
const address = useJapanAddress({
  dataSource,
  debounceMs: 300,
});

void address.searchByPostalCode("1000001");
void address.searchByAddressQuery({
  addressQuery: "千代田",
  pageNumber: 0,
  rowsPerPage: 10,
});
```

## Headless Components

### `PostalCodeInput`

- Renders a `<form>` with `<label>`, `<input>`, and `<button>`
- Supports controlled and uncontrolled usage
- Calls `onSearch` with a normalized digits-only postal code
- Defaults `inputMode="numeric"` unless overridden with `inputProps`

### `AddressSearchInput`

- Renders the same minimal form structure
- Supports controlled and uncontrolled usage
- Calls `onSearch` with a trimmed query string

Both components accept:

- `inputProps` for the rendered `<input>`
- `buttonProps` for the rendered `<button>`

## Data Source Integration

The package exports types for both sides of the integration:

- `JapanAddressDataSource`
- `JapanPostSearchcodeRequest`
- `JapanPostAddresszipRequest`
- `JapanPostalCodeSearchInput`
- `JapanAddressSearchInput`
- `JapanAddressRequestOptions`

The optional second argument to each data-source method is:

```ts
type JapanAddressRequestOptions = {
  signal?: AbortSignal;
};
```

The hooks pass `signal` so your data source can cancel superseded requests,
`cancel()` calls, `reset()` calls, and unmount cleanup.

This repository's reference backend uses these routes:

- `POST /q/japanpost/searchcode`
- `POST /q/japanpost/addresszip`

But those route names are not part of the package API. They are just the
example used by `apps/demo` and `apps/minimal-api`.

## Constraints And Notes

- `dataSource` is required at runtime for all hooks.
- `isValidJapanPostalCode()` checks for an exact 7-digit postal code after
  normalization. `useJapanPostalCode()` is less strict and accepts `3-7`
  digits for prefix lookup.
- `formatJapanPostalCode()` inserts a hyphen only when the normalized value is
  exactly 7 digits.
- `cancel()` on `useJapanPostalCode()` and `useJapanAddressSearch()` aborts the
  in-flight request but keeps the latest settled `data` and `error`.
- `reset()` clears both `data` and `error`.
- The package does not require a backend to return `404` for misses. Returning
  `200` with an empty page is also compatible with the hook contract.
- Use your own server-side API in the `dataSource` implementation. Keep Japan
  Post credentials and token exchange on the server side.
