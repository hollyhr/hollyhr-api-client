# Releasing

This repository is the public, inspectable source home for
`@hollyhr/api-client`. The HollyHR product repository remains the generation
and publication control plane for the OpenAPI contract and npm package.

For every release, HollyHR will:

1. Generate and validate the SDK against the versioned OpenAPI contract.
2. Synchronise the matching source and `openapi/openapi.v1.yaml` here.
3. Tag the public source commit with `v<package-version>`.
4. Publish that immutable version from the controlled HollyHR release source.
5. Verify npm integrity, `latest`, documentation and source links.

Preview versions remain prereleases even while the public API is in Public
Preview. Stable `1.0` requires external adoption and contract confidence; it is
not inferred from repository publication alone.
