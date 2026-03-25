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

This package is published as ESM. Use `@cp949/japanpost-react` as the default
app entry and source of public request, response, and paging types, and use
`@cp949/japanpost-react/client` for Next.js App Router client components.
CommonJS consumers must use ESM interop. `require("@cp949/japanpost-react")`
and `require("@cp949/japanpost-react/client")` are not supported. In
CommonJS, use ESM interop such as `const pkg = await import("@cp949/japanpost-react");`.

Breaking change: the dedicated `./contracts` subpath has been removed, so the
root entry is now the single source for shared public types.

## Entry Points

- `@cp949/japanpost-react`: default app entry for utilities, hooks, headless
  inputs, and public types
- `@cp949/japanpost-react/client`: client-component entry for Next.js App
  Router usage

## Next.js

When you use hooks or headless input components in the Next.js App Router,
import them from `@cp949/japanpost-react/client` inside a Client Component.
Keep utility functions and shared request, response, and page types on the
root entry via `import type`.

```tsx
"use client";

import { PostalCodeInput, useJapanPostalCode } from "@cp949/japanpost-react/client";
import { normalizeJapanPostalCode, type JapanAddressDataSource } from "@cp949/japanpost-react";
```

## What The Package Provides

- Hooks for postal-code lookup and address search:
  `useJapanPostalCode`, `useJapanAddressSearch`, `useJapanAddress`
- Headless form components:
  `PostalCodeInput`, `AddressSearchInput`
- Utilities:
  `normalizeJapanPostalCode`, `formatJapanPostalCode`,
  `formatJapanAddressDisplay`, `formatJapanAddressSearchResultLabel`,
  `isValidJapanPostalCode`, `normalizeJapanPostAddressRecord`,
  `createJapanAddressError`, `createJapanPostFetchDataSource`,
  `createJapanPostApiDataSource`
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
  type JapanAddressDataSource,
  type JapanAddressRequestOptions,
} from "@cp949/japanpost-react";
import type { JapanAddress, Page } from "@cp949/japanpost-react";

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

The example paths above match this repository's local sample server. In your
own app, the backend routes can be different as long as your `dataSource`
implementation returns the same public types.

In Next.js, keep the `dataSource` implementation pointed at your own server-side
API routes. Do not expose Japan Post credentials or token exchange logic to the
browser.

## Consumer Helpers

The root entry also exports a small set of helpers that are convenient when
you build your own consumer UI:

- `formatJapanAddressDisplay(address)` normalizes `address.address` to a
  readable single line.
- `formatJapanAddressSearchResultLabel(address)` prefixes the formatted postal
  code for accessible result labels.
- `createJapanPostFetchDataSource({ baseUrl, ... })` wraps fetch-based
  backends that follow the package request/response contract.
- `createJapanPostApiDataSource(api, options?)` adapts an existing
  `searchcode` / `addresszip` client to `JapanAddressDataSource`. It keeps
  whatever error handling and error shape your existing client already uses,
  so this adapter only focuses on request/context wiring and optional page
  mapping.

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

Use this adapter when your API client already owns transport and error
normalization. If you want the package's built-in fetch error mapping,
prefer `createJapanPostFetchDataSource(...)`.

## Core Contract

`Page<T>` is the result shape shared by the hooks, your backend integration,
and this repository's local sample server:

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

Prefer the root entry when backend or sample-server code only needs the shared
request, response, and page contract types. `import type` keeps the intent
clear without adding another public entry point.

The optional second argument to each data-source method is:

```ts
type JapanAddressRequestOptions = {
  signal?: AbortSignal;
};
```

The hooks pass `signal` so your data source can cancel superseded requests,
`cancel()` calls, `reset()` calls, and unmount cleanup.

This repository's local sample server uses these routes:

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
