

## תוכנית: ניהול מודלים + שיוך ילדים לקבוצות A/B

### הרעיון

במקום לשייך ילד בודד למודל ספציפי, ניצור מערכת "קבוצות ניסוי" שמאפשרת לראות בממשק אדמין את כל הילדים, לבחור ילדים, ולהקצות אותם למודל. ילדים ללא שיוך ידני ישתמשו בחלוקה אוטומטית לפי weights.

---

### שלב 1: Migration - טבלאות DB

```sql
-- טבלת מודלים זמינים
CREATE TABLE public.ai_model_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name text NOT NULL UNIQUE,
  is_default boolean NOT NULL DEFAULT false,
  weight integer NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_model_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage model config"
  ON public.ai_model_config FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- Seed current model
INSERT INTO ai_model_config (model_name, is_default, weight, description)
VALUES ('gpt-4.1', true, 100, 'מודל ייצור נוכחי');

-- טבלת שיוך ילד למודל (override)
CREATE TABLE public.child_model_override (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  model_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(child_id)
);

ALTER TABLE public.child_model_override ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage overrides"
  ON public.child_model_override FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());
```

### שלב 2: Edge Function - לוגיקת בחירת מודל

**קובץ**: `supabase/functions/analyze-alert/index.ts`

לפני קריאת OpenAI, נוסיף:

1. בדיקה אם לילד יש override ב-`child_model_override` - אם כן, משתמשים במודל הזה
2. אם אין override - בחירה weighted random מתוך `ai_model_config` (לפי weights)
3. Fallback ל-`gpt-4.1` אם שגיאה

שמירת `model_used` בתוך `ai_analysis` JSON כדי שנוכל לסנן אחר כך.

### שלב 3: ממשק אדמין - קומפוננטה חדשה

**קובץ חדש**: `src/pages/admin/AdminModelComparison.tsx`

הממשק יכלול 3 חלקים:

**א. ניהול מודלים** - טבלה עם כל המודלים, אפשרות להוסיף מודל חדש, לשנות weight (slider), ולסמן ברירת מחדל.

**ב. שיוך ילדים** - טבלה שמציגה את כל הילדים (5 ילדים כרגע) עם:
- שם הילד
- שם ההורה  
- המודל הנוכחי שמשויך (או "אוטומטי" אם אין override)
- Dropdown לבחירת מודל / "אוטומטי"
- כפתורים: "שייך את כולם ל-X" / "נקה כל שיוכים"

ככה תוכל פשוט לראות את הרשימה ולבחור למי לשייך מה.

**ג. השוואת ביצועים** - כרטיסי KPI לכל מודל:
- מספר התראות שנותחו
- ציון סיכון ממוצע
- אורך סיכום ממוצע (תווים)
- confidence ממוצע
- חלוקת verdicts (safe/review/notify)

הנתונים נשלפים מ-`alerts.ai_analysis->>'model_used'`. התראות ישנות ללא שדה זה יסומנו כ-"gpt-4o-mini (legacy)".

### שלב 4: שילוב בטאב QA

**קובץ**: `src/pages/admin/AdminAlertQA.tsx`

הוספת sub-tabs:
1. **התראות** - הטאב הקיים
2. **מודלים** - הקומפוננטה החדשה (AdminModelComparison)

---

### פרטים טכניים

- **קבצים שישתנו**: `supabase/functions/analyze-alert/index.ts`, `src/pages/admin/AdminAlertQA.tsx`
- **קובץ חדש**: `src/pages/admin/AdminModelComparison.tsx`
- **Migration**: 2 טבלאות חדשות + seed
- **Backward compatibility**: התראות ללא `model_used` מוצגות כ-"gpt-4o-mini (legacy)"
- **Fallback**: אם DB לא זמין, משתמש ב-`gpt-4.1`

