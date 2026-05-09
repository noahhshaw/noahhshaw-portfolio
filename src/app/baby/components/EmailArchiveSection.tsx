import Link from "next/link";
import { db } from "@/db";
import { dailyEmails } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function EmailArchiveSection() {
  const rows = await db
    .select({
      id: dailyEmails.id,
      sentDate: dailyEmails.sentDate,
      ageInDays: dailyEmails.ageInDays,
      subject: dailyEmails.subject,
      sourcePath: dailyEmails.sourcePath,
      status: dailyEmails.status,
    })
    .from(dailyEmails)
    .orderBy(desc(dailyEmails.sentAt))
    .limit(30);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:col-span-2">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Email archive</h2>
        <span className="text-[10px] text-gray-500">
          Most recent 30 sends.
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-500">No sends yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <div className="min-w-0">
                <span className="mr-2 inline-block w-24 text-xs font-medium text-gray-700">
                  {r.sentDate}
                </span>
                <Link
                  href={`/baby/emails/${r.id}`}
                  className="text-gray-900 underline-offset-2 hover:underline"
                >
                  {r.subject}
                </Link>
                <span className="ml-2 text-[10px] text-gray-500">
                  Day {r.ageInDays}
                </span>
                <span
                  className={
                    r.sourcePath === "routine"
                      ? "ml-2 inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700"
                      : "ml-2 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700"
                  }
                >
                  {r.sourcePath}
                </span>
                {r.status !== "sent" && (
                  <span className="ml-2 inline-block rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700">
                    {r.status}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
