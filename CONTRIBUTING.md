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
pnpm --filter @repo/browser-baseline up @mdn/browser-compat-data
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

Record false positives in the `browserBaseline.allow` array of
`packages/japanpost-react/package.json`. Each entry needs `file`, `name`, and
`reason`; the scanner throws on an entry missing any of them or naming an API
absent from the index.

## `@repo/browser-baseline` Package

The gate implementation lives in `packages/browser-baseline`, a private
workspace package (`private: true`, not published to npm). The two
compatibility gates described above, the `checkPackageBaseline` /
`formatReport` orchestration, and the CLI all live under its `src/` and
`bin/`. It takes a `packageDir` argument and does not depend on this
repository's layout beyond that.

Run it with:

```bash
pnpm --filter @cp949/japanpost-react compat:check
```

or, for any package directory, `browser-baseline check --dir <path>` (exit 0
on a pass, 1 on a violation, 2 on a usage error). `packages/japanpost-react`'s
`build` script runs the same check after the build.

The package name reads broader than what it actually checks. The contract is
a Chrome-lower-bound checker driven by an array-form `browserslist` query, not
a general multi-browser one:

- `packages/browser-baseline/src/baseline.mjs:46-55` derives the Chrome lower
  bound from the esbuild target and throws when none is found, so a
  `browserslist` with no Chrome entry (`["firefox >= 100"]`) makes the package
  unusable — it fails loudly, not silently.
- A mixed query (`["defaults"]`) still derives a Chrome minimum, but the
  runtime API gate checks only against that Chrome minimum — it never looks
  at Safari/Firefox lower bounds, so violations against those browsers pass
  silently. Under-reporting, not an error.
- The syntax gate has no such gap: it runs on the full `esbuildTarget` array
  (every browser the query resolves to), so it stays genuinely multi-browser.
  The Chrome-only limitation is confined to the runtime API gate.
- `packages/browser-baseline/src/baseline.mjs:37` requires `browserslist` to
  be an array (`Array.isArray`), so the string form (`"chrome >= 80"`, valid
  npm syntax) throws too.

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
