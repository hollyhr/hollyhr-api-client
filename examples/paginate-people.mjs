#!/usr/bin/env node
/**
 * @file Cursor-pagination example for the HollyHR TypeScript SDK.
 */
import { createHollyHrApiClient } from "@hollyhr/api-client";

const token = process.env.HOLLYHR_API_TOKEN;
const baseUrl = process.env.HOLLYHR_API_BASE_URL;

if (!token || !baseUrl) {
  throw new Error("Set HOLLYHR_API_TOKEN and HOLLYHR_API_BASE_URL before running this example.");
}

const hollyhr = createHollyHrApiClient({
  baseUrl,
  token,
  userAgent: "hollyhr-sdk-example/paginate-people",
});

let count = 0;
for await (const person of hollyhr.paginate("/people", { query: { limit: 50 } })) {
  count += 1;
  console.log(person);
}

console.error(`Read ${count} people.`);
