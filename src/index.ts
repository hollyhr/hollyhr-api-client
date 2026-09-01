/**
 * @file Official TypeScript client helpers for the HollyHR public API.
 */

export {
  HOLLYHR_API_OPERATION_BY_ID,
  HOLLYHR_API_OPERATIONS,
  HOLLYHR_OPENAPI_VERSION,
  type HollyHrOperation,
  type HollyHrOperationId,
} from "./generated/operations.js";

export type HollyHrHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type HollyHrRateLimit = {
  readonly limit?: string;
  readonly remaining?: string;
  readonly reset?: string;
  readonly retryAfter?: string;
};

export type HollyHrResponse<T> = {
  readonly data: T;
  readonly status: number;
  readonly headers: Headers;
  readonly requestId?: string;
  readonly etag?: string;
  readonly rateLimit?: HollyHrRateLimit;
};

export type HollyHrClientOptions = {
  readonly baseUrl: string | URL;
  readonly token: string;
  readonly fetch?: typeof fetch;
  readonly userAgent?: string;
};

export type HollyHrRequestOptions = {
  readonly pathParams?: Record<string, string | number>;
  readonly query?: Record<string, string | number | boolean | null | undefined | readonly string[]>;
  readonly body?: unknown;
  readonly headers?: HeadersInit;
  readonly idempotencyKey?: string;
  readonly ifMatch?: string;
};

type ErrorEnvelope = {
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
    readonly request_id?: string;
    readonly details?: unknown;
  };
};

type PageEnvelope<T> = {
  readonly data?: readonly T[];
  readonly pagination?: {
    readonly next_cursor?: string | null;
    readonly has_more?: boolean;
  };
  readonly next_cursor?: string | null;
};

export class HollyHrApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;
  readonly details?: unknown;
  readonly response: Response;

  constructor(message: string, response: Response, envelope?: ErrorEnvelope) {
    super(message);
    this.name = "HollyHrApiError";
    this.status = response.status;
    this.response = response;
    this.code = envelope?.error?.code;
    this.requestId =
      envelope?.error?.request_id ??
      response.headers.get("x-request-id") ??
      response.headers.get("x-correlation-id") ??
      undefined;
    this.details = envelope?.error?.details;
  }
}

function normalizeBaseUrl(baseUrl: string | URL): URL {
  const url = new URL(baseUrl.toString());
  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`;
  }
  return url;
}

function encodePath(path: string, params: Record<string, string | number> | undefined): string {
  if (!params) {
    return path;
  }
  return Object.entries(params).reduce(
    (current, [key, value]) => current.replaceAll(`{${key}}`, encodeURIComponent(String(value))),
    path,
  );
}

function appendQuery(url: URL, query: HollyHrRequestOptions["query"]): void {
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, item);
      }
      continue;
    }
    url.searchParams.set(key, String(value));
  }
}

function responseRateLimit(headers: Headers): HollyHrRateLimit | undefined {
  const rateLimit = {
    limit: headers.get("ratelimit-limit") ?? undefined,
    remaining: headers.get("ratelimit-remaining") ?? undefined,
    reset: headers.get("ratelimit-reset") ?? undefined,
    retryAfter: headers.get("retry-after") ?? undefined,
  };
  return Object.values(rateLimit).some(Boolean) ? rateLimit : undefined;
}

function responseWriteEtag(headers: Headers): string | undefined {
  const providerResistant = headers.get("hollyhr-resource-etag")?.trim();
  if (providerResistant && !providerResistant.startsWith("W/")) {
    return providerResistant;
  }

  const standard = headers.get("etag")?.trim();
  return standard && !standard.startsWith("W/") ? standard : undefined;
}

async function responseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  return JSON.parse(text) as unknown;
}

export function createIdempotencyKey(prefix = "idem"): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}_${random}`;
}

export class HollyHrApiClient {
  private readonly baseUrl: URL;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;
  private readonly userAgent?: string;

  constructor(options: HollyHrClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.token = options.token;
    this.fetchImpl = options.fetch ?? fetch;
    this.userAgent = options.userAgent;
  }

