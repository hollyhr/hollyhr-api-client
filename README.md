# HollyHR TypeScript SDK

Official preview TypeScript client for the HollyHR public API.

- [Developer documentation](https://developers.hollyhr.com/)
- [Versioned OpenAPI contract](./openapi/openapi.v1.yaml)
- [npm package](https://www.npmjs.com/package/@hollyhr/api-client)
- [Runnable API, webhook and MCP examples](https://github.com/hollyhr/hollyhr-api-examples)
- [Public Postman workspace](https://www.postman.com/hollyhr/workspace/hollyhr-public-api~73d93b69-5cda-44a4-b491-db7062f974bd/overview)
- [Hosted MCP discovery](https://github.com/hollyhr/hollyhr-mcp)
- [Issues](https://github.com/hollyhr/hollyhr-api-client/issues)

## Install

Install the public preview package from npm:

```bash
pnpm add @hollyhr/api-client
```

The package is ESM-only and supports Node.js 20+ plus runtimes with a standard
`fetch` implementation.

For unreleased changes, use a workspace dependency or a private tarball produced
with `pnpm sdk:pack`. HollyHR publishes this package only from the official
`@hollyhr` npm scope.

## First call

Set your tenant base URL and token:

```bash
export HOLLYHR_API_BASE_URL="https://{workspace}.hollyhr.com/api/v1"
export HOLLYHR_API_TOKEN="hhr_live_..."
```

For the hosted HollyHR sandbox, use:

```bash
export HOLLYHR_API_BASE_URL="https://sandbox.hollyhr.com/api/v1"
export HOLLYHR_API_TOKEN="hhr_test_..."
```

```ts
import { createHollyHrApiClient } from "@hollyhr/api-client";

const hollyhr = createHollyHrApiClient({
  baseUrl: process.env.HOLLYHR_API_BASE_URL!,
  token: process.env.HOLLYHR_API_TOKEN!,
});

const people = await hollyhr.get("/people", { query: { limit: 10 } });

console.log({
  requestId: people.requestId,
  rateLimit: people.rateLimit,
  data: people.data,
});
```

The npm package also ships runnable examples:

```bash
node node_modules/@hollyhr/api-client/examples/first-call.mjs
node node_modules/@hollyhr/api-client/examples/paginate-people.mjs
```

## Pagination

```ts
for await (const person of hollyhr.paginate("/people", { query: { limit: 50 } })) {
  console.log(person);
}
```

## Safe writes

Use idempotency keys for creates and other retryable writes. Use `If-Match`
when updating resources that return a write-safe resource validator. SDK
responses expose `HollyHR-Resource-ETag` as `response.etag`, fall back to a
standard strong `ETag`, and never present a weak cache ETag as write-safe.

```ts
import { createIdempotencyKey } from "@hollyhr/api-client";

await hollyhr.patch("/people/{personId}", {
  pathParams: { personId: "7k3m9q2vx6rt" },
  ifMatch: '"etag-from-read"',
  idempotencyKey: createIdempotencyKey("update_person"),
  body: { job_title: "People Lead" },
});
```

The package includes a conditional update example that first reads the
write-safe validator:

```bash
export HOLLYHR_PERSON_ID="7k3m9q2vx6rt"
export HOLLYHR_JOB_TITLE="People Lead"
node node_modules/@hollyhr/api-client/examples/safe-update-person.mjs
```

### Governed time-off decisions

Approve or decline one pending standard time-off request only after fetching
its current write-safe validator. The operation requires an explicitly granted
`time_off:write` scope, `If-Match`, and an idempotency key. Decline may include
an optional private response note.

```bash
export HOLLYHR_TIME_OFF_ID="time_off_..."
export HOLLYHR_TIME_OFF_DECISION="approve" # or decline
# Optional for decline only:
# export HOLLYHR_TIME_OFF_RESPONSE_NOTE="Private note of up to 512 characters"
node node_modules/@hollyhr/api-client/examples/governed-time-off-decision.mjs
```

The example stops if the read does not return a write-safe validator and
accepts only the explicit `approve` or `decline` decision values.

## Webhook signatures

```ts
import { verifyWebhookSignature } from "@hollyhr/api-client";

const valid = await verifyWebhookSignature({
  payload: rawBody,
  secret: process.env.HOLLYHR_WEBHOOK_SECRET!,
  webhookIdHeader: request.headers.get("hollyhr-webhook-id")!,
  timestampHeader: request.headers.get("hollyhr-webhook-timestamp")!,
  signatureHeader: request.headers.get("x-hollyhr-signature")!,
});
```

Reject deliveries when signature verification returns `false`.

For a local payload file and captured HollyHR delivery headers:

```bash
export HOLLYHR_WEBHOOK_SECRET="whsec_..."
export HOLLYHR_WEBHOOK_PAYLOAD_PATH="./payload.json"
export HOLLYHR_WEBHOOK_SIGNATURE="v1=..."
export HOLLYHR_WEBHOOK_TIMESTAMP="2026-06-23T12:00:00.000Z"
export HOLLYHR_WEBHOOK_ID="evt_..."
node node_modules/@hollyhr/api-client/examples/verify-webhook-signature.mjs
```

## Generated API catalogue

The SDK exports generated operation metadata from HollyHR's OpenAPI contract:

```ts
import { HOLLYHR_API_OPERATION_BY_ID } from "@hollyhr/api-client";

const listPeople = HOLLYHR_API_OPERATION_BY_ID.get("listPeople");
```

The package is generated from `docs/api/openapi.v1.yaml` and includes helpers
for request IDs, rate-limit headers, ETags, `If-Match`, idempotency keys,
cursor pagination, typed API errors, and webhook signature verification.

## Preview status

This package is a prerelease client for HollyHR's public API, which is in
Public Preview. The package is build-gated in CI and published from the
official `@hollyhr` npm scope. Use the developer docs for current setup,
scopes, and examples:

- https://developers.hollyhr.com/typescript-sdk
- https://developers.hollyhr.com/quickstart
- https://developers.hollyhr.com/support

## Contributing and releases

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the supported contribution path,
[SECURITY.md](./SECURITY.md) for private vulnerability reporting and
[RELEASING.md](./RELEASING.md) for the source-sync and version policy. Paul
Gould is the accountable repository owner; executable changes must pass the
repository CI check before merge.
