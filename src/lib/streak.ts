/**
 * Calculate the current streak of days where the child completed at least one chore.
 *
 * Counts both `approved` and `completed_by_child` statuses — if the child finished
 * a chore but the parent hasn't approved yet, the day still counts so the streak
 * isn't broken before the parent reviews.
 *
 * Logic mirrors the Android client:
 *  - Group completion timestamps by Israel date (YYYY-MM-DD).
 *  - Start from today; if no chore today, start from yesterday (grace for late-night).
 *  - If neither today nor yesterday has activity → streak = 0.
 *  - Otherwise count consecutive days backward.
 */
export interface ChoreForStreak {
  status: string;
  completed_at: string | null;
  approved_at?: string | null;
}

const TZ = "Asia/Jerusalem";

const toIsraelDate = (iso: string): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));

const todayIsrael = (): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

const shiftIsraelDate = (date: string, deltaDays: number): string => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
};

export function calcStreak(chores: ChoreForStreak[]): number {
  const activeDays = new Set<string>();
  for (const c of chores) {
    if (c.status !== "approved" && c.status !== "completed_by_child") continue;
    const ts = c.completed_at || c.approved_at;
    if (!ts) continue;
    activeDays.add(toIsraelDate(ts));
  }
  if (activeDays.size === 0) return 0;

  const today = todayIsrael();
  const yesterday = shiftIsraelDate(today, -1);

  let cursor: string;
  if (activeDays.has(today)) cursor = today;
  else if (activeDays.has(yesterday)) cursor = yesterday;
  else return 0;

  let count = 0;
  while (activeDays.has(cursor)) {
    count++;
    cursor = shiftIsraelDate(cursor, -1);
  }
  return count;
}
