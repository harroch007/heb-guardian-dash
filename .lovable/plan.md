## הסרת כפתור "קרוב" מסקציית CTA בדף הנחיתה V1

בקובץ `src/components/landing-v1/FreeAccessCTA.tsx` (שורות 44–49) קיים כפתור משני ריק עם הטקסט "קרוב" שמוצג רק ב-desktop (`hidden sm:inline-flex`, `disabled`). הוא חסר משמעות ויש להסירו.

### שינוי

החלפת ה-wrapper של שני הכפתורים בכפתור יחיד ממורכז:

```tsx
<div className="flex justify-center">
  {WAITLIST_MODE ? button : <Link to="/auth?signup=true">{button}</Link>}
</div>
```

ה-`<Button>` של "קרוב" יוסר לחלוטין. אין שינויים נוספים.
