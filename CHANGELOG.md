# Changelog

The complete public API and SDK changelog is maintained at
[developers.hollyhr.com/changelog](https://developers.hollyhr.com/changelog).

## 0.1.0-preview.6 - prepared

- Preserved the strong `HollyHR-Resource-ETag` write validator separately
  from hosting-layer cache ETags.
- Taught the client to prefer that resource validator, accept a standard
  strong ETag as a compatibility fallback, and fail closed when only a weak
  cache ETag is returned.
- Updated the matching OpenAPI contract, tests and safe-write guidance.

## 0.1.0-preview.5 - prepared

- Added public repository and GitHub issue metadata for npm consumers.
- Published the matching SDK source, tests, examples and versioned OpenAPI
  contract without changing the generated API operation surface.

## 0.1.0-preview.4 - 2026-08-29

- Added generated time-off approval and decline operations.
- Added a governed time-off decision example using a fresh read, ETag,
  idempotency key and explicit approve-or-decline input.
- Clarified that the SDK is a prerelease client for the Public Preview API.
