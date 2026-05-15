import { normalizeGender, type ChildGender } from "./childAvatar";

/**
 * Hebrew gender-aware text helper.
 *
 * Rule per product: only adapt to feminine if the parent explicitly marked
 * the child as female. Unknown / "other" stays masculine (default Hebrew form).
 */
export function gt(
  gender: string | null | undefined,
  masculine: string,
  feminine: string
): string {
  return normalizeGender(gender) === "female" ? feminine : masculine;
}

export function isFemale(gender: string | null | undefined): boolean {
  return normalizeGender(gender) === "female";
}

export type { ChildGender };

/**
 * Quick chore templates — each entry holds both grammatical forms so we
 * address the child correctly (imperative changes by gender in Hebrew).
 */
export interface GenderedChoreTemplate {
  /** Stable key for React lists (gender-independent). */
  key: string;
  emoji: string;
  minutes: number;
  /** Masculine imperative (default). */
  masculine: string;
  /** Feminine imperative. */
  feminine: string;
}

export const QUICK_CHORE_TEMPLATES_GENDERED: GenderedChoreTemplate[] = [
  { key: "tidy-room",   emoji: "🛏️", minutes: 15, masculine: "סדר את החדר",   feminine: "סדרי את החדר" },
  { key: "homework",    emoji: "📚", minutes: 20, masculine: "שיעורי בית",    feminine: "שיעורי בית" },
  { key: "dishwasher",  emoji: "🍽️", minutes: 10, masculine: "כלים למדיח",   feminine: "כלים למדיח" },
  { key: "morning",     emoji: "🌅", minutes: 5,  masculine: "התארגנות בוקר", feminine: "התארגנות בוקר" },
  { key: "trash",       emoji: "🗑️", minutes: 10, masculine: "הוצא את הזבל",  feminine: "הוציאי את הזבל" },
];

export function getQuickChoreTemplates(gender: string | null | undefined) {
  const female = isFemale(gender);
  return QUICK_CHORE_TEMPLATES_GENDERED.map((t) => ({
    key: t.key,
    emoji: t.emoji,
    minutes: t.minutes,
    title: female ? t.feminine : t.masculine,
  }));
}
