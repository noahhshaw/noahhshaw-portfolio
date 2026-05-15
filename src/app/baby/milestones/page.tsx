import { redirect } from "next/navigation";
import { getCurrentParent } from "@/lib/baby/session";
import { MilestonesSection } from "../components/MilestonesSection";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  focus?: string;
  just?: string;
  missing?: string;
}>;

export default async function MilestonesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const parent = await getCurrentParent();
  if (!parent) {
    redirect("/baby/login?next=/baby/milestones");
  }

  const sp = await searchParams;
  const focusKey = sp.focus ?? null;
  const justAction = sp.just ?? null;
  const missingKey = sp.missing ?? null;

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Milestones
          </h1>
          <a
            href="/baby"
            className="text-sm text-blue-700 hover:underline"
          >
            ← Back to dashboard
          </a>
        </div>
        {missingKey && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            We couldn&apos;t find a milestone with key{" "}
            <code className="font-mono">{missingKey}</code>. The link may be
            stale.
          </div>
        )}
        <MilestonesSection focusKey={focusKey} justAction={justAction} />
      </div>
    </main>
  );
}
