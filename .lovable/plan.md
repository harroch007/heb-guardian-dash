

## תיקון תאימות react-leaflet — React 18

### הבעיה
`react-leaflet@5.0.0` דורש React 19. הפרויקט על React 18 → שגיאת `render2 is not a function`.

### השפעה
**אפס השפעה על שאר האפליקציה.** `react-leaflet` משמש רק ב-`MapPinPicker.tsx`. שום קומפוננטה אחרת לא מייבאת ממנו.

### שינוי

| קובץ | פעולה |
|-------|--------|
| `package.json` | `react-leaflet`: `^5.0.0` → `^4.2.1` |

ה-API זהה בין v4 ל-v5 — `MapPinPicker.tsx` לא צריך שינוי.

