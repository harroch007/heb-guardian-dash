
# ניהול תפוגת מנוי אוטומטי

## מצב נוכחי
- טבלת `children` כוללת `subscription_tier` (free/premium) אבל **אין תאריך תפוגה**
- דף Checkout פשוט מעדכן ל-premium בלי שום תאריך סיום
- ה-Edge Function `analyze-alert` בודק tier אבל לא בודק אם פג תוקף

## מה נוסיף

### 1. עמודת תפוגה בטבלה (Migration)
הוספת עמודה `subscription_expires_at` (timestamptz, nullable) לטבלת `children`.
- כשהערך NULL = מנוי פעיל ללא תפוגה (תשלום חודשי פעיל)
- כשיש תאריך = המנוי יפוג באותו תאריך

### 2. עדכון דף Checkout (`src/pages/Checkout.tsx`)
בפונקציית `handlePay`, לפי סוג הפרומו:
- **free_months**: חישוב `subscription_expires_at = now + X months`
- **fixed_price** / **percent_off**: ללא תפוגה (NULL) — תשלום חודשי רגיל
- **ללא פרומו**: ללא תפוגה (NULL) — תשלום חודשי רגיל

### 3. Edge Function חדש: `expire-subscriptions`
פונקציה פשוטה שרצה כ-cron job (פעם ביום):
- מחפשת ילדים עם `subscription_tier = 'premium'` ו-`subscription_expires_at < now()`
- מעדכנת אותם ל-`subscription_tier = 'free'`, `subscription_expires_at = NULL`
- לוג של כל שינוי

### 4. עדכון `analyze-alert` Edge Function
בבדיקת ה-tier שהוספנו, נוסיף גם בדיקת תפוגה:
- שליפת `subscription_expires_at` ביחד עם `subscription_tier`
- אם tier=premium אבל `expires_at < now()` → מתייחס כ-free (דילוג על AI)
- עדכון ה-tier ל-free באותו רגע (תיקון מיידי)

### 5. Cron Job (SQL insert)
הגדרת pg_cron שירוץ פעם ביום ב-02:00 ויקרא ל-`expire-subscriptions`

## תרשים זרימה

```text
הורה משלם / מכניס פרומו
        |
        v
  Checkout.tsx
  - tier = premium
  - expires_at = now+X (פרומו) / NULL (תשלום)
        |
        v
  +----- חודשים עוברים -----+
  |                          |
  v                          v
cron (יומי)              analyze-alert
expire-subscriptions     בודק tier + expires_at
  - פג? -> free             - פג? -> skip + downgrade
```

## קבצים שישתנו

| קובץ | שינוי |
|---|---|
| Migration (SQL) | הוספת `subscription_expires_at` ל-children |
| `src/pages/Checkout.tsx` | חישוב תאריך תפוגה לפי סוג פרומו |
| `supabase/functions/expire-subscriptions/index.ts` | Edge Function חדש — downgrade מנויים שפגו |
| `supabase/functions/analyze-alert/index.ts` | בדיקת תפוגה + downgrade מיידי |
| `supabase/config.toml` | הוספת expire-subscriptions |
| SQL (insert) | cron job יומי |

## פרטים טכניים

### Migration SQL
```sql
ALTER TABLE children
ADD COLUMN subscription_expires_at timestamptz DEFAULT NULL;
```

### Checkout — חישוב תפוגה
```typescript
let expiresAt: string | null = null;
if (appliedPromo?.discount_type === 'free_months') {
  const d = new Date();
  d.setMonth(d.getMonth() + appliedPromo.discount_value);
  expiresAt = d.toISOString();
}

await supabase.from("children")
  .update({ subscription_tier: "premium", subscription_expires_at: expiresAt })
  .eq("id", childId);
```

### expire-subscriptions Edge Function
- שימוש ב-service_role key
- `UPDATE children SET subscription_tier='free', subscription_expires_at=NULL WHERE subscription_tier='premium' AND subscription_expires_at < now()`
- החזרת מספר הרשומות שעודכנו

### analyze-alert — בדיקה נוספת
```typescript
// בתוך processAlert, אחרי שליפת childData:
const tier = childData.subscription_tier || 'free';
const expiresAt = childData.subscription_expires_at;

if (tier === 'free' || (expiresAt && new Date(expiresAt) < new Date())) {
  // אם פג תוקף, גם נעדכן את ה-tier
  if (tier === 'premium' && expiresAt) {
    await supabase.from('children')
      .update({ subscription_tier: 'free', subscription_expires_at: null })
      .eq('id', deviceData.child_id);
  }
  // skip AI...
}
```
