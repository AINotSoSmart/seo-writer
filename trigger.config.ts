import { defineConfig } from "@trigger.dev/sdk"

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_ID || "proj_icegqapligsnayztiqxu",
  runtime: "node",
  logLevel: "log",
  maxDuration: 1800,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
    },
  },
})