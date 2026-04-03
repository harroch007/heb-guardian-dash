

## Fallback סימון PIN על מפה כשכתובת לא נמצאת

### הרעיון
כשההורה מחפש כתובת ב-Nominatim ולא מוצא תוצאה מדויקת, נציע לו לסמן את המיקום ידנית על מפה אינטראקטיבית. ההורה לוחץ על המפה → מתקבלים קואורדינטות → reverse geocoding מחזיר שם כתובת קרוב → נשמר.

### איך זה עובד

```text
שלב 1: חיפוש כתובת (כמו היום)
┌──────────────────────────────┐
│ [הכנס כתובת: רחוב, מספר, עיר] │
│   תוצאות...                   │
│                                │
│ לא מוצא? [📍 סמן על המפה]    │
└──────────────────────────────┘

שלב 2: מפה אינטראקטיבית (Leaflet)
┌──────────────────────────────┐
│ ┌────────────────────────┐   │
│ │       🗺️ מפה          │   │
│ │     📍 (PIN שהוזז)     │   │
│ │                        │   │
│ └────────────────────────┘   │
│ 📍 הרצליה, ישראל             │
│ [אשר מיקום]       [ביטול]   │
└──────────────────────────────┘
```

### טכני

**חבילה חדשה: `leaflet` + `react-leaflet`** — מפה אינטראקטיבית מבוססת OSM, חינמית, ללא API key.

**קומפוננטה חדשה: `src/components/child-dashboard/MapPinPicker.tsx`**
- מציגה מפת Leaflet ממורכזת על ישראל (או על מיקום המכשיר אם זמין)
- ההורה לוחץ על המפה → PIN זז למיקום הנלחץ
- Reverse geocoding דרך Nominatim (`/reverse?lat=...&lon=...`) מחזיר שם כתובת משוער
- כפתור "אשר מיקום" מחזיר `{ latitude, longitude, address }` — אותו interface כמו AddressAutocomplete

**שינוי: `src/components/child-dashboard/GeofenceSection.tsx`**
- בעריכה, מתחת ל-AddressAutocomplete, מוסיפים לינק: "לא מוצא את הכתובת? סמן על המפה"
- לחיצה מחליפה את ה-autocomplete ב-MapPinPicker
- אחרי אישור — אותו flow של שמירה (selected state → save)

**שינוי: `src/components/child-dashboard/AddressAutocomplete.tsx`**
- הוספת prop `onFallback?: () => void` — נקרא כשיש 0 תוצאות (אחרי חיפוש) או כשההורה לוחץ על הלינק
- מציג הודעה "לא נמצאו תוצאות" + לינק לפתיחת המפה

### קבצים

| קובץ | שינוי |
|-------|--------|
| `package.json` | הוספת `leaflet` + `react-leaflet` + `@types/leaflet` |
| `src/components/child-dashboard/MapPinPicker.tsx` | חדש — מפה אינטראקטיבית עם PIN + reverse geocoding |
| `src/components/child-dashboard/GeofenceSection.tsx` | הוספת מצב map picker כ-fallback |
| `src/components/child-dashboard/AddressAutocomplete.tsx` | הוספת onFallback prop + הודעת "לא נמצאו תוצאות" |

