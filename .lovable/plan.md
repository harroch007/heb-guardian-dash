

## תוכנית ביצוע — Idempotency + AI Status Tracking

### Migration (SQL אחד משולב)

**עמודות חדשות בטבלת `alerts`:**
- `client_event_id TEXT` — מזהה ייחודי מהאנדרואיד
- `ai_status TEXT DEFAULT 'pending' CHECK (ai_status IN ('pending','success','failed'))` — מעקב AI
- `ai_error TEXT` — הודעת שגיאה מ-AI

**אינדקס חלקי (partial unique index):**
```sql
CREATE UNIQUE INDEX alerts_device_event_unique
ON alerts (device_id, client_event_id)
WHERE client_event_id IS NOT NULL;
```

**עדכון `create_alert` function:**
- הוספת פרמטר `p_client_event_id TEXT DEFAULT NULL`
- שימוש ב-`ON CONFLICT` על האינדקס החלקי עם `DO UPDATE SET content = alerts.content` (no-op update) + `RETURNING id`
- כשיש conflict — מחזיר את ה-ID הקיים; כשאין — insert רגיל

---

### שינויים ב-`analyze-alert/index.ts`

**בהצלחה (שורות ~981-1000):** הוספת `ai_status: 'success', ai_error: null` ל-`updateData`

**בכשלון — queue mode (שורות ~1286-1290):** הוספת `ai_status: 'failed', ai_error: errMsg` ל-update של ה-alert

**בכשלון — legacy mode (שורות ~1404-1410):** הוספת update ל-alert עם `ai_status: 'failed', ai_error: errorMessage` לפני החזרת ה-500 response

---

### מה לא ישתנה
- `processing_status` — נשאר כמו שהוא, לא נוגעים
- Dashboard/UI — אין שינוי
- JSON schema שחוזר מ-analyze-alert — אין שינוי
- עמודות קיימות — לא משנים שם או מוחקים

### קבצים שישתנו
1. Migration חדש (SQL) — 3 עמודות + אינדקס + ALTER FUNCTION
2. `supabase/functions/analyze-alert/index.ts` — 3 נקודות שינוי (success + 2 failure paths)

