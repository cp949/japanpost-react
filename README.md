# japanpost-react

[한국어](./README.ko.md)

Monorepo for `@cp949/japanpost-react`, a React package for Japan postal-code
and address lookup, plus a demo app and a local sample server used to verify the
integration flow locally.

## Overview

This repository has three main parts.

- `packages/japanpost-react`: the published package. It exports React hooks,
  headless input components, postal-code utilities, and public TypeScript
  types.
- `apps/demo`: a Vite + MUI demo app that exercises the package against a
  backend API.
- `apps/minimal-api`: a local-only Node HTTP sample server and demo integration
  helper that authenticates against the Japan Post API and normalizes
  responses to the same paged contract used by the package.

The supported integration model in this repository is server-backed:

```text
browser app
  -> your backend API
  -> Japan Post API
```

For local development in this workspace, the flow is:

```text
apps/demo
  -> /minimal-api/* on the Vite dev server
  -> apps/minimal-api on http://127.0.0.1:8788
  -> Japan Post API
```

The package and the sample server use the same paged response shape:

```ts
type Page<T> = {
  elements: T[];
  totalElements: number;
  pageNumber: number;
  rowsPerPage: number;
};
```

Shared request, response, and paging types are available from the root entry
via `import type`.

This is a breaking change from the earlier three-entry surface: the dedicated
`./contracts` subpath has been removed.

## Public Entry Points

- `@cp949/japanpost-react`: default package entry for hooks, headless inputs,
  utilities, and public types
- `@cp949/japanpost-react/client`: Next.js App Router client-component entry

Use the root entry when shared backend or sample-server code only needs
contract types. JavaScript consumers should not expect runtime helpers or
other values from the client entry.

## Recommended Environment

- Node.js 20+
- pnpm 10+

## Install The Published Package

```bash
pnpm add @cp949/japanpost-react
```

The package usage guide lives in
[`packages/japanpost-react/README.md`](./packages/japanpost-react/README.md).

## Demo App Examples

`apps/demo` is the fastest way to see how the package is meant to be wired in a
real React app. Run `pnpm demo:full` to explore these examples:

- `Dialog`: a search-button + modal flow built around
  `JapanPostalAddressField`.
- `Embedded`: the same lookup flow embedded directly in the page instead of a
  dialog.
- `useJapanAddressSearch()`: an address-search hook example focused on request
  and result handling.
- `useJapanPostalCode()`: a postal-code lookup hook example.
- `useJapanAddress()`: a combined example that handles both postal-code lookup
  and address search through one hook.

## Quick Start

Install dependencies:

```bash
pnpm install
```

If you want to run `pnpm demo:full` or `pnpm api:check`, create
`.secrets/env` first. Those scripts read that file directly; exporting the
variables only in your current shell is not enough for those entrypoints.
When the same key exists in both places, the explicit shell environment value
wins and `.secrets/env` acts as a fallback.
The sample server requires `JAPANPOST_CLIENT_ID` and
`JAPANPOST_SECRET_KEY`. `JAPANPOST_BASE_URL` is optional because the code has
its own default.

```bash
mkdir -p .secrets
cat > .secrets/env <<'EOF'
export JAPANPOST_CLIENT_ID=...
export JAPANPOST_SECRET_KEY=...
# Optional:
# export JAPANPOST_BASE_URL=...
EOF
```

Then start both the demo app and the sample server:

```bash
pnpm demo:full
```

`pnpm demo:full` starts `apps/minimal-api`, waits until `GET /health` returns
HTTP `200` with `{ ok: true }` from the instance it launched, and only then
starts `apps/demo`. The default ports are:

- demo app: `5173`
- minimal-api: `8788`

## Common Commands

- `pnpm demo:full`: run the demo app and the local sample server together.
  Node-based entrypoint that works in Windows native shells too. Requires
  `.secrets/env`. Shell env overrides file values when both are set.
- `pnpm api:dev`: run `apps/minimal-api` only.
  This path can use explicit shell env by itself or fall back to `.secrets/env`
  when values are missing.
- `pnpm demo:dev`: run `apps/demo` only. By default, the Vite proxy forwards
  `/minimal-api/*` to `http://127.0.0.1:${PORT:-8788}`.
- `pnpm api:check`: start the sample server and verify `/health`,
  `/q/japanpost/searchcode`, and `/q/japanpost/addresszip` against the real
  upstream. Node-based entrypoint that works in Windows native shells too.
  Requires `.secrets/env`. Shell env overrides file values when both are set.
- `pnpm test`: run the cross-platform repository verification path. This
  Node-based root entrypoint works in Windows native shells and checks
  generated package README sync, package unit tests, and workspace integration
  tests.
- `pnpm check-types`: run workspace type checks through Turbo.

Direct `scripts/*.sh` entrypoints remain Bash-only convenience wrappers for
Linux, macOS, or WSL shell users. Windows native contributors should prefer the
documented `pnpm ...` commands.

## Workspace Layout

```text
.
├── apps/
│   ├── demo/                 Vite demo app
│   └── minimal-api/          Local sample server for demo verification
├── packages/
│   └── japanpost-react/      Published package
├── CONTRIBUTING.md
├── CHANGELOG.md
├── README.md
```

The workspace is wired with `pnpm-workspace.yaml` and `turbo.json`.

## Package, Demo, And Server Relationship

- The package does not ship a backend client. Consumers must provide a
  `JapanAddressDataSource`.
- New backend or sample-server code should prefer the root entry for shared
  request, response, and page types.
- `apps/demo/src/demoApi.ts` is the repository's example data-source adapter.
  It is local demo code, not a package export.
- `apps/demo` resolves `@cp949/japanpost-react` and
  `@cp949/japanpost-react/client` straight to `packages/japanpost-react/src/*`
  during local development, and `pnpm test:workspace` keeps those recommended
  imports exercised.
- `apps/minimal-api` exposes `GET /health`, `POST /q/japanpost/searchcode`,
  and `POST /q/japanpost/addresszip`.

## Related Docs

- Package guide:
  [`packages/japanpost-react/README.md`](./packages/japanpost-react/README.md)
- Korean repository guide:
  [`README.ko.md`](./README.ko.md)
- Korean note on the sample-server contract:
  [`minimal-api-sample-server-guide.ko.md`](./minimal-api-sample-server-guide.ko.md)
- Contribution notes:
  [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- Release history:
  [`CHANGELOG.md`](./CHANGELOG.md)

## Notes

- `apps/minimal-api` keeps a fixed permissive CORS response because it is only
  a local sample server for `apps/demo` and `api:check`, not production
  middleware.
- Blank address searches are normalized to an empty page by the sample server
  instead of a hard error.
- Package README files in `packages/japanpost-react` are generated from
  `packages/japanpost-react/docs/README.en.md` and
  `packages/japanpost-react/docs/README.ko.md`.
