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
  "com.android.mms",
  "com.google.android.apps.messaging",
  "com.samsung.android.messaging",
  "com.android.stk",
];

const SYSTEM_KEYWORDS = [
  "systemui", "devicecare", "launcher", "dialer", "messaging",
  "packageinstaller", "kippy", "incallui",
];

export const isSystemApp = (pkg: string) => {
  const lc = pkg.toLowerCase();
  return SYSTEM_APPS_TO_HIDE.some((s) => lc.startsWith(s.toLowerCase())) ||
    SYSTEM_KEYWORDS.some((kw) => lc.includes(kw));
};
