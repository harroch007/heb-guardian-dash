

# הוספת כפתור "התחברות" לדף הנחיתה החדש

## הבעיה
ב-`NavbarV1.tsx` כפתור "התחברות" מוצג רק כש-`WAITLIST_MODE` כבוי (שורות 22–26). במצב רשימת המתנה (המצב הנוכחי) הוא נעלם לחלוטין — להורים שאושרו אין דרך להיכנס.

לשם השוואה: ב-`LandingNavbar.tsx` (דף הבית הראשי) כפתור "התחברות" מוצג **תמיד** ומוביל ל-`/auth`, ללא קשר ל-`WAITLIST_MODE`. זה הדפוס הנכון.

## התיקון — `src/components/landing-v1/NavbarV1.tsx`

להסיר את התנאי `!WAITLIST_MODE` סביב כפתור ההתחברות, כך שיוצג תמיד וינווט ל-`/auth`:

```tsx
<div className="flex items-center gap-2">
  {/* תמיד מוצג — להורים מאושרים */}
  <Link to="/auth">
    <Button variant="ghost" size="sm">התחברות</Button>
  </Link>
  {WAITLIST_MODE ? (
    <Button size="sm" onClick={handleCTA} ...>הצטרפו חינם</Button>
  ) : (
    <Link to="/auth?signup=true">
      <Button size="sm" ...>הצטרפו חינם</Button>
    </Link>
  )}
</div>
```

## תוצאה
- "התחברות" תמיד נראה ב-`/landing-v1` ומוביל ישירות ל-`/auth`.
- "הצטרפו חינם" ממשיך להפעיל את מודל רשימת ההמתנה כרגיל.
- אותו דפוס בדיוק כמו ב-`LandingNavbar` של דף הבית הראשי.

## מה לא נוגעים
- אין שינוי ב-`/auth` עצמו — הוא כבר קיים ועובד.
- אין שינוי ב-`WAITLIST_MODE` או ב-`AuthContext`.
- אין שינוי בלוגיקת ההצטרפות / `WaitlistModal`.
- אין שינוי ב-V1 (דף הבית `/`).

## קבצים שיעודכנו
- `src/components/landing-v1/NavbarV1.tsx` — שורות 21–38

