#!/usr/bin/env node
/**
 * @file Conditional time-off approval or decline example for the HollyHR SDK.
 */
import { createHollyHrApiClient, createIdempotencyKey } from "@hollyhr/api-client";

const token = process.env.HOLLYHR_API_TOKEN;
const baseUrl = process.env.HOLLYHR_API_BASE_URL;
const timeOffId = process.env.HOLLYHR_TIME_OFF_ID;
const decision = process.env.HOLLYHR_TIME_OFF_DECISION;
const responseNote = process.env.HOLLYHR_TIME_OFF_RESPONSE_NOTE;

if (!token || !baseUrl || !timeOffId) {
  throw new Error(
    "Set HOLLYHR_API_TOKEN, HOLLYHR_API_BASE_URL, and HOLLYHR_TIME_OFF_ID before running this example.",
  );
}

if (decision !== "approve" && decision !== "decline") {
  throw new Error("Set HOLLYHR_TIME_OFF_DECISION to exactly approve or decline.");
}

if (decision === "approve" && responseNote) {
  throw new Error("HOLLYHR_TIME_OFF_RESPONSE_NOTE is supported only for decline decisions.");
}

if (responseNote && responseNote.length > 512) {
  throw new Error("HOLLYHR_TIME_OFF_RESPONSE_NOTE must be 512 characters or fewer.");
}

const hollyhr = createHollyHrApiClient({
  baseUrl,
  token,
  userAgent: "hollyhr-sdk-example/governed-time-off-decision",
});

const current = await hollyhr.get("/time-off/{timeOffId}", {
  pathParams: { timeOffId },
});

if (!current.etag) {
  throw new Error("The time-off read did not return an ETag, so the conditional decision stopped.");
}

const result = await hollyhr.post(`/time-off/{timeOffId}/${decision}`, {
  pathParams: { timeOffId },
  ifMatch: current.etag,
  idempotencyKey: createIdempotencyKey(`time_off_${decision}`),
  body: decision === "decline" && responseNote ? { response_note: responseNote } : undefined,
});

console.log(
  JSON.stringify(
    {
      decision,
      requestId: result.requestId,
      etag: result.etag,
      data: result.data,
    },
    null,
    2,
  ),
);
