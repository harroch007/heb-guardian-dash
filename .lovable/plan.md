

# מפה מאוירת בסגנון Wolt/Gett

## ההצעה
החלפת ה-iframe של OpenStreetMap (`mapnik`) ב-`LocationMap.tsx` במפה מבוססת **Leaflet + CartoDB Voyager** — סגנון מאויר, פסטלי, רך, חינמי לחלוטין וללא API key.

## למה CartoDB Voyager
- אסתטיקה דומה ל-Wolt/Gett (צבעים רכים, פחות "טכני")
- חינם לחלוטין, ללא רישום
- תמיכה טובה בעברית
- `leaflet` + `react-leaflet` כבר בשימוש ב-`MapPinPicker.tsx` בפרויקט — אז אין תלות חדשה

## השינוי
קובץ אחד בלבד: `src/components/LocationMap.tsx`
- מעבר מ-iframe ל-`MapContainer` של `react-leaflet`
- Tile layer: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`
- Marker סגול בצבע הפלטה של Kippy על המיקום
- שמירה על אותו ממשק props (`latitude`, `longitude`, `name`)
- שמירה על אותו עיצוב כרטיס וגבהים responsive

## מה לא משתנה
- אין שינויי DB, RPC, או Edge Functions
- `LocationSectionV2` וכל שאר הצרכנים של `LocationMap` ממשיכים לעבוד ללא שינוי
- אותם נתוני lat/lng מה-`devices`

## מה אני צריך ממך
**רק אישור להמשיך.** אחרי אישור — אעדכן את `LocationMap.tsx` ותראה מיד את המפה החדשה אצל רואי וגם אצל יריב.

