const SYSTEM_APPS_TO_HIDE = [
  "com.google.android.permissioncontroller",
  "com.android.systemui",
  "com.android.settings",
  "com.google.android.gms",
  "com.google.android.gsf",
  "com.android.providers",
  "com.samsung.android.app.routines",
  "com.sec.android.app.launcher",
  "com.miui.home",
  "com.android.launcher",
  "com.android.packageinstaller",
  "com.android.bluetooth",
  "com.android.nfc",
  "com.samsung.android.lool",
  "com.facebook.appmanager",
  "com.android.vending",
  "com.google.android.packageinstaller",
  "com.android.dialer",
  "com.google.android.dialer",
  "com.samsung.android.dialer",
  "com.android.stk",
  // שעון
  "com.sec.android.app.clockpackage",
  "com.google.android.deskclock",
  // קישור אל Windows
  "com.microsoft.appmanager",
  // עקבות מערכת / System Tracing
  "com.samsung.android.app.dressroom",
  "com.android.traceur",
  // נגישות
  "com.samsung.accessibility",
  // מפות
  "com.google.android.apps.maps",
  // לוח שנה
  "com.google.android.calendar",
  "com.samsung.android.calendar",
  // הקבצים שלי
  "com.sec.android.app.myfiles",
  // אזור AR
  "com.samsung.android.arzone",
  // Wearable Manager Installer
  "com.samsung.android.app.watchmanagerstub",
  // Samsung Pass
  "com.samsung.android.samsungpass",
  // PowerPoint
  "com.microsoft.office.powerpoint",
  // Play Console
  "com.google.android.apps.playconsole",
  // תמונות
  "com.google.android.apps.photos",
  // OneDrive
  "com.microsoft.skydrive",
  // Meet
  "com.google.android.apps.meetings",
  // Galaxy Store
  "com.sec.android.app.samsungapps",
  // Bixby Voice
  "com.samsung.android.bixby.agent",
  "com.samsung.android.voc",
  // Android Switch / auto config
  "android.autoinstalls.config",
];

const SYSTEM_KEYWORDS = [
  "systemui", "devicecare", "launcher", "dialer", "messaging",
  "packageinstaller", "kippy", "incallui",
  "bixby", "samsungpass", "arzone", "wearable",
];

export const isSystemApp = (pkg: string) => {
  const lc = pkg.toLowerCase();
  return SYSTEM_APPS_TO_HIDE.some((s) => lc.startsWith(s.toLowerCase())) ||
    SYSTEM_KEYWORDS.some((kw) => lc.includes(kw));
};
