// Pure age math, separated from the DB-loading variant in age.ts so the
// edge cases (pre-birth, day-of-birth, week index) can be tested without
// a database.

export type AgeContext = {
  ageInDays: number; // negative if pre-birth, positive otherwise
  weekIndex: number; // 1-indexed week of life (0 pre-birth)
  preBirthDaysRemaining: number; // 0 once born
  status: "pre-birth" | "newborn" | "infant" | "older";
};

export function computeAgeContext(opts: {
  now: Date;
  dueDate: string; // YYYY-MM-DD
  birthDate?: string | null; // YYYY-MM-DD, set after birth
}): AgeContext {
  const reference = new Date(opts.birthDate ?? opts.dueDate);
  const ageInDays = Math.floor(
    (opts.now.getTime() - reference.getTime()) / (1000 * 60 * 60 * 24)
  );
  const weekIndex = ageInDays < 0 ? 0 : Math.floor(ageInDays / 7) + 1;
  const preBirthDaysRemaining =
    opts.birthDate || ageInDays >= 0 ? 0 : Math.abs(ageInDays);

  let status: AgeContext["status"];
  if (ageInDays < 0) status = "pre-birth";
  else if (ageInDays <= 28) status = "newborn";
  else if (ageInDays <= 365) status = "infant";
  else status = "older";

  return { ageInDays, weekIndex, preBirthDaysRemaining, status };
}
