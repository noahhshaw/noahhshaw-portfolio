import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { precomputedEmails } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentParent } from "@/lib/baby/session";
import { ReviewActions } from "./ReviewActions";

export const dynamic = "force-dynamic";

export default async function PrecomputedDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const parent = await getCurrentParent();
  if (!parent) redirect("/baby/login");
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  const rows = await db
    .select()
    .from(precomputedEmails)
    .where(eq(precomputedEmails.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) notFound();

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/baby"
          className="text-xs text-gray-500 hover:text-gray-900"
        >
          ← Back to dashboard
        </Link>
        <header className="mt-2 mb-4">
          <h1 className="text-xl font-semibold text-gray-900">
            Day {row.ageInDays} · {row.subject}
          </h1>
          <p className="text-xs text-gray-500">
            week {row.weekIndex} • status {row.status} • generated{" "}
            {row.generatedAt
              ? new Date(row.generatedAt).toLocaleString()
              : "?"}
            {row.kbVersion && ` • kbVersion ${row.kbVersion}`}
            {row.costUsd && ` • $${row.costUsd}`}
          </p>
        </header>

        {Array.isArray(row.validationIssues) &&
          row.validationIssues.length > 0 && (
            <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-xs">
              <p className="font-semibold text-amber-900">Validation issues</p>
              <ul className="mt-1 list-disc pl-4 text-amber-900">
                {(row.validationIssues as string[]).map((iss, i) => (
                  <li key={i}>{iss}</li>
                ))}
              </ul>
            </div>
          )}

        <ReviewActions id={row.id} status={row.status} />

        <article className="mt-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="mb-2 text-[10px] uppercase tracking-wide text-gray-500">
            Rendered preview (with current calendar overlay)
          </p>
          <PreviewWithOverlay id={row.id} />
        </article>

        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-gray-500">
            Plain-text version (template, before overlay)
          </summary>
          <pre className="mt-2 whitespace-pre-wrap rounded border border-gray-200 bg-white p-3 text-xs text-gray-800">
            {row.bodyText}
          </pre>
        </details>
      </div>
    </main>
  );
}

async function PreviewWithOverlay({ id }: { id: number }) {
  // Server-side fetch via the API endpoint to apply the overlay logic
  // consistently. We could call the same DB logic directly but going
  // through the API ensures we're testing the same code path the user
  // would hit.
  // Use absolute URL only when not on Vercel, otherwise relative is fine
  const url = `${
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ""
  }/api/baby/precomputed/${id}`;
  // Call the DB directly here to avoid auth round-trip in server components.
  const { db } = await import("@/db");
  const { precomputedEmails, calendarEvents } = await import("@/db/schema");
  const { eq, gte, or } = await import("drizzle-orm");
  const { eventsInWindow } = await import("@/lib/baby/recurrence");
  const { applyOverlay } = await import("@/lib/baby/upcoming-overlay");

  const rows = await db
    .select()
    .from(precomputedEmails)
    .where(eq(precomputedEmails.id, id))
    .limit(1);
  if (!rows[0]) return <p className="text-xs text-red-700">not found</p>;
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const all = await db
    .select()
    .from(calendarEvents)
    .where(
      or(
        eq(calendarEvents.recurrence, "yearly"),
        gte(calendarEvents.eventDate, cutoff.toISOString().slice(0, 10))
      )
    );
  const upcoming = eventsInWindow(all, now, 14).map((e) => ({
    effectiveDate: e.effectiveDate,
    title: e.title,
  }));
  const overlaid = applyOverlay(
    { html: rows[0].bodyHtml, text: rows[0].bodyText },
    upcoming
  );
  return (
    <div
      className="prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: overlaid.html }}
    />
  );
  // url variable retained for future use (linting noop)
  void url;
}
