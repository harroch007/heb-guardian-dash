const SYSTEM_APPS_TO_HIDE = [
  "com.google.android.permissioncontroller",
  "com.android.systemui",
  "com.android.settings",
  "com.google.android.gms",
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
];

export const isSystemApp = (pkg: string) =>
  SYSTEM_APPS_TO_HIDE.some((s) => pkg.toLowerCase().startsWith(s.toLowerCase())) ||
  pkg.toLowerCase().includes("systemui") ||
  pkg.toLowerCase().includes("devicecare");
