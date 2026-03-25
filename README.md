# japanpost-react

[한국어](./README.ko.md)

Monorepo for `@cp949/japanpost-react`, a React package for Japan postal-code
and address lookup, plus a demo app and a reference backend used to verify the
integration flow locally.

## Overview

This repository has three main parts.

- `packages/japanpost-react`: the published package. It exports React hooks,
  headless input components, postal-code utilities, and public TypeScript
  types.
- `apps/demo`: a Vite + MUI demo app that exercises the package against a
  backend API.
- `apps/minimal-api`: a small Node HTTP server that authenticates against the
  Japan Post API and normalizes responses to the same paged contract used by
  the package.

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

Both the package and the reference backend use the same paged response shape:

```ts
type Page<T> = {
  elements: T[];
  totalElements: number;
  pageNumber: number;
  rowsPerPage: number;
};
```

## Recommended Environment

- Node.js 20+
- pnpm 10+
- Linux or WSL Bash for repository shell scripts

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
The reference backend requires `JAPANPOST_CLIENT_ID` and
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

Then start both the demo app and the reference backend:

```bash
pnpm demo:full
```

`pnpm demo:full` starts `apps/minimal-api`, waits until `GET /health` returns
HTTP `200` with `{ ok: true }` from the instance it launched, and only then
starts `apps/demo`. The default ports are:

- demo app: `5173`
- minimal-api: `8788`

## Common Commands

- `pnpm demo:full`: run the demo app and the reference backend together.
  Requires `.secrets/env`.
- `pnpm api:dev`: run `apps/minimal-api` only.
- `pnpm demo:dev`: run `apps/demo` only. By default, the Vite proxy forwards
  `/minimal-api/*` to `http://127.0.0.1:${PORT:-8788}`.
- `pnpm api:check`: start the reference backend and verify `/health`,
  `/q/japanpost/searchcode`, and `/q/japanpost/addresszip` against the real
  upstream. Requires `.secrets/env`.
- `pnpm test`: run the repository verification path. This checks generated
  package README sync and the package test suite.
- `pnpm check-types`: run workspace type checks through Turbo.

`demo:full`, `api:check`, and the shell regression scripts assume a Linux or
WSL-style Bash environment.

## Workspace Layout

```text
.
├── apps/
│   ├── demo/                 Vite demo app
│   └── minimal-api/          Reference backend for local verification
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
- `apps/demo/src/demoApi.ts` is the repository's example data-source adapter.
  It is local demo code, not a package export.
- `apps/demo/vite.config.ts` aliases `@cp949/japanpost-react` to
  `packages/japanpost-react/src/index.ts`, so the demo uses workspace source
  files directly during development.
- `apps/minimal-api` exposes `GET /health`, `POST /q/japanpost/searchcode`,
  and `POST /q/japanpost/addresszip`.

## Related Docs

- Package guide:
  [`packages/japanpost-react/README.md`](./packages/japanpost-react/README.md)
- Korean repository guide:
  [`README.ko.md`](./README.ko.md)
- Minimal-api production guide in Korean:
  [`minimal-api-production-guide.ko.md`](./minimal-api-production-guide.ko.md)
- Contribution notes:
  [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- Release history:
  [`CHANGELOG.md`](./CHANGELOG.md)

## Notes

- The reference backend currently sends `access-control-allow-origin: "*"`.
  That is for local development only.
- Blank address searches are normalized to an empty page by the reference
  backend instead of a hard error.
- Package README files in `packages/japanpost-react` are generated from
  `packages/japanpost-react/docs/README.en.md` and
  `packages/japanpost-react/docs/README.ko.md`.
