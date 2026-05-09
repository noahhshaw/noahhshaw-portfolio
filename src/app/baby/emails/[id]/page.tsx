import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { dailyEmails } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentParent } from "@/lib/baby/session";

export const dynamic = "force-dynamic";

export default async function EmailDetailPage({
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
    .from(dailyEmails)
    .where(eq(dailyEmails.id, id))
    .limit(1);
  const email = rows[0];
  if (!email) notFound();

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/baby" className="text-xs text-gray-500 hover:text-gray-900">
          ← Back to dashboard
        </Link>
        <header className="mt-2 mb-4">
          <h1 className="text-xl font-semibold text-gray-900">
            {email.subject}
          </h1>
          <p className="text-xs text-gray-500">
            Sent {email.sentDate} • Day {email.ageInDays} • via{" "}
            {email.sourcePath}
            {email.status !== "sent" && ` • status: ${email.status}`}
          </p>
        </header>
        <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
          />
        </article>
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-gray-500">
            Plain-text version
          </summary>
          <pre className="mt-2 whitespace-pre-wrap rounded border border-gray-200 bg-white p-3 text-xs text-gray-800">
            {email.bodyText}
          </pre>
        </details>
      </div>
    </main>
  );
}
