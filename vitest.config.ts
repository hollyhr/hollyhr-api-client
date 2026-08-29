/**
 * @file Test configuration for the standalone HollyHR TypeScript SDK.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    globals: true,
  },
});
