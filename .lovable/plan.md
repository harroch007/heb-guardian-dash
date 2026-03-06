

## הוספת ספירת Warmup (48 שעות) לכרטיס האדמין

### מה נעשה
נוסיף לכרטיס המכשיר ב-`AdminCustomerProfile` תצוגה של כמה זמן נותר מתוך 48 שעות מרגע ה-heartbeat הראשון עם `appVersionCode >= 8`.

### שינויים

**`src/pages/admin/AdminCustomerProfile.tsx`** (קובץ אחד בלבד):

1. **בפונקציית `fetchCustomerData`** — אחרי שליפת ה-heartbeat האחרון לכל מכשיר, נוסיף שאילתה נוספת לכל device:
   ```sql
   SELECT reported_at FROM device_heartbeats_raw
   WHERE device_id = ? AND (device->>'appVersionCode')::int >= 8
   ORDER BY reported_at ASC LIMIT 1
   ```
   נשמור את התוצאה ב-`warmupStartedAt` בתוך אובייקט ה-device.

2. **ב-interface `ChildDetail.devices`** — נוסיף שדה `warmupStartedAt: string | null`.

3. **ב-UI** (שורה ~850, ליד הסוללה וה-last_seen) — נציג:
   - אם אין heartbeat עם v1.8+: `"ממתין לגרסה 1.8+"`
   - אם עדיין ב-warmup: `"⏳ נותרו Xש׳ Yד׳"` (badge צהוב)
   - אם הושלם: `"✓ Warmup הושלם"` (badge ירוק)

### אין שינוי ב-DB
השאילתה רצה ישירות מ-`adminSupabase` על `device_heartbeats_raw` — לאדמין כבר יש גישה לטבלה הזו.

