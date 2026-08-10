export interface MarketingTouch {
  [key: string]: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  landing_path: string;
}

export interface WaitlistAttribution {
  first_touch: MarketingTouch;
  submission_touch: MarketingTouch;
  landing_path: string;
  referrer_host: string | null;
  marketing_notice_version: string;
}

const FIRST_TOUCH_KEY = "kippy_marketing_first_touch_v1";
const NOTICE_VERSION = "waitlist-updates-v1";

function sanitize(value: string | null, maxLength = 160): string | null {
  if (!value) return null;
  const normalized = Array.from(value)
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return character !== "<" && character !== ">" && codePoint >= 32 && codePoint !== 127;
    })
    .join("")
    .trim()
    .slice(0, maxLength);
  return normalized || null;
}

function currentTouch(): MarketingTouch {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: sanitize(params.get("utm_source")),
    utm_medium: sanitize(params.get("utm_medium")),
    utm_campaign: sanitize(params.get("utm_campaign")),
    utm_content: sanitize(params.get("utm_content")),
    utm_term: sanitize(params.get("utm_term")),
    landing_path: sanitize(window.location.pathname, 300) ?? "/",
  };
}

function readFirstTouch(fallback: MarketingTouch): MarketingTouch {
  try {
    const stored = window.sessionStorage.getItem(FIRST_TOUCH_KEY);
    if (stored) return JSON.parse(stored) as MarketingTouch;
    window.sessionStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(fallback));
  } catch {
    // Attribution must never block the waitlist form.
  }
  return fallback;
}

function externalReferrerHost(): string | null {
  if (!document.referrer) return null;
  try {
    const referrer = new URL(document.referrer);
    return referrer.host === window.location.host ? null : sanitize(referrer.host, 255);
  } catch {
    return null;
  }
}

export function captureWaitlistAttribution(): WaitlistAttribution {
  const submissionTouch = currentTouch();
  return {
    first_touch: readFirstTouch(submissionTouch),
    submission_touch: submissionTouch,
    landing_path: submissionTouch.landing_path,
    referrer_host: externalReferrerHost(),
    marketing_notice_version: NOTICE_VERSION,
  };
}
