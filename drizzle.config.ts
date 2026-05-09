import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  // Treat existing tables as managed by other migrations (the names-rater
  // tables predate this config); we only generate diffs for the schema as a
  // whole.
  verbose: true,
  strict: true,
});
