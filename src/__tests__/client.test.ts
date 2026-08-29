/**
 * @file Tests for the HollyHR TypeScript SDK client helpers.
 */

import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  createHollyHrApiClient,
  createIdempotencyKey,
  HOLLYHR_API_OPERATION_BY_ID,
  HollyHrApiError,
  verifyWebhookSignature,
} from "../index";

describe("HollyHrApiClient", () => {
  it("sends bearer auth, query parameters, idempotency keys, and conditional headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: "7k3m9q2vx6rt" }] }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ETag: '"etag-1"',
          "X-Request-Id": "req_123",
          "RateLimit-Limit": "120",
          "RateLimit-Remaining": "119",
          "RateLimit-Reset": "60",
        },
      }),
    );
    const client = createHollyHrApiClient({
      baseUrl: "https://acme.hollyhr.com/api/v1",
      token: "hhr_test_123",
      fetch: fetchMock as typeof fetch,
    });

    const response = await client.patch<{ data: readonly { id: string }[] }>("/people/{personId}", {
      pathParams: { personId: "7k3m9q2vx6rt" },
      query: { include: "employment" },
      body: { job_title: "People Lead" },
      idempotencyKey: "idem_123",
      ifMatch: '"etag-0"',
    });

    expect(response.data.data[0]?.id).toBe("7k3m9q2vx6rt");
    expect(response.etag).toBe('"etag-1"');
    expect(response.requestId).toBe("req_123");
    expect(response.rateLimit).toEqual({
      limit: "120",
      remaining: "119",
      reset: "60",
      retryAfter: undefined,
    });
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      "https://acme.hollyhr.com/api/v1/people/7k3m9q2vx6rt?include=employment",
    );
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer hhr_test_123");
    expect(new Headers(init.headers).get("Idempotency-Key")).toBe("idem_123");
    expect(new Headers(init.headers).get("If-Match")).toBe('"etag-0"');
  });

  it("throws typed API errors with request id metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "permission_denied",
            message: "Missing people:read",
            request_id: "req_denied",
          },
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      ),
    );
    const client = createHollyHrApiClient({
      baseUrl: "https://acme.hollyhr.com/api/v1/",
      token: "hhr_test_123",
      fetch: fetchMock as typeof fetch,
    });

    await expect(client.get("/people")).rejects.toMatchObject({
      name: "HollyHrApiError",
      status: 403,
      code: "permission_denied",
      requestId: "req_denied",
    } satisfies Partial<HollyHrApiError>);
  });

  it("paginates cursor responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ id: "7k3m9q2vx6rt" }],
            pagination: { has_more: true, next_cursor: "cursor_2" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ id: "8m4n0r3wy7sv" }],
            pagination: { has_more: false, next_cursor: null },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    const client = createHollyHrApiClient({
      baseUrl: "https://acme.hollyhr.com/api/v1",
      token: "hhr_test_123",
      fetch: fetchMock as typeof fetch,
    });

    const ids: string[] = [];
    for await (const person of client.paginate<{ id: string }>("/people", {
      query: { limit: 1 },
    })) {
      ids.push(person.id);
    }

    expect(ids).toEqual(["7k3m9q2vx6rt", "8m4n0r3wy7sv"]);
    const [secondUrl] = fetchMock.mock.calls[1] as [URL, RequestInit];
    expect(secondUrl.searchParams.get("cursor")).toBe("cursor_2");
  });
});

describe("SDK utilities", () => {
  it("generates operation metadata from the OpenAPI contract", () => {
    expect(HOLLYHR_API_OPERATION_BY_ID.get("listPeople")).toMatchObject({
      method: "GET",
      path: "/people",
      required_scope: "people:read",
    });
  });

  it("creates idempotency keys with a caller prefix", () => {
    expect(createIdempotencyKey("create_person")).toMatch(/^create_person_/);
  });

  it("verifies HollyHR webhook signatures with replay tolerance", async () => {
    const payload = JSON.stringify({ event: "person.created" });
    const timestamp = new Date().toISOString();
    const webhookId = "evt_123";
    const secret = "whsec_test";
    const signature = createHmac("sha256", secret)
      .update(`${webhookId}.${timestamp}.${payload}`)
      .digest("hex");

    await expect(
      verifyWebhookSignature({
        payload,
        secret,
        webhookIdHeader: webhookId,
        timestampHeader: timestamp,
        signatureHeader: `v1=${signature}`,
      }),
    ).resolves.toBe(true);

    await expect(
      verifyWebhookSignature({
        payload,
        secret,
        webhookIdHeader: webhookId,
        timestampHeader: "2020-01-01T00:00:00.000Z",
        signatureHeader: `v1=${signature}`,
      }),
    ).resolves.toBe(false);
  });
});