  async request<T>(
    method: HollyHrHttpMethod,
    path: string,
    options: HollyHrRequestOptions = {},
  ): Promise<HollyHrResponse<T>> {
    const url = new URL(encodePath(path.replace(/^\//, ""), options.pathParams), this.baseUrl);
    appendQuery(url, options.query);

    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");
    headers.set("Authorization", `Bearer ${this.token}`);
    if (this.userAgent) {
      headers.set("User-Agent", this.userAgent);
    }
    if (options.idempotencyKey) {
      headers.set("Idempotency-Key", options.idempotencyKey);
    }
    if (options.ifMatch) {
      headers.set("If-Match", options.ifMatch);
    }
    const hasBody = options.body !== undefined;
    if (hasBody && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await this.fetchImpl(url, {
      method,
      headers,
      body: hasBody ? JSON.stringify(options.body) : undefined,
    });
    const body = await responseJson(response);

    if (!response.ok) {
      throw new HollyHrApiError(
        (body as ErrorEnvelope | undefined)?.error?.message ??
          `HollyHR API returned ${response.status}`,
        response,
        body as ErrorEnvelope | undefined,
      );
    }

    return {
      data: body as T,
      status: response.status,
      headers: response.headers,
      requestId:
        response.headers.get("x-request-id") ??
        response.headers.get("x-correlation-id") ??
        undefined,
      etag: responseWriteEtag(response.headers),
      rateLimit: responseRateLimit(response.headers),
    };
  }

  async get<T>(path: string, options?: Omit<HollyHrRequestOptions, "body">) {
    return this.request<T>("GET", path, options);
  }

  async post<T>(path: string, options?: HollyHrRequestOptions) {
    return this.request<T>("POST", path, options);
  }

  async patch<T>(path: string, options?: HollyHrRequestOptions) {
    return this.request<T>("PATCH", path, options);
  }

  async delete<T>(path: string, options?: HollyHrRequestOptions) {
    return this.request<T>("DELETE", path, options);
  }

  async *paginate<T>(
    path: string,
    options: Omit<HollyHrRequestOptions, "body"> = {},
  ): AsyncGenerator<T, void, undefined> {
    let cursor = typeof options.query?.cursor === "string" ? options.query.cursor : undefined;

    for (;;) {
      const response = await this.get<PageEnvelope<T>>(path, {
        ...options,
        query: { ...options.query, cursor },
      });
      for (const item of response.data.data ?? []) {
        yield item;
      }

      const nextCursor = response.data.pagination?.next_cursor ?? response.data.next_cursor ?? null;
      const hasMore = response.data.pagination?.has_more ?? Boolean(nextCursor);
      if (!hasMore || !nextCursor) {
        break;
      }
      cursor = nextCursor;
    }
  }
}

function signatureHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function signatureValue(header: string): string | undefined {
  return header
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.startsWith("v1="))
    ?.slice(3);
}

export async function verifyWebhookSignature(options: {
  readonly payload: string;
  readonly secret: string;
  readonly signatureHeader: string;
  readonly timestampHeader: string;
  readonly webhookIdHeader?: string;
  readonly toleranceSeconds?: number;
}): Promise<boolean> {
  const expectedSignature = signatureValue(options.signatureHeader);
  if (!expectedSignature) {
    return false;
  }

  const timestampMs = Date.parse(options.timestampHeader);
  if (!Number.isFinite(timestampMs)) {
    return false;
  }
  const toleranceSeconds = options.toleranceSeconds ?? 300;
  if (Math.abs(Date.now() - timestampMs) > toleranceSeconds * 1000) {
    return false;
  }

  const signedPayload = options.webhookIdHeader
    ? `${options.webhookIdHeader}.${options.timestampHeader}.${options.payload}`
    : `${options.timestampHeader}.${options.payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(options.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  return timingSafeEqual(signatureHex(signature), expectedSignature);
}

export function createHollyHrApiClient(options: HollyHrClientOptions): HollyHrApiClient {
  return new HollyHrApiClient(options);
}
