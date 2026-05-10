import { redirect } from "next/navigation";
import { db } from "@/db";
import { babyProfile, agentSettings } from "@/db/schema";
import { getCurrentParent } from "@/lib/baby/session";
import { ProfileSection } from "./components/ProfileSection";
import { SettingsSection } from "./components/SettingsSection";
import { CalendarSection } from "./components/CalendarSection";
import { EmailArchiveSection } from "./components/EmailArchiveSection";
import { PhotoSection } from "./components/PhotoSection";
import { ReplyLogSection } from "./components/ReplyLogSection";
import { KbQueueSection } from "./components/KbQueueSection";
import { RecipientsSection } from "./components/RecipientsSection";

export const dynamic = "force-dynamic";

export default async function BabyDashboardPage() {
  const parent = await getCurrentParent();
  if (!parent) {
    redirect("/baby/login");
  }

  const profileRows = await db.select().from(babyProfile).limit(1);
  const profile = profileRows[0] ?? null;

  const settingRows = await db.select().from(agentSettings);
  const settingsMap: Record<string, unknown> = {};
  for (const s of settingRows) settingsMap[s.key] = s.value;

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Daily Baby
            </h1>
            <p className="text-sm text-gray-600">
              Signed in as {parent.firstName} ({parent.email})
            </p>
          </div>
          <form action="/api/baby/auth/logout" method="post">
            <button
              type="submit"
              className="text-xs text-gray-500 hover:text-gray-900"
            >
              Sign out
            </button>
          </form>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ProfileSection initial={profile} />
          <SettingsSection initial={settingsMap} />
          <RecipientsSection />
          <CalendarSection />
          <PhotoSection />
          <EmailArchiveSection />
          <ReplyLogSection />
          <KbQueueSection />
        </div>
      </div>
    </main>
  );
}
