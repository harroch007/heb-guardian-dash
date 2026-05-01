## תיקון ביצועים — מפת מיקומי הילדים בדף הבית

### הבעיה
ב-`FamilyLocationsMap.tsx` הקיים, בכל refetch של `HomeV2` (שמתרחש בכל פעולה — הוספת בונוס, מתח לבית מ-tab אחר וכו'):
1. `located = children.filter(...)` יוצר מערך חדש בכל רנדר → ה-`useEffect` רץ.
2. ה-effect **מסיר ובונה מחדש את כל ה-markers** (`m.remove()` + `L.marker(...).addTo(map)`), שזה יקר ב-Leaflet (DOM thrash, re-paint של אריחים).
3. `setView` / `fitBounds` נקראים **בכל refetch**, מה שמאפס את הזום של המשתמש — אם המשתמש עשה זום-אין כדי לראות ילד, הוא נזרק לאחור והמסך מקפיא בזמן רינדור.

### התיקון ב-`src/components/home-v2/FamilyLocationsMap.tsx`

**1. ייצוב הרשימה דרך `useMemo` עם key סטטי**
```ts
const located = useMemo(() => children.filter(...).map(...),
  [children.map(c => `${c.id}|${c.device?.lat}|${c.device?.lon}|${c.device?.last_seen}|${c.name}|${c.device?.address}`).join(",")]);
```
ה-effect ירוץ רק כשנתון רלוונטי השתנה בפועל, לא בכל רנדר.

**2. עדכון markers in-place במקום remove+add**
- מחליפים את `markersRef` מ-`L.Marker[]` ל-`Map<childId, L.Marker>`.
- בכל ריצת effect: לכל ילד — אם marker קיים, קוראים ל-`setLatLng`, `setIcon`, `setPopupContent`. אם לא קיים — יוצרים חדש.
- מסירים רק markers של ילדים שנעלמו לגמרי (`seen` set).

**3. fit/center רק פעם אחת**
- `didInitialFitRef = useRef(false)`.
- `setView`/`fitBounds` רצים רק אם `!didInitialFitRef.current && located.length > 0`, ואז מסמנים `true`.
- כך הזום והפאן של המשתמש נשמרים בכל refetch.

### לא משתנה
- מבנה הסיכות, ה-popup, הצבעים, האריחים, הגובה, והממשק עם `HomeV2.tsx` — כולם נשארים זהים.
- אין שינויים ב-DB או בלוגיקת השליפה.