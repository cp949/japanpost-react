# @cp949/japanpost-react

React + TypeScript hooks and headless inputs for Japan postal-code and address
lookup.

This package guide covers the published library. Repository-level demo scripts
such as `pnpm demo:full` currently target Linux/WSL-style shell environments
and are documented in the root README.

## Install

```bash
pnpm add @cp949/japanpost-react
```

- Supported React versions: React 18 and React 19

## Quick Start

```tsx
import { useJapanPostalCode } from "@cp949/japanpost-react";
import type { JapanAddressDataSource } from "@cp949/japanpost-react";
import { createJapanAddressError } from "@cp949/japanpost-react";

// The only supported integration model is a real server-backed flow.
// Point the data source at your own backend API.
const dataSource: JapanAddressDataSource = {
  async lookupPostalCode(postalCode) {
    const res = await fetch(`/searchcode/${postalCode}`);
    if (!res.ok) {
      const message = `Postal code lookup failed with status ${res.status}`;

      if (res.status === 400) {
        throw createJapanAddressError("invalid_postal_code", message, {
          status: res.status,
        });
      }

      if (res.status === 404) {
        throw createJapanAddressError("not_found", message, {
          status: res.status,
        });
      }

      if (res.status === 504) {
        throw createJapanAddressError("timeout", message, {
          status: res.status,
        });
      }

      throw createJapanAddressError("data_source_error", message, {
        status: res.status,
      });
    }
    const payload = await res.json();
    if (!Array.isArray(payload.addresses)) {
      throw createJapanAddressError(
        "bad_response",
        "Postal code lookup returned an invalid payload",
      );
    }
    return payload.addresses;
  },
  async searchAddress(query) {
    const res = await fetch(`/addresszip?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      const message = `Address search failed with status ${res.status}`;

      if (res.status === 400) {
        throw createJapanAddressError("invalid_query", message, {
          status: res.status,
        });
      }

      if (res.status === 404) {
        throw createJapanAddressError("not_found", message, {
          status: res.status,
        });
      }

      if (res.status === 504) {
        throw createJapanAddressError("timeout", message, {
          status: res.status,
        });
      }

      throw createJapanAddressError("data_source_error", message, {
        status: res.status,
      });
    }
    const payload = await res.json();
    if (!Array.isArray(payload.addresses)) {
      throw createJapanAddressError(
        "bad_response",
        "Address search returned an invalid payload",
      );
    }
    return payload.addresses;
  },
};

export function PostalForm() {
  const { loading, data, error, search } = useJapanPostalCode({ dataSource });

  return (
    <div>
      <button onClick={() => void search("100-0001")}>Search</button>
      {loading && <p>Loading...</p>}
      {error && (
        <p>
          {error.code}: {error.message}
        </p>
      )}
      {data?.addresses.map((addr) => (
        <p key={addr.postalCode + addr.address}>{addr.address}</p>
      ))}
    </div>
  );
}
```

## Exports

- `normalizeJapanPostalCode`
- `formatJapanPostalCode`
- `normalizeJapanPostAddressRecord`
- `isValidJapanPostalCode`
- `createJapanAddressError`
- `useJapanPostalCode`
- `useJapanAddressSearch`
- `useJapanAddress`
- `PostalCodeInput`
- `AddressSearchInput`
- Public types including `JapanAddress` and `JapanAddressDataSource`
- Request options type: `JapanAddressRequestOptions`

## Utility Notes

`formatJapanPostalCode()` inserts a hyphen only when the normalized value is
exactly 7 digits. For any other length, it returns the normalized digits
without inserting a hyphen.

## Hooks

### useJapanPostalCode

Looks up addresses by postal code. The hook accepts `3-7` digits and uses
prefix search when the input has `3-6` digits.

```tsx
const { loading, data, error, search, reset } = useJapanPostalCode({
  dataSource,
});
```

### useJapanAddressSearch

Searches addresses by free-form keyword and supports debouncing.

```tsx
const { loading, data, error, search, reset } = useJapanAddressSearch({
  dataSource,
  debounceMs: 300,
});
```

### useJapanAddress

Combines postal-code lookup and keyword search into one hook.

```tsx
const { loading, data, error, searchByPostalCode, searchByKeyword, reset } =
  useJapanAddress({ dataSource, debounceMs: 300 });
```

All hooks require `dataSource` at runtime.

## Error Handling Notes

`JapanAddressDataSource` should return `JapanAddress[]` directly from both
methods. The hooks wrap those arrays into lookup/search result objects.

Both methods may also receive an optional second argument:

```ts
type JapanAddressRequestOptions = {
  signal?: AbortSignal;
};
```

Hooks pass `signal` so your data source can cancel superseded requests,
`reset()` calls, and unmount cleanup when your backend layer supports aborts.

Recommended error-code mapping:

| Situation | Recommended code |
| --- | --- |
| Invalid postal code input | `invalid_postal_code` |
| Blank keyword input | `invalid_query` |
| Network failure | `network_error` |
| Request aborted / timeout | `timeout` |
| No matching addresses | `not_found` |
| Malformed success payload | `bad_response` |
| Other backend failures | `data_source_error` |

In this repository's reference demo flow, the sample `dataSource` maps `400
/searchcode/...` to `invalid_postal_code`, `400 /addresszip?...` to
`invalid_query`, `404` to `not_found`, and `504` to `timeout`.

## Headless Components

`PostalCodeInput` and `AddressSearchInput` provide behavior and DOM structure
without bundled styles, so you can plug them into your own design system.

Both components also support native prop passthrough:

- `inputProps`: forwarded to the rendered `<input />`
- `buttonProps`: forwarded to the rendered `<button />`

Use these for `id`, `name`, `placeholder`, `aria-*`, `autoComplete`,
`className`, and form integration. `PostalCodeInput` defaults to
`inputMode="numeric"` unless you override it through `inputProps`.

## Data Source and Server Integration

Use this package with your own backend server. The official Japan Post flow
uses token-based authentication, so browser apps should not hold upstream
credentials directly. The supported integration model is a real server-backed
flow.

This repository includes `apps/minimal-api` as the reference local server. It
wraps Japan Post API ver 2.0 and is intended for local development and
integration testing. The demo's `/minimal-api` path is only a development-time
route to that local server. When the upstream payload includes both structured
address parts and a free-form `address` string, the reference server keeps the
display address non-duplicated instead of concatenating both blindly.

Timeout messages can differ depending on whether the token exchange timed out or
the upstream lookup request timed out. Both cases still map cleanly to the
`timeout` error code.

## SSR

Use your server-side API from the `dataSource` implementation, and keep token
exchange plus upstream signing on the server. React hooks and UI components
should stay in client components.
