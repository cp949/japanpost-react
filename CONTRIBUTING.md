# Contributing

This repository uses a `pnpm workspace + turbo` layout.

## Prerequisites

- Node.js 20+
- pnpm 10+
- Bash on Linux or WSL for repository scripts

## Setup

```bash
pnpm install
```

## Verify Before Opening a Change

Run the repository verification path:

```bash
pnpm test
```

This covers generated package README sync, package unit tests, and the shell
regressions around `scripts/check-api.sh` and `scripts/dev-demo.sh`. It does
not rebuild package artifacts.

For package-only changes, this focused path runs the package unit tests without rebuilding artifacts:

```bash
pnpm test:package
```

When you only need the package unit tests without rebuilding artifacts:

```bash
pnpm test:package:unit
```

## Documentation

- Package README content is generated. Edit `packages/japanpost-react/docs/README.en.md`
  and `packages/japanpost-react/docs/README.ko.md`, then run `pnpm readme:package`.
  This updates `packages/japanpost-react/README.md` and
  `packages/japanpost-react/README.ko.md`.

## Scope Notes

- Keep changes small and focused.
- Do not commit secrets. Local credentials belong in `.secrets/env`.
- The demo and minimal API are reference implementations for local verification.
