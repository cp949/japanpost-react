# japanpost-react

[한국어](./README.ko.md)

React + TypeScript workspace for Japan postal-code and address lookup.

The repository uses a `pnpm workspace + turbo` layout and contains:

- `packages/japanpost-react`: published React hooks and headless inputs
- `apps/minimal-api`: local reference server for real upstream integration
- `apps/demo`: Vite demo app for end-to-end verification

## Recommended Environment

- Node.js 20+
- pnpm 10+
- Linux or WSL with Bash, `curl`, `ps`, `awk`, `setsid` available on PATH for repository scripts
- A `.secrets/env` file when running the full local demo stack

## Running Locally

Install dependencies first:

```bash
pnpm install
```

Start the full local stack:

```bash
pnpm demo:full
```

This starts both the browser demo and `apps/minimal-api`. The script requires a
root-level `.secrets/env` file, waits for `GET /health` to return HTTP `200`
with `{ "ok": true }`, and verifies that the response came from the exact
minimal-api instance it started. The default ports are `8788` for the API
server and `5173` for the demo app.

Minimum `.secrets/env` example:

```bash
export JAPAN_POST_BASE_URL=...
export JAPAN_POST_CLIENT_ID=...
export JAPAN_POST_SECRET_KEY=...
```

If you change `PORT`, the demo dev proxy now follows that port automatically.
If you need a different upstream entirely, set `DEMO_API_PROXY_URL`.

You can also run the pieces separately:

```bash
pnpm api:dev
pnpm demo:dev
```

To verify the real upstream-backed server integration:

```bash
pnpm api:check
```

This command expects a usable `.secrets/env` file with real upstream
credentials because it starts `apps/minimal-api` and exercises `/health`,
`/searchcode/:code`, and `/addresszip`.

To run the repository verification path:

```bash
pnpm test
```

That root entrypoint runs the package test suite, verifies the generated
package README is in sync with `packages/japanpost-react/docs`, and runs the
Linux/WSL-oriented shell regressions for `check-api.sh` and `dev-demo.sh`
together.

## Install

```bash
pnpm add @cp949/japanpost-react
```

- Supported React versions: React 18 and React 19
- The published package lives in [`packages/japanpost-react`](./packages/japanpost-react)
- Package usage docs live in [`packages/japanpost-react/README.md`](./packages/japanpost-react/README.md)

## More Docs

- Internal development and API integration notes: [`japanpost-development-guide.md`](./japanpost-development-guide.md)
- Demo app source: [`apps/demo`](./apps/demo)
- Local reference server: [`apps/minimal-api`](./apps/minimal-api)
