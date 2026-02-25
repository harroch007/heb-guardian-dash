

## תוכנית: קבוצות לקוחות (Customer Groups) עם שיוך מודל AI אוטומטי

### מצב נוכחי
כרגע יש שיוך מודל **ברמת ילד בודד** דרך `child_model_override`. אין מושג של "קבוצה" — כל שיוך הוא ידני, ילד-ילד.

### מה נבנה

#### 1. טבלת קבוצות: `customer_groups`

```text
┌──────────────────────────────────────────────────────────┐
│ customer_groups                                          │
├──────────┬────────────┬──────────────┬───────────────────┤
│ id (uuid)│ name (text)│ description  │ model_name (text) │
│          │ "טסטרים"   │ "קבוצת בדיקה"│ "gpt-4.1"         │
│          │ "VIP"      │ "לקוחות VIP" │ "gpt-4o"          │
│          │ "פרימיום"  │ "דיפולט"     │ NULL (= default)  │
├──────────┴────────────┴──────────────┴───────────────────┤
│ is_default (bool) — קבוצת ברירת מחדל למשלמים             │
│ color (text) — צבע תצוגה באדמין                          │
│ created_at                                               │
└──────────────────────────────────────────────────────────┘
```

- `model_name` = NULL אומר "השתמש ב-default מ-`ai_model_config`"
- `is_default = true` → קבוצה שלקוח חדש שמשלם נכנס אליה אוטומטית

#### 2. שיוך הורה לקבוצה: עמודה `group_id` ב-`parents`

```sql
ALTER TABLE parents ADD COLUMN group_id uuid REFERENCES customer_groups(id);
```

- כשאדמין מעביר הורה לקבוצה → כל הילדים שלו עוברים אוטומטית לאותו מודל
- כשלקוח משלם (checkout/promo) → `group_id` מתעדכן לקבוצת דיפולט (`is_default = true`)

#### 3. שינוי ב-`analyze-alert` — סדר עדיפויות חדש

```text
1. child_model_override (שיוך ידני לילד ספציפי) — עדיין קיים
2. parent.group_id → customer_groups.model_name (קבוצת הורה)
3. weighted random מ-ai_model_config (כמו היום)
4. fallback: gpt-4.1
```

#### 4. ממשק אדמין — ניהול קבוצות

**בתוך עמוד Models (AdminModelComparison)** — טאב חדש "קבוצות":
- יצירת/עריכת/מחיקת קבוצות
- לכל קבוצה: שם, תיאור, צבע, מודל AI משויך
- רשימת הלקוחות בכל קבוצה עם ספירה

**בתוך AdminCustomerProfile** — שדה חדש:
- Dropdown לבחירת קבוצה ללקוח
- שינוי מתועד ב-`admin_activity_log`

**בתוך AdminUsers (טבלת משתמשים)** — עמודה חדשה:
- Badge עם שם הקבוצה + צבע

#### 5. שיוך אוטומטי בתשלום

בקוד ה-Checkout ובלוגיקת הפרומו קוד:
- כשלקוח הופך ל-premium → `parents.group_id = (קבוצת דיפולט)`
- אם כבר משויך לקבוצה אחרת (VIP/טסטרים) → לא מחליף

#### 6. KPI לפי קבוצה

בעמוד Models — סקשן חדש:
- השוואת ביצועים לפי קבוצה (לא רק לפי מודל)
- מספר התראות, ציון ממוצע, confidence, verdicts — לכל קבוצה

### קבצים שישתנו

| קובץ | שינוי |
|---|---|
| Migration | טבלת `customer_groups` + עמודת `group_id` ב-parents + RLS |
| `supabase/functions/analyze-alert/index.ts` | בדיקת group_id → model_name בסדר עדיפויות |
| `src/pages/admin/AdminModelComparison.tsx` | טאב קבוצות + KPI לפי קבוצה |
| `src/pages/admin/AdminCustomerProfile.tsx` | dropdown שיוך קבוצה |
| `src/pages/admin/AdminUsers.tsx` | עמודת קבוצה בטבלה |
| `src/pages/Checkout.tsx` | שיוך אוטומטי לקבוצת דיפולט |

### פרטים טכניים

**RLS לטבלת `customer_groups`:**
- Admins: ALL
- Authenticated users: SELECT (כדי לראות שם קבוצה אם צריך)

**Migration SQL:**
```sql
CREATE TABLE customer_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  model_name text,  -- NULL = use default from ai_model_config
  is_default boolean NOT NULL DEFAULT false,
  color text DEFAULT '#7C3AED',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE parents ADD COLUMN group_id uuid REFERENCES customer_groups(id);

-- Insert default groups
INSERT INTO customer_groups (name, description, is_default, color) VALUES
  ('פרימיום', 'לקוחות משלמים — מודל ברירת מחדל', true, '#7C3AED');

-- RLS
ALTER TABLE customer_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage groups" ON customer_groups FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Authenticated can view groups" ON customer_groups FOR SELECT USING (auth.uid() IS NOT NULL);
```

**שינוי ב-analyze-alert (שורות 674-703):**
```typescript
// After checking child_model_override, before weighted random:
if (selectedModel === 'gpt-4.1' && alert.child_id) {
  const { data: parentGroup } = await supabase
    .from('children')
    .select('parent_id')
    .eq('id', alert.child_id)
    .single();
  
  if (parentGroup?.parent_id) {
    const { data: parent } = await supabase
      .from('parents')
      .select('group_id')
      .eq('id', parentGroup.parent_id)
      .single();
    
    if (parent?.group_id) {
      const { data: group } = await supabase
        .from('customer_groups')
        .select('model_name')
        .eq('id', parent.group_id)
        .single();
      
      if (group?.model_name) {
        selectedModel = group.model_name;
        console.log(`Group model for parent: ${selectedModel}`);
      }
    }
  }
}
```

