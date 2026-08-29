#!/usr/bin/env node
/**
 * @file Minimal first-call example for the HollyHR TypeScript SDK.
 */
import { createHollyHrApiClient, HollyHrApiError } from "@hollyhr/api-client";

const token = process.env.HOLLYHR_API_TOKEN;
const baseUrl = process.env.HOLLYHR_API_BASE_URL;

if (!token || !baseUrl) {
  throw new Error("Set HOLLYHR_API_TOKEN and HOLLYHR_API_BASE_URL before running this example.");
}

const hollyhr = createHollyHrApiClient({
  baseUrl,
  token,
  userAgent: "hollyhr-sdk-example/first-call",
});

try {
  const response = await hollyhr.get("/people", { query: { limit: 10 } });

  console.log(
    JSON.stringify(
      {
        requestId: response.requestId,
        rateLimit: response.rateLimit,
        data: response.data,
      },
      null,
      2,
    ),
  );
} catch (error) {
  if (error instanceof HollyHrApiError) {
    console.error(
      JSON.stringify(
        {
          status: error.status,
          code: error.code,
          requestId: error.requestId,
          message: error.message,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
  throw error;
}
