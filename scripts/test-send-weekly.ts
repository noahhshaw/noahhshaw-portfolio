/* eslint-disable no-console */
/**
 * Out-of-band test send for pre-computed artifacts — mirrors the logic of
 * /api/baby/test-send (read artifact from disk → send via Resend) so a
 * weekly email can be verified end-to-end without a browser session.
 *
 * Safety rails:
 *   - Recipient is hard-defaulted to noahhshaw@gmail.com. Anoushka and the
 *     production recipient list are never touched.
 *   - Subject is prefixed [TEST WEEK N] / [TEST DAY N].
 *   - Writes nothing to daily_emails — this is review mode, not a send of
 *     record, exactly like the production test-send route.
 *
 *   npx tsx scripts/test-send-weekly.ts 89 362
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { Resend } from "resend";

const ENV = ".env.local";
try {
  const envText = readFileSync(resolve(process.cwd(), ENV), "utf8");
  for (const line of envText.split("\n")) {
    const m = /^([A-Z_][A-Z0-9_]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(.*))$/.exec(
      line.trim()
    );
    if (!m) continue;
    const key = m[1];
    const val = m[2] ?? m[3] ?? m[4] ?? "";
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.warn(`(no ${ENV}; relying on existing env)`);
}

import {
  BABY_FROM_EMAIL as FROM,
  BABY_REPLY_TO_EMAIL as REPLY_TO,
} from "@/lib/baby/constants";

const TO = "noahhshaw@gmail.com";
const WEEKLY_START_DAY = 85;

async function main() {
  const days = process.argv
    .slice(2)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
  if (days.length === 0) {
    console.error("usage: npx tsx scripts/test-send-weekly.ts <day> [day...]");
    process.exit(1);
  }
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY not set");
    process.exit(1);
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  for (const day of days) {
    const file = resolve(
      process.cwd(),
      "baby-kb",
      "precomputed",
      `day-${day}.json`
    );
    const artifact = JSON.parse(readFileSync(file, "utf8")) as {
      ageInDays: number;
      subject: string;
      bodyHtml: string;
      bodyText: string;
    };

    const label =
      day >= WEEKLY_START_DAY
        ? `TEST WEEK ${Math.floor(day / 7) + 1}`
        : `TEST DAY ${day}`;

    const result = await resend.emails.send({
      from: FROM,
      to: [TO],
      replyTo: REPLY_TO,
      subject: `[${label}] ${artifact.subject}`,
      text: artifact.bodyText,
      html: artifact.bodyHtml,
      headers: {
        "X-Baby-Source": "test-send-cli",
        "X-Baby-Day": String(day),
      },
    });

    if (result.error) {
      console.error(`day ${day}: SEND FAILED — ${result.error.message}`);
      process.exitCode = 1;
    } else {
      const words = artifact.bodyText.trim().split(/\s+/).length;
      console.log(
        `day ${day} (${label}): sent to ${TO} — id ${result.data?.id}`
      );
      console.log(`   subject: ${artifact.subject}`);
      console.log(
        `   ${words} words, ${artifact.bodyHtml.length} bytes html, milestone section: ${
          artifact.bodyText.includes("Developmental milestone check-in")
            ? "present"
            : "MISSING"
        }`
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
