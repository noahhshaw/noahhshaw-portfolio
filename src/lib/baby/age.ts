import { db } from "@/db";
import { babyProfile } from "@/db/schema";
import { computeAgeContext, type AgeContext } from "./age-math";

export type { AgeContext };

export async function loadAgeContext(now = new Date()): Promise<AgeContext | null> {
  const rows = await db.select().from(babyProfile).limit(1);
  const profile = rows[0];
  if (!profile) return null;
  return computeAgeContext({
    now,
    dueDate: profile.dueDate,
    birthDate: profile.birthDate,
  });
}
