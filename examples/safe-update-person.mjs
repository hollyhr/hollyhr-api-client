#!/usr/bin/env node
/**
 * @file Conditional safe-update example for the HollyHR TypeScript SDK.
 */
import { createHollyHrApiClient, createIdempotencyKey } from "@hollyhr/api-client";

const token = process.env.HOLLYHR_API_TOKEN;
const baseUrl = process.env.HOLLYHR_API_BASE_URL;
const personId = process.env.HOLLYHR_PERSON_ID;
const jobTitle = process.env.HOLLYHR_JOB_TITLE ?? "People Lead";

if (!token || !baseUrl || !personId) {
  throw new Error(
    "Set HOLLYHR_API_TOKEN, HOLLYHR_API_BASE_URL, and HOLLYHR_PERSON_ID before running this example.",
  );
}

const hollyhr = createHollyHrApiClient({
  baseUrl,
  token,
  userAgent: "hollyhr-sdk-example/safe-update-person",
});

const current = await hollyhr.get("/people/{personId}", {
  pathParams: { personId },
});

if (!current.etag) {
  throw new Error(
    "The person read did not return an ETag, so the safe conditional update stopped.",
  );
}

const updated = await hollyhr.patch("/people/{personId}", {
  pathParams: { personId },
  ifMatch: current.etag,
  idempotencyKey: createIdempotencyKey("update_person"),
  body: { job_title: jobTitle },
});

console.log(
  JSON.stringify(
    {
      requestId: updated.requestId,
      etag: updated.etag,
      data: updated.data,
    },
    null,
    2,
  ),
);
