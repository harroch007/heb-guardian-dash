
# Kippy — Plan & Android Integration

## Completed ✅

### Phase A — Data Model Migration
- `installed_apps`, `schedule_windows`, `shabbat_zmanim` tables
- `report_installed_apps`, `get_device_settings` RPCs
- `shabbat_zmanim` populated (118 rows, 2026–2028)

### Phase B — Sync Fixes
- Dashboard auto-refresh every 60s
- SyncNotice filters commands older than 5 minutes

### Chores & Rewards
- 3 tables + 3 RPCs + UI page + navigation

### Timezone Fix (2026-03-17) ✅
- **`parent_daily_report` view** — all `AT TIME ZONE 'UTC'` replaced with `'Asia/Jerusalem'`
- **`get_parent_daily_report_for_parent` function** — same fix in alert_counts + notify_effective CTEs
- **`add_daily_metrics` function** — default `p_metric_date` changed from UTC to Jerusalem
- **`trg_ai_stack_request_to_daily_metrics`** — UTC → Jerusalem
- **`trg_alert_insert_to_daily_metrics`** — UTC → Jerusalem

---

## Android Agent — Usage Reporting Fix (PENDING)

### הבעיה

האנדרואיד שולח `totalTimeInForeground` מצטבר (cumulative) שלא מתאפס בחצות.
השרת שומר אותו כמו שהוא → תוצאה: 18:57 שעות שימוש ליום אחד — בלתי אפשרי.

### עיקרון מנחה

**האנדרואיד הוא מקור האמת.** השרת פשוט שומר ומציג — בלי תיקונים, בלי חישובי דלתא.

### מה צריך לתקן באנדרואיד

#### 1. חישוב שימוש יומי (דלתא)

**גישה מועדפת — שאילתה עם טווח:**
```java
long startOfDay = LocalDate.now(ZoneId.of("Asia/Jerusalem"))
    .atStartOfDay(ZoneId.of("Asia/Jerusalem"))
    .toInstant().toEpochMilli();
long now = System.currentTimeMillis();

List<UsageStats> stats = usageStatsManager.queryUsageStats(
    UsageStatsManager.INTERVAL_DAILY, startOfDay, now);

for (UsageStats us : stats) {
    int dailyMinutes = (int)(us.getTotalTimeInForeground() / 60_000);
    // שלח dailyMinutes ל-upsert_app_usage
}
```

**גישה חלופית — דלתא ידנית (אם INTERVAL_DAILY עדיין מחזיר cumulative):**
```java
// בחצות (או ב-boot): שמור ב-SharedPreferences את הערך הנוכחי
// midnightSnapshot[packageName] = currentCumulative

// בכל דיווח:
int dailyUsage = currentCumulative - midnightSnapshot.getOrDefault(pkg, 0);
if (dailyUsage < 0) dailyUsage = currentCumulative; // device reset
```

#### 2. Timezone — חובה Asia/Jerusalem

כל חישוב תאריך חייב להיות לפי `Asia/Jerusalem`:
```java
LocalDate today = LocalDate.now(ZoneId.of("Asia/Jerusalem"));
String usageDate = today.toString(); // "2026-03-17"
```

אם ב-UTC השעה היא 23:30 אבל בישראל 01:30 — התאריך צריך להיות של המחרת.

#### 3. Sanity Checks (לפני שליחה)

```java
if (dailyMinutes > 1440) {
    Log.w("UsageReport", "Skipping " + pkg + ": " + dailyMinutes + " > 1440");
    continue; // לא לשלוח
}
```

### חוזה ה-RPC — `upsert_app_usage`

| פרמטר | סוג | תיאור |
|--------|------|--------|
| `p_device_id` | TEXT | מזהה המכשיר |
| `p_package_name` | TEXT | שם החבילה (e.g. `com.whatsapp`) |
| `p_app_name` | TEXT | שם תצוגה (e.g. `WhatsApp`) |
| `p_usage_minutes` | INTEGER | **דקות שימוש יומיות בלבד** — לא מצטבר! |
| `p_usage_date` | DATE | תאריך לפי `Asia/Jerusalem` |

**הפונקציה עושה:**
- `INSERT ... ON CONFLICT DO UPDATE SET usage_minutes = EXCLUDED.usage_minutes`
- כלומר: כל שליחה **מחליפה** את הערך הקודם לאותו יום
- השרת לא מחשב דלתא — הוא סומך על האנדרואיד

### תרשים זרימה

```
┌─────────────────────────────────────────────┐
│              ANDROID (מכשיר)                │
│  • queryUsageStats(startOfDay, now)         │
│  • חישוב דלתא יומית                        │
│  • תאריך לפי Asia/Jerusalem                │
│  • Sanity: max 1440 דק׳ לאפליקציה          │
│  • שולח נתון נקי ל-upsert_app_usage        │
└──────────────────┬──────────────────────────┘
                   │  p_usage_minutes = יומי בלבד
                   ▼
┌─────────────────────────────────────────────┐
│           SUPABASE (שרת)                    │
│  • upsert_app_usage: שומר כמו שהוא         │
│  • parent_home_snapshot: מציג (Jerusalem ✓) │
│  • parent_daily_report: מציג (Jerusalem ✓)  │
│  • דשבורד: מושך ומציג                      │
└─────────────────────────────────────────────┘
```

---

## Next Steps

### Phase C (UI)
- Apps tab: installed_apps inventory UI
- Screen Time tab: schedule windows CRUD UI + Shabbat toggle
- Device tab: polished health view

### Android-side fixes
1. **Fix usage reporting** — implement daily delta (see above)
2. **Fix enforcement in AccessibilityService** — compare foreground app against blocked list
3. **Add Realtime subscription** for `device_commands`
4. **Implement heartbeat reporting** — `report_device_heartbeat` RPC
5. **Add periodic usage reporting** — call `upsert_app_usage` every 5-10 minutes
6. **Chores screen** — show pending chores, mark as completed, redeem bank minutes
