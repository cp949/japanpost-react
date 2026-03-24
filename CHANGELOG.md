# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic
Versioning for published package releases where applicable.

## [Unreleased]

- Recorded the public request contract removal of
  `includeBusinessAddresses` and aligned contract tests and docs around the
  published page-based response surface.
- Fixed the `api:check` verification path to validate the current `address`
  field contract instead of the removed `formattedAddress` field.
- Added a happy-path shell regression for `scripts/check-api.sh` and aligned
  the existing check-api fixture payloads with the current API response shape.
- Clarified repository verification docs so `pnpm test`,
  and `pnpm api:check` describe their actual scope.
