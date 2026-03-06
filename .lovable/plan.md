

## הוספת "מתוך כמה סה״כ" לכרטיס שדרוג פרימיום

### שינוי ב-`src/pages/admin/AdminUsers.tsx`

1. **הוספת state חדש** — `totalPremiumDevices` שישמור את מספר המכשירים הכולל בקבוצת פרימיום.

2. **ב-useEffect של ספירת השדרוג** (שורה ~82) — לפני ה-return המוקדם כש-`premiumDeviceIds.length === 0`, נשמור את `premiumDeviceIds.length` ב-state החדש.

3. **ב-UI** (שורה ~273) — נשנה את התצוגה מ:
   ```
   {notUpgradedCount ?? "—"}
   ```
   ל:
   ```
   {notUpgradedCount ?? "—"} / {totalPremiumDevices ?? "—"}
   ```
   כך שיוצג למשל: **3 / 5**

קובץ אחד בלבד, שינוי מינימלי.

