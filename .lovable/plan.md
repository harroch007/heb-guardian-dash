

# יצירת קובץ assetlinks.json לאימות Android App Links

## סיכום
ניצור את הקובץ `public/.well-known/assetlinks.json` עם תוכן ה-Digital Asset Links שסופק, כדי שיהיה נגיש בכתובת `https://kippyai.com/.well-known/assetlinks.json` לאחר פרסום.

## מה יתבצע

### קובץ חדש: `public/.well-known/assetlinks.json`
- תוכן הקובץ יהיה בדיוק כפי שסופק (ללא שינויים)
- מאשר ל-Android שהאפליקציה `com.kippy.safety.core` מורשית לטפל בכל הקישורים של הדומיין
- SHA256 fingerprint: `64:E5:F4:40:35:7B:60:68:9A:AE:A4:4B:CC:BF:56:70:A8:ED:38:F7:83:A2:ED:52:B0:7A:1F:60:10:40:C6:5B`

### לאחר פריסה
- הקובץ יהיה נגיש ב: `https://kippyai.com/.well-known/assetlinks.json`
- Content-Type צפוי: `application/json`
- נאמת שהקובץ נגיש בפועל לאחר הפרסום

