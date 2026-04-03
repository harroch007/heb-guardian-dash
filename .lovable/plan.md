
## תיקון אמיתי לשגיאת המפה המתמשכת

### מה הבעיה בפועל
הבעיה כבר לא נראית כמו "רק גרסה לא נכונה ב-`package.json`".

בדקתי את הקוד והמצב הוא כזה:
- ב-`package.json` כבר רשום `react-leaflet@^4.2.1`
- גם ב-`node_modules/react-leaflet/package.json` מותקנת גרסה `4.2.1`
- אבל קובץ ה-bundle של Vite ב-`node_modules/.vite/deps/react-leaflet.js` עדיין מכיל קוד של v5/React 19 (`use(LeafletContext)` ו-render של context בצורה לא תואמת)

כלומר: יש חוסר התאמה בין מה שמותקן לבין מה שה-preview עדיין מריץ, ולכן מתקבלת שוב השגיאה:
`render2 is not a function`

### Do I know what the issue is?
כן. זו לא בעיית UI ב-`GeofenceSection` ולא בעיית RTL. זו בעיית תלות/באנדל של `react-leaflet` עצמו.

### הגישה המומלצת
במקום להמשיך לנסות "להציל" את `react-leaflet`, הפתרון הכי יציב הוא:
להוציא את `react-leaflet` מהפיצ'ר הזה לגמרי, ולממש את `MapPinPicker` ישירות עם `leaflet` בלבד.

זה:
- עוקף לגמרי את באג התאימות React 18/19
- לא תלוי ב-context הפנימי של `react-leaflet`
- משפיע רק על מסך סימון ה-PIN
- משאיר את שאר האפליקציה ללא שינוי

### מה ייבנה
1. **שכתוב `MapPinPicker.tsx`**
   - שימוש ב-`L.map(...)` על `div` עם `ref`
   - הוספת `tileLayer` של OSM
   - לחיצה על המפה תעדכן marker
   - reverse geocoding יישאר כמו היום
   - כפתורי "אשר מיקום" / "ביטול" יישארו אותו דבר

2. **הסרת `react-leaflet` מהפרויקט**
   - להסיר `react-leaflet` מהתלויות
   - להשאיר `leaflet` ו-`@types/leaflet`

3. **ללא שינוי ב-flow העסקי**
   - `GeofenceSection.tsx` ו-`AddressAutocomplete.tsx` כמעט לא צריכים שינוי
   - `MapPinPicker` עדיין יחזיר:
     `{ latitude, longitude, address }`

### קבצים לשינוי
| קובץ | שינוי |
|---|---|
| `src/components/child-dashboard/MapPinPicker.tsx` | שכתוב מלא מ-`react-leaflet` ל-`leaflet` |
| `package.json` | הסרת `react-leaflet` |
| `bun.lock` / `package-lock.json` | עדכון lockfiles |

### למה זה עדיף על ניסיון downgrade נוסף
כי כבר רואים שהגרסה ה"נכונה" מותקנת, אבל runtime עדיין טוען bundle ישן/לא תואם. ניסיון נוסף עם אותה גישה עלול להשאיר אותנו באותה לולאה. שכתוב ל-`leaflet` בלבד פותר את הבעיה מהשורש.

### פרטים טכניים
- המפה תאותחל בתוך `useEffect`
- marker יישמר ב-`useRef`
- cleanup יבוצע ב-unmount עם `map.remove()`
- RTL יישאר ברמת הקומפוננטה
- mobile-safe: גובה קבוע, כפתורים נוחים ללחיצה, ללא blank screen אם הספרייה נופלת

### אימות אחרי המימוש
1. לפתוח "סמן על המפה"
2. לוודא שאין crash / blank screen
3. ללחוץ על נקודה במפה ולראות PIN
4. לוודא שמתקבלת כתובת או fallback של קואורדינטות
5. לשמור מקום בית/בית ספר
6. לבדוק את ה-flow מקצה לקצה גם במובייל

