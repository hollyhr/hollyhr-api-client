/**
 * @file Behavioural tests for the packaged governed time-off decision example.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdkMocks = vi.hoisted(() => ({
  createHollyHrApiClient: vi.fn(),
  createIdempotencyKey: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@hollyhr/api-client", () => ({
  createHollyHrApiClient: sdkMocks.createHollyHrApiClient,
  createIdempotencyKey: sdkMocks.createIdempotencyKey,
}));

const EXAMPLE_ENV_KEYS = [
  "HOLLYHR_API_TOKEN",
  "HOLLYHR_API_BASE_URL",
  "HOLLYHR_TIME_OFF_ID",
  "HOLLYHR_TIME_OFF_DECISION",
  "HOLLYHR_TIME_OFF_RESPONSE_NOTE",
] as const;

const originalEnvironment = Object.fromEntries(
  EXAMPLE_ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof EXAMPLE_ENV_KEYS)[number], string | undefined>;

const exampleUrl = new URL("../../examples/governed-time-off-decision.mjs", import.meta.url);
let importSequence = 0;

async function runExample(environment: Record<string, string | undefined> = {}) {
  for (const key of EXAMPLE_ENV_KEYS) delete process.env[key];
  Object.assign(process.env, {
    HOLLYHR_API_TOKEN: "hhr_test_example",
    HOLLYHR_API_BASE_URL: "https://acme.hollyhr.test/api/v1",
    HOLLYHR_TIME_OFF_ID: "time_off_123",
    HOLLYHR_TIME_OFF_DECISION: "decline",
  });
  for (const [key, value] of Object.entries(environment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  vi.resetModules();
  importSequence += 1;
  return import(`${exampleUrl.href}?case=${importSequence}`);
}

describe("governed time-off decision example", () => {
  beforeEach(() => {
    sdkMocks.get.mockReset();
    sdkMocks.post.mockReset();
    sdkMocks.createHollyHrApiClient.mockReset();
    sdkMocks.createIdempotencyKey.mockReset();
    sdkMocks.createHollyHrApiClient.mockReturnValue({
      get: sdkMocks.get,
      post: sdkMocks.post,
    });
    sdkMocks.createIdempotencyKey.mockReturnValue("time_off_decline_idem_123");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    for (const key of EXAMPLE_ENV_KEYS) {
      const value = originalEnvironment[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.restoreAllMocks();
  });

  it("rejects an invalid decision before creating a client", async () => {
    await expect(runExample({ HOLLYHR_TIME_OFF_DECISION: "cancel" })).rejects.toThrow(
      "exactly approve or decline",
    );
    expect(sdkMocks.createHollyHrApiClient).not.toHaveBeenCalled();
  });

  it("rejects a response note for approval", async () => {
    await expect(
      runExample({
        HOLLYHR_TIME_OFF_DECISION: "approve",
        HOLLYHR_TIME_OFF_RESPONSE_NOTE: "Not applicable to approval",
      }),
    ).rejects.toThrow("supported only for decline decisions");
    expect(sdkMocks.createHollyHrApiClient).not.toHaveBeenCalled();
  });

  it("rejects a response note longer than the public contract permits", async () => {
    await expect(runExample({ HOLLYHR_TIME_OFF_RESPONSE_NOTE: "x".repeat(513) })).rejects.toThrow(
      "512 characters or fewer",
    );
    expect(sdkMocks.createHollyHrApiClient).not.toHaveBeenCalled();
  });

  it("stops after the read when the server omits the ETag", async () => {
    sdkMocks.get.mockResolvedValue({ data: { id: "time_off_123" } });

    await expect(runExample()).rejects.toThrow("did not return an ETag");

    expect(sdkMocks.get).toHaveBeenCalledWith("/time-off/{timeOffId}", {
      pathParams: { timeOffId: "time_off_123" },
    });
    expect(sdkMocks.post).not.toHaveBeenCalled();
  });

  it("reads before posting an exact conditional decline with a fresh idempotency key", async () => {
    const order: string[] = [];
    sdkMocks.get.mockImplementation(async () => {
      order.push("get");
      return { data: { id: "time_off_123", status: "pending" }, etag: '"etag-7"' };
    });
    sdkMocks.post.mockImplementation(async () => {
      order.push("post");
      return {
        data: { data: { id: "time_off_123", status: "declined" } },
        etag: '"etag-8"',
        requestId: "req_123",
      };
    });

    await runExample({ HOLLYHR_TIME_OFF_RESPONSE_NOTE: "Insufficient cover" });

    expect(order).toEqual(["get", "post"]);
    expect(sdkMocks.createHollyHrApiClient).toHaveBeenCalledWith({
      baseUrl: "https://acme.hollyhr.test/api/v1",
      token: "hhr_test_example",
      userAgent: "hollyhr-sdk-example/governed-time-off-decision",
    });
    expect(sdkMocks.createIdempotencyKey).toHaveBeenCalledWith("time_off_decline");
    expect(sdkMocks.post).toHaveBeenCalledWith("/time-off/{timeOffId}/decline", {
      pathParams: { timeOffId: "time_off_123" },
      ifMatch: '"etag-7"',
      idempotencyKey: "time_off_decline_idem_123",
      body: { response_note: "Insufficient cover" },
    });
  });
});
