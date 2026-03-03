

## סיכום מצב קיים

**טבלאות רלוונטיות** שצריכות עמודת `platform`:
1. **`alerts`** — כאן נשמרים כל האלרטים. יש unique index על `(device_id, client_event_id)`.
2. **`training_dataset`** — נתוני אימון אנונימיים. אין constraints מיוחדים.
3. **`ai_stack_requests`** — בקשות stack ל-AI. אין unique, יש index על `(device_id, created_at)`.
4. **`daily_chat_stats`** — סטטיסטיקות צ'אט יומיות. יש unique על `(stat_date, device_id, chat_name)`.

**אין טבלת `message_buffers`** — ההודעות מגיעות ישירות דרך ה-RPC `create_alert` (פונקציית DB), שמכניסה שורה ל-`alerts`.

**Endpoint** שאליו האפליקציה שולחת: ה-RPC `create_alert` — בעל 12 פרמטרים. זה ה-API היחיד שאפליקציית האנדרואיד קוראת ליצירת alerts.

---

## משימה 1 — הרחבת סכמה

### מיגרציה: הוספת עמודת `platform`

```sql
-- 1. alerts
ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'WHATSAPP';

-- 2. training_dataset
ALTER TABLE public.training_dataset
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'WHATSAPP';

-- 3. ai_stack_requests
ALTER TABLE public.ai_stack_requests
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'WHATSAPP';

-- 4. daily_chat_stats
ALTER TABLE public.daily_chat_stats
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'WHATSAPP';
```

### עדכון unique indexes

```sql
-- alerts: הוספת platform ל-unique index (device_id, client_event_id)
DROP INDEX IF EXISTS public.alerts_device_event_unique;
CREATE UNIQUE INDEX alerts_device_event_unique
  ON public.alerts (device_id, client_event_id, platform)
  WHERE client_event_id IS NOT NULL;

-- daily_chat_stats: הוספת platform ל-unique (stat_date, device_id, chat_name)
ALTER TABLE public.daily_chat_stats
  DROP CONSTRAINT IF EXISTS daily_chat_stats_stat_date_device_id_chat_name_key;
CREATE UNIQUE INDEX daily_chat_stats_stat_date_device_id_chat_name_platform_key
  ON public.daily_chat_stats (stat_date, device_id, chat_name, platform);
```

---

## משימה 2 — עדכון ה-RPC `create_alert`

ה-RPC `create_alert` הוא הנקודה שאליה האנדרואיד שולח הודעות. צריך:

1. **הוספת פרמטר `p_platform`** (עם default `'WHATSAPP'`) ל-RPC.
2. **כתיבת הערך** לעמודת `platform` ב-INSERT.
3. **עדכון ה-ON CONFLICT** לכלול `platform`.

```sql
DROP FUNCTION IF EXISTS public.create_alert(text, integer, text, text, text, integer, text, integer, text, text, text, text);

CREATE OR REPLACE FUNCTION public.create_alert(
  p_message text,
  p_risk_level integer,
  p_source text,
  p_device_id text,
  p_chat_type text DEFAULT 'PRIVATE',
  p_message_count integer DEFAULT 0,
  p_contact_hash text DEFAULT NULL,
  p_pii_redacted_count integer DEFAULT 0,
  p_sender_display text DEFAULT NULL,
  p_author_type text DEFAULT 'UNKNOWN',
  p_chat_name text DEFAULT NULL,
  p_client_event_id text DEFAULT NULL,
  p_platform text DEFAULT 'WHATSAPP'
) RETURNS bigint ...
```

ה-INSERT ישתמש ב-`p_platform` ב-`platform` column, וה-ON CONFLICT ישתנה ל-`(device_id, client_event_id, platform)`.

4. **עדכון `increment_daily_chat_stat`** — הוספת `p_platform` ועדכון ON CONFLICT בהתאם.

### שינויים ב-Edge Functions

**`analyze-alert/index.ts`** — כשה-function מעתיקה לתוך `training_dataset`, צריך להעביר גם את `platform` מה-alert לשורה ב-training_dataset.

### שינויים ב-Frontend

**`src/integrations/supabase/types.ts`** — ייוצר אוטומטית אחרי המיגרציה, אין צורך לערוך ידנית.

**אין שינויים נדרשים ב-UI** — ה-platform הוא שדה backend בלבד בשלב זה.

---

## סיכום קבצים

| קובץ | שינוי |
|---|---|
| מיגרציית SQL | עמודת platform ב-4 טבלאות + indexes + RPCs |
| `supabase/functions/analyze-alert/index.ts` | העברת platform ל-training_dataset |

