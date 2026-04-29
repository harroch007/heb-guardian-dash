import { Baby, User, GraduationCap, type LucideIcon } from "lucide-react";

export type AgeBand = "young" | "tween" | "teen" | "unknown";
export type ChildGender = "male" | "female" | "unknown";

export function getAgeYears(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  if (age < 0 || age > 25) return null;
  return age;
}

export function getAgeBand(age: number | null): AgeBand {
  if (age === null) return "unknown";
  if (age < 10) return "young";
  if (age < 13) return "tween";
  return "teen";
}

export function normalizeGender(gender: string | null | undefined): ChildGender {
  if (!gender) return "unknown";
  const g = gender.toLowerCase().trim();
  if (g === "male" || g === "m" || g === "boy" || g === "בן" || g === "זכר") return "male";
  if (g === "female" || g === "f" || g === "girl" || g === "בת" || g === "נקבה") return "female";
  return "unknown";
}

/** Returns a Lucide icon component appropriate for the child's age band. */
export function getChildIcon(_gender: string | null | undefined, ageBand: AgeBand): LucideIcon {
  if (ageBand === "young") return Baby;
  if (ageBand === "teen") return GraduationCap;
  return User;
}

/** Returns Tailwind classes for the avatar bubble (text + bg) based on gender + age. */
export function getChildAvatarClasses(
  gender: string | null | undefined,
  ageBand: AgeBand
): { text: string; bg: string } {
  const g = normalizeGender(gender);
  if (g === "male") {
    if (ageBand === "young") return { text: "text-sky-500", bg: "bg-sky-500/15" };
    if (ageBand === "teen") return { text: "text-indigo-500", bg: "bg-indigo-500/15" };
    return { text: "text-blue-500", bg: "bg-blue-500/15" };
  }
  if (g === "female") {
    if (ageBand === "young") return { text: "text-pink-500", bg: "bg-pink-500/15" };
    if (ageBand === "teen") return { text: "text-fuchsia-500", bg: "bg-fuchsia-500/15" };
    return { text: "text-rose-500", bg: "bg-rose-500/15" };
  }
  return { text: "text-muted-foreground", bg: "bg-muted" };
}
