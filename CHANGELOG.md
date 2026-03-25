# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic
Versioning for published package releases where applicable.

## [Unreleased]

- Breaking change: clarified the public entrypoint policy for
  `@cp949/japanpost-react` and `@cp949/japanpost-react/client`, removing the
  dedicated contracts subpath and making the root entry the single source for
  shared request, response, and paging types.
- Split direct `apps/minimal-api` and local script checks out of the package
  test suite into repository-level workspace tests, and documented that
  `apps/minimal-api` remains a small local-only sample server.

## [1.0.5] - 2026-03-25

- Tightened public error normalization and input handling around the React
  hooks and headless inputs.
- Forwarded input refs on the headless form components to improve integration
  with consuming form libraries and app code.

## [1.0.4] - 2026-03-25

- Migrated the package build to `tsup` and aligned emitted ESM artifacts around
  the current root/client entrypoint contract.
- Continued the package-only release line after the `1.0.3` publish.

## [1.0.3] - 2026-03-25

- Published the ESM-only package contract for `@cp949/japanpost-react`.
- Clarified the split between the root entry and the dedicated `./client`
  export for client-side React usage.

## [1.0.2] - 2026-03-24

- Published the contract alignment work that standardized the page-based public
  response surface and empty-page handling.

## [1.0.1] - 2026-03-24

- Recorded the public request contract removal of
  `includeBusinessAddresses` and aligned contract tests and docs around the
  published page-based response surface.
- Fixed the `api:check` verification path to validate the current `address`
  field contract instead of the removed `formattedAddress` field.
- Added a happy-path shell regression for `scripts/check-api.sh` and aligned
  the existing check-api fixture payloads with the current API response shape.
- Clarified repository verification docs so `pnpm test`,
  and `pnpm api:check` describe their actual scope.
