

## הבעיה: חוסר סנכרון בין מד הרגישות לבין שליחת Push

### מצב נוכחי

1. **מד הרגישות** (NotificationSettings) — שומר `alert_threshold` בטבלת `settings` (50/65/85)
2. **הצגת התראות בדף Alerts** — מסנן בצד הלקוח לפי `alert_threshold` ✅ עובד
3. **שליחת Push** (`analyze-alert`, שורה 1016) — שולח Push לכל `notify` או `review` **ללא בדיקת threshold** ❌ לא מסונכרן
4. **view `parent_alerts_effective`** — מסנן רק `notify` (לא `review`) ❌ חלקי
5. **הורה חדש** — אם אין שורה ב-`settings`, הדיפולט הוא 65 (מאוזן) ✅ תקין

### שינויים נדרשים

#### 1. `analyze-alert` Edge Function — סינון Push לפי threshold

בשורה ~1016, לפני שליחת Push, לשלוף את `alert_threshold` מ-`settings` עבור הילד ולבדוק אם `ai_risk_score >= threshold`:

```text
┌─ AI analysis complete ─┐
│ verdict = notify/review │
│ ai_risk_score = 72      │
└────────────┬────────────┘
             │
     ┌───────▼────────┐
     │ Fetch threshold │  ← settings.alert_threshold (default 65)
     │ for child_id    │
     └───────┬────────┘
             │
     ┌───────▼──────────────┐
     │ risk_score >= threshold? │
     │  72 >= 65 → YES → Push  │
     │  72 >= 85 → NO → Skip   │
     └─────────────────────────┘
```

- שלוף `alert_threshold` מ-`settings` (`child_id = X`, `device_id IS NULL`) עם fallback ל-65
- אם `ai_risk_score < threshold` → דלג על Push, סמן `processing_status = 'below_threshold'`
- אם `ai_risk_score >= threshold` → שלח Push כרגיל

#### 2. עדכון `parent_alerts_effective` view

ה-view הנוכחי מסנן רק `ai_verdict = 'notify'`. צריך לעדכן אותו לכלול גם `review`:

```sql
WHERE (a.ai_verdict IN ('notify', 'review'))
  AND a.ai_risk_score >= COALESCE(s.alert_threshold, 65)
```

זה יבטיח שהדשבורד, הדוח היומי, וה-badge כולם יציגו מספרים עקביים.

#### 3. ללא שינוי בדף Alerts ובדף NotificationSettings

הלוגיקה הקיימת בצד הלקוח כבר עובדת נכון — מסננת לפי threshold מ-settings.

### סיכום

| רכיב | לפני | אחרי |
|---|---|---|
| Push notification | כל notify/review | רק אם risk_score ≥ threshold |
| `parent_alerts_effective` view | רק notify | notify + review שעוברים threshold |
| דשבורד badge | לא תואם | תואם לדף Alerts |
| דיפולט להורה חדש | 65 (מאוזן) | 65 (מאוזן) — ללא שינוי |

