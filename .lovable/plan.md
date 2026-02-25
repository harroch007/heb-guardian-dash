

## תוכנית: אכיפת ייחודיות טלפון להורים ולילדים

### הבעיה
כרגע אין שום מגבלה שמונעת רישום שני הורים עם אותו מספר טלפון, או שני ילדים עם אותו מספר טלפון. צריך לאכוף ייחודיות ברמת ה-DB ולהציג שגיאות ברורות ב-UI.

### כללים עסקיים
- שני הורים שונים **לא** יכולים לחלוק אותו מספר טלפון
- שני ילדים שונים **לא** יכולים לחלוק אותו מספר טלפון
- הורה וילד **כן** יכולים לחלוק אותו מספר (מותר)
- אימייל של הורה חייב להיות ייחודי (כבר נאכף ע"י Supabase Auth, אבל נוסיף גם unique index על `parents.email`)

### שינויים

#### 1. Migration — הוספת unique indexes

```sql
-- ייחודיות טלפון להורים (מתעלמים מריקים/NULL)
CREATE UNIQUE INDEX uq_parents_phone 
  ON parents (phone) 
  WHERE phone IS NOT NULL AND phone <> '';

-- ייחודיות אימייל להורים
CREATE UNIQUE INDEX uq_parents_email 
  ON parents (email) 
  WHERE email IS NOT NULL AND email <> '';

-- ייחודיות טלפון לילדים (מתעלמים מריקים/NULL)
CREATE UNIQUE INDEX uq_children_phone_number 
  ON children (phone_number) 
  WHERE phone_number IS NOT NULL AND phone_number <> '';
```

**הערה**: כרגע ב-`AddChildModal` השדה `phone_number` נשלח כ-`""` (ריק), כך שה-index לא יחסום הוספת ילדים בלי טלפון. ה-constraint יופעל רק כשיש מספר טלפון אמיתי.

#### 2. `src/pages/Onboarding.tsx` — טיפול בשגיאת כפילות

בתוך `handleSubmit`, אחרי שה-insert נכשל, נבדוק אם השגיאה היא `duplicate key` ונציג הודעה ספציפית בעברית:

```typescript
if (error) {
  console.error('Error creating parent record:', error);
  
  if (error.code === '23505') {
    // Unique constraint violation
    const isPhoneDuplicate = error.message?.includes('uq_parents_phone');
    const isEmailDuplicate = error.message?.includes('uq_parents_email');
    
    toast({
      title: 'לא ניתן להשלים את הרישום',
      description: isPhoneDuplicate
        ? 'מספר הטלפון כבר קיים במערכת. אם אתה חושב שמדובר בטעות, פנה לשירות הלקוחות שלנו בכתובת yariv@kippyai.com'
        : isEmailDuplicate
        ? 'כתובת האימייל כבר קיימת במערכת. פנה לשירות הלקוחות: yariv@kippyai.com'
        : 'הפרטים כבר קיימים במערכת. פנה לשירות הלקוחות: yariv@kippyai.com',
      variant: 'destructive',
    });
  } else {
    toast({
      title: 'שגיאה',
      description: 'לא ניתן לשמור את הפרופיל',
      variant: 'destructive',
    });
  }
  return;
}
```

#### 3. `src/components/AddChildModal.tsx` — טיפול בשגיאת כפילות

אותו עיקרון — אם ה-insert של ילד נכשל עם `23505`:

```typescript
if (error) {
  if (error.code === '23505') {
    toast({
      title: 'לא ניתן להוסיף את הילד',
      description: 'מספר הטלפון כבר קיים במערכת. אם אתה חושב שמדובר בטעות, פנה לשירות הלקוחות שלנו בכתובת yariv@kippyai.com',
      variant: 'destructive',
    });
  } else {
    toast({
      title: 'שגיאה',
      description: 'לא ניתן להוסיף את הילד',
      variant: 'destructive',
    });
  }
  return;
}
```

### קבצים שישתנו
1. **Migration חדש** — 3 unique indexes (parents phone, parents email, children phone_number)
2. **`src/pages/Onboarding.tsx`** — שיפור הודעת שגיאה ב-handleSubmit
3. **`src/components/AddChildModal.tsx`** — שיפור הודעת שגיאה ב-handleSubmit

### מה לא משתנה
- `Auth.tsx` — ייחודיות אימייל כבר נאכפת ע"י Supabase Auth (שגיאת "User already registered")
- `handle_new_user` trigger — כבר בודק allowlist, לא צריך שינוי
- לא מוסיפים שדה טלפון לילד ב-AddChildModal (כרגע נשלח ריק — זה עניין נפרד)

