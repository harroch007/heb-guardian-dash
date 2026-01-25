import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get current date in Israel timezone (YYYY-MM-DD format)
 * This ensures consistent date calculation across the app,
 * matching the Supabase View which uses Asia/Jerusalem timezone.
 * 
 * Screen time resets at exactly 00:00 Israel time.
 */
export const getIsraelDate = (): string => {
  return new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'Asia/Jerusalem' 
  }).format(new Date());
};
