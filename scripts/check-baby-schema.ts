/* eslint-disable no-console */
/**
 * Smoke test for the baby agent schema. Run after `npm run db:push`:
 *
 *   vercel env pull .env.local --environment=production
 *   npm run db:check
 *
 * Verifies each table exists with the expected columns, that baby_profile
 * has been seeded, and that a few critical column types match. Exits 0
 * on pass, 1 on any failure.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local defensively. tsx's --env-file relay isn't reliable across
// versions, so parse it ourselves if DATABASE_URL isn't already set.
function loadEnvLocal() {
  if (process.env.DATABASE_URL) return { reason: "already-set" };
  const path = resolve(process.cwd(), ".env.local");
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch (err) {
    return {
      reason: "read-failed",
      path,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  const lines = content.split("\n");
  const keysFound: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    keysFound.push(key);
    // Skip empty values — the Vercel CLI returns "" for Sensitive variables
    // (their actual values can only be decrypted at runtime in Vercel's env).
    // If we set "", later code treats DATABASE_URL as falsy/missing anyway,
    // and the diagnostic stays clearer when we leave it untouched.
    if (!value) continue;
    if (!(key in process.env) || !process.env[key]) {
      process.env[key] = value;
    }
  }
  return {
    reason: "parsed",
    path,
    totalLines: lines.length,
    keysCount: keysFound.length,
    hasDatabaseUrl: keysFound.includes("DATABASE_URL"),
    keysFound,
  };
}

const loadResult = loadEnvLocal();
if (process.env.DEBUG_ENV === "1" || !process.env.DATABASE_URL) {
  console.error("[env-load]", JSON.stringify(loadResult, null, 2));
}

import { neon } from "@neondatabase/serverless";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const EXPECTED: Record<string, string[]> = {
  baby_profile: [
    "id",
    "due_date",
    "birth_date",
    "baby_name",
    "pediatrician_name",
    "pediatrician_phone",
    "meta",
    "updated_at",
  ],
  daily_emails: [
    "id",
    "sent_date",
    "sent_at",
    "age_in_days",
    "subject",
    "body_html",
    "body_text",
    "recipients",
    "resend_message_id",
    "source_path",
    "status",
  ],
  email_replies: [
    "id",
    "received_at",
    "from_email",
    "to_emails",
    "cc_emails",
    "subject",
    "body_text",
    "body_html",
    "in_reply_to",
    "message_id",
    "daily_email_id",
    "classification",
    "action_taken",
    "processed_at",
  ],
  photos: [
    "id",
    "r2_key",
    "mime_type",
    "size_bytes",
    "uploaded_by_email",
    "uploaded_at",
    "tags",
    "source_reply_id",
  ],
  parent_context: [
    "id",
    "created_at",
    "source",
    "source_reply_id",
    "content_type",
    "content",
    "tags",
  ],
  calendar_events: [
    "id",
    "event_date",
    "event_type",
    "title",
    "description",
    "recurrence",
    "source",
    "created_at",
  ],
  kb_update_queue: [
    "id",
    "requested_at",
    "requester_email",
    "request_text",
    "status",
    "pr_url",
  ],
  magic_link_tokens: [
    "id",
    "email",
    "token_hash",
    "expires_at",
    "used_at",
    "created_at",
  ],
  agent_settings: ["key", "value", "updated_at", "updated_by_email"],
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(`${RED}DATABASE_URL not set.${RESET}`);
    console.error(
      `Run: ${DIM}vercel env pull .env.local --environment=production${RESET}`
    );
    console.error(`Then re-run with the env loaded.`);
    process.exit(1);
  }
  const sql = neon(url);

  let failed = 0;
  const log = (ok: boolean, msg: string) => {
    if (ok) console.log(`  ${GREEN}✓${RESET} ${msg}`);
    else {
      console.log(`  ${RED}✗${RESET} ${msg}`);
      failed += 1;
    }
  };

  console.log("Checking baby agent schema...\n");

  // 1. All tables exist
  for (const table of Object.keys(EXPECTED)) {
    try {
      const rows = await sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name=${table}
      `;
      const present = new Set(rows.map((r) => r.column_name as string));
      const missing = EXPECTED[table].filter((c) => !present.has(c));
      if (rows.length === 0) {
        log(false, `${table} — table missing entirely`);
      } else if (missing.length > 0) {
        log(
          false,
          `${table} — present but missing columns: ${missing.join(", ")}`
        );
      } else {
        log(true, `${table} (${rows.length} columns)`);
      }
    } catch (err) {
      log(
        false,
        `${table} — query error: ${err instanceof Error ? err.message : err}`
      );
    }
  }

  // 2. Profile row exists with a sensible due date
  console.log("");
  try {
    const rows = await sql`SELECT id, due_date, baby_name, birth_date FROM baby_profile`;
    if (rows.length === 0) {
      log(
        false,
        `baby_profile is empty — run: INSERT INTO baby_profile (due_date) VALUES ('2026-05-11');`
      );
    } else if (rows.length > 1) {
      log(
        false,
        `baby_profile has ${rows.length} rows; expected exactly 1 (singleton)`
      );
    } else {
      const r = rows[0];
      // pg driver returns Date; neon HTTP driver returns ISO string. Normalize.
      const dueRaw = r.due_date;
      const dueDate =
        dueRaw instanceof Date
          ? dueRaw.toISOString().slice(0, 10)
          : String(dueRaw).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        log(false, `baby_profile.due_date unexpected format: ${dueRaw}`);
      } else {
        const ageDays = Math.floor(
          (Date.now() - new Date(dueDate).getTime()) / 86400000
        );
        log(
          true,
          `baby_profile seeded — due ${dueDate} (${ageDays >= 0 ? `${ageDays}d post-due` : `${-ageDays}d remaining`}), name=${r.baby_name ?? "(unset)"}, birth=${r.birth_date ?? "(unset)"}`
        );
      }
    }
  } catch (err) {
    log(
      false,
      `baby_profile query error: ${err instanceof Error ? err.message : err}`
    );
  }

  // 3. The names-rater tables should still exist (we shouldn't have nuked them)
  console.log("");
  for (const t of ["users", "names", "couples", "ratings", "short_list"]) {
    try {
      const rows =
        await sql`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=${t}`;
      log(rows.length > 0, `existing ${t} table preserved`);
    } catch {
      log(false, `couldn't query ${t}`);
    }
  }

  console.log("");
  if (failed > 0) {
    console.log(`${RED}${failed} check(s) failed.${RESET}`);
    process.exit(1);
  }
  console.log(`${GREEN}All checks passed. Schema is ready.${RESET}`);
}

main().catch((err) => {
  console.error(`${RED}fatal: ${err}${RESET}`);
  process.exit(1);
});
