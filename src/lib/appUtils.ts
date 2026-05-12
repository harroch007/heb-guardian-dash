// Minimal hard-coded list — only true OS components that can never be a "user app".
// Everything else is filtered dynamically based on user interaction signals
// (see shouldShowApp below).
const SYSTEM_APPS_TO_HIDE = [
  "com.android.systemui",
  "com.android.settings",
  "com.google.android.gms",
  "com.google.android.gsf",
  "com.android.providers",
  "com.android.packageinstaller",
  "com.google.android.packageinstaller",
  "com.android.bluetooth",
  "com.android.nfc",
  "com.android.stk",
  "com.android.server",
  "com.android.shell",
  "com.android.externalstorage",
  "com.android.documentsui",
  "com.android.inputdevices",
  "com.android.location.fused",
  "com.android.wallpaperbackup",
  "com.android.keychain",
  // Launchers (home screen apps themselves)
  "com.sec.android.app.launcher",
  "com.miui.home",
  "com.android.launcher",
  "com.google.android.apps.nexuslauncher",
  // Kippy itself
  "com.kippy",
];

const SYSTEM_KEYWORDS = [
  "systemui",
  "packageinstaller",
  ".providers.",
  "kippy",
];

/**
 * True system component that should NEVER appear in the parent UI,
 * regardless of interaction. Drastically smaller than before — most
 * "system-ish" apps (Gallery, AR Zone, Tips, Files, Bixby, etc.) are
 * NOT filtered here; they're filtered dynamically by shouldShowApp.
 */
export const isSystemApp = (pkg: string) => {
  const lc = pkg.toLowerCase();
  return SYSTEM_APPS_TO_HIDE.some((s) => lc.startsWith(s.toLowerCase())) ||
    SYSTEM_KEYWORDS.some((kw) => lc.includes(kw));
};

/**
 * Decide whether to show an app in the parent UI.
 * Default behavior (showAll=false): only show apps the child actually interacts with.
 *
 * "Interaction" = any of:
 *  - has an app_policies row (parent already touched it)
 *  - has been attempted while blocked (blocked_app_attempts)
 *  - has measurable usage minutes today
 *  - is a third-party app (is_system === false in installed_apps)
 *
 * This auto-cleans 100+ pre-installed system apps (OneDrive, Bixby, Samsung Pass,
 * PowerPoint, etc.) without any per-manufacturer hardcoding, while still surfacing
 * any system app the child *actually* uses (Gallery, Camera, AR Zone, etc.).
 */
export const shouldShowApp = (params: {
  pkg: string;
  isSystem: boolean;
  hasPolicy: boolean;
  hasBlockedAttempt: boolean;
  hasUsage: boolean;
  showAll?: boolean;
}): boolean => {
  if (isSystemApp(params.pkg)) return false; // hard system components — never show
  if (params.showAll) return true;
  if (params.hasPolicy || params.hasBlockedAttempt || params.hasUsage) return true;
  return !params.isSystem; // third-party app → show by default
};
