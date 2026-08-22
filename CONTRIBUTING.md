# Contributing

This repository uses a `pnpm workspace + turbo` layout.

## Prerequisites

- Node.js 20+
- pnpm 10+
- `.secrets/env` for `pnpm demo:full` and `pnpm api:check`

`pnpm test`, `pnpm demo:full`, and `pnpm api:check`
run through Node-based entrypoints and do not require Bash.
Direct `scripts/*.sh` execution remains a Bash-only convenience path.

## Setup

```bash
pnpm install
```

## Verify Before Opening a Change

Run the repository verification path:

```bash
pnpm test
```

This cross-platform path covers generated package README sync, package unit
tests, and workspace integration tests around `apps/minimal-api` and the local
development helper scripts. It also keeps the demo workspace wiring for
`@cp949/japanpost-react` and `@cp949/japanpost-react/client` under test. It
does not rebuild package artifacts.

For package-only changes, this focused path runs the package unit tests without rebuilding artifacts:

```bash
pnpm test:package
```

When you only need the package unit tests without rebuilding artifacts:

```bash
pnpm test:package:unit
```

For demo-only import or alias changes, this focused check keeps the local Vite
app's type-resolution path honest:

```bash
pnpm --filter demo check-types
```

## Documentation

- Package README content is generated. Edit `packages/japanpost-react/docs/README.en.md`
  and `packages/japanpost-react/docs/README.ko.md`, then run `pnpm readme:package`.
  This updates `packages/japanpost-react/README.md` and
  `packages/japanpost-react/README.ko.md`.

## Browser Support Baseline

The browser support contract has one source: the `browserslist` field of
`packages/japanpost-react/package.json`. The esbuild build target, both
compatibility gates, and the README "Browser Support" section are derived from
it, so editing that field is the only way to change the contract.

After editing it, regenerate the package README and run the verification path:

```bash
pnpm readme:package
pnpm test
```

The query is resolved against `caniuse-lite`. This repository has no Renovate
or Dependabot, so that data is refreshed manually:

```bash
npx update-browserslist-db@latest
```

Whether a refresh changes anything depends on the query form. An absolute lower
bound (`chrome >= <version>`) is unaffected: newer data only appends higher
versions, so the derived minimum does not move. A relative query (`defaults`,
`last 2 versions`, `>0.5%`) does move with the data, so refresh before trusting
a gate result under one. Refresh as well when `browserslist` reports that its
data is outdated.

The runtime API gate resolves each API against `@mdn/browser-compat-data`, a
second dataset with its own release cadence. Stale data means stale verdicts,
so refresh it alongside `caniuse-lite`:

```bash
pnpm --filter @cp949/japanpost-react up @mdn/browser-compat-data
```

The gate throws when a fixed BCD key it depends on stops resolving, so a
breaking upgrade fails loudly rather than passing silently. Two keys are fixed:
`javascript.builtins.Error.Error.options_cause_parameter` and
`api.EventTarget.addEventListener.options_parameter.options_signal_parameter`.

The gate reports three tiers, and they differ in how much they can prove.
Tier 1 resolves the receiver through scope analysis, so a report there is a
real use of the named global. Tier 2 covers members whose receiver type is not
statically known (`x.at(0)`, `x.with(i, v)`) — a real violation and a
same-named method on an unrelated object are indistinguishable. Tier 3 matches
two option subfeatures and they are not equally strict: `new Error(m, { cause })`
checks that the constructor resolves to a global, while
`addEventListener(t, f, { signal })` does not check the receiver at all, because
enumerating every `EventTarget` subclass and bundler alias would under-report
more than the looser match over-reports.

Record false positives in the `ALLOWED` list of
`packages/japanpost-react/scripts/compat-scanner.mjs`. Each entry needs `file`,
`name`, and `reason`; the scanner throws on an entry missing any of them or
naming an API absent from the index.

## Scope Notes

- Keep changes small and focused.
- Do not commit secrets. Local credentials belong in `.secrets/env`.
- For local dev entrypoints, explicit shell env overrides `.secrets/env` when
  both provide the same key.
- `apps/demo` is a local verification app.
- `apps/minimal-api` is intentionally a small, local-only sample server for
  `pnpm demo:full` and `pnpm api:check`.
- Do not grow `apps/minimal-api` into a reference backend or an operational
  policy example. Production backend policy examples belong elsewhere.
