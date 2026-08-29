#!/usr/bin/env node
/**
 * @file Webhook signature verification example for the HollyHR TypeScript SDK.
 */
import { readFileSync } from "node:fs";
import { verifyWebhookSignature } from "@hollyhr/api-client";

const secret = process.env.HOLLYHR_WEBHOOK_SECRET;
const payloadPath = process.env.HOLLYHR_WEBHOOK_PAYLOAD_PATH;
const signatureHeader = process.env.HOLLYHR_WEBHOOK_SIGNATURE;
const timestampHeader = process.env.HOLLYHR_WEBHOOK_TIMESTAMP;
const webhookIdHeader = process.env.HOLLYHR_WEBHOOK_ID;

if (!secret || !payloadPath || !signatureHeader || !timestampHeader) {
  throw new Error(
    "Set HOLLYHR_WEBHOOK_SECRET, HOLLYHR_WEBHOOK_PAYLOAD_PATH, HOLLYHR_WEBHOOK_SIGNATURE, and HOLLYHR_WEBHOOK_TIMESTAMP.",
  );
}

const payload = readFileSync(payloadPath, "utf8");
const valid = await verifyWebhookSignature({
  payload,
  secret,
  signatureHeader,
  timestampHeader,
  webhookIdHeader,
});

if (!valid) {
  console.error("Webhook signature is invalid or outside replay tolerance.");
  process.exit(1);
}

console.log("Webhook signature is valid.");
