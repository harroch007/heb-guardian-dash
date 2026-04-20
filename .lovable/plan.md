

# דף נחיתה זמני חדש — `/landing-v1`

## שינוי לפי הפידבק
ללא תמחור. במקום זה — באנר/שורה ברורה: **"הגישה כרגע ללא עלות — הצטרפו עכשיו"**.

## מבנה הדף

### 1. Navbar מינימלי (`NavbarV1.tsx`)
לוגו Kippy + כפתור "התחברות" + CTA primary "הצטרפו חינם"

### 2. Hero (`HeroV1.tsx`)
- **Badge עליון**: "🎁 הגישה כרגע ללא עלות"
- כותרת: **"בקרת הורים שמחנכת, לא רק חוסמת"**
- תת-כותרת: "כל הכלים לנהל את מכשיר הילד — וגם בונים אצלו הרגלים בריאים של ניהול זמן"
- 2 כפתורים: "התחילו עכשיו" + "ראו איך זה עובד"
- Mockup של `/home-v2` במכשיר

### 3. Trust Bar (`TrustBar.tsx`)
3 נתונים: "התקנה ב-3 דקות" · "עברית מלאה ו-RTL" · "עובד על כל אנדרואיד"

### 4. Features Grid (`FeaturesGrid.tsx`)
6 כרטיסים (אייקון Lucide + כותרת + שורה):
- 🛡️ חסימת אפליקציות
- ⏰ מגבלות זמן מסך
- 📅 לוחות זמנים (שינה/בית ספר/שבת)
- 📍 מיקום בזמן אמת
- 🌍 אזורים בטוחים (Geofence)
- 🔔 שליטה מרחוק (נעילה/צלצול/סנכרון)

### 5. Coach Spotlight (`CoachSpotlight.tsx`) — הסקציה המרכזית
Card גדול עם רקע gradient עדין:
- כותרת: **"Kippy Coach: הילד מרוויח זמן מסך — לא מקבל אותו במתנה"**
- 3 שלבים:
  1. אתם נותנים משימות
  2. הילד מבצע ומסמן (אפילו עם תמונה)
  3. אתם מאשרים → דקות נכנסות לבנק
- שורה תחתונה: "כמו חינוך פיננסי — אבל לזמן מסך"

### 6. Differentiators (`Differentiators.tsx`)
3 עמודות: פשוט להפעיל · שקוף לילד · בנוי לישראל (שבת/חגים)

### 7. How It Works (`HowItWorks.tsx`)
3 שלבים: הורדה → חיבור QR → ניהול

### 8. Free Access Banner (`FreeAccessCTA.tsx`)
Card גדול טורקיז: **"כרגע — הגישה ללא עלות"** + כפתור "צרו חשבון"

### 9. Footer (`FooterV1.tsx`)
לוגו · /privacy · /terms · support@kippyai.com

## טכניקה
- Route חדש `/landing-v1` ב-`App.tsx` (לא נוגעים ב-`/`)
- כל הקומפוננטים ב-`src/components/landing-v1/`
- שפה ויזואלית V2: רקע `#F7F7F7`, primary טורקיז `#2DB3A6`, פונט Heebo, `rounded-2xl`, RTL
- אנימציות: framer-motion (כמו `AnimatedSection` הקיים)
- ללא אזכור WhatsApp/AI/ניטור הודעות
- ללא מחירים בכלל

## קבצים שאצור
```
src/pages/LandingV1.tsx
src/components/landing-v1/NavbarV1.tsx
src/components/landing-v1/HeroV1.tsx
src/components/landing-v1/TrustBar.tsx
src/components/landing-v1/FeaturesGrid.tsx
src/components/landing-v1/CoachSpotlight.tsx
src/components/landing-v1/Differentiators.tsx
src/components/landing-v1/HowItWorks.tsx
src/components/landing-v1/FreeAccessCTA.tsx
src/components/landing-v1/FooterV1.tsx
```
+ עדכון `src/App.tsx` עם הראוט החדש

## אחרי אישור הדף
תעדכן אותי, ואז נחליף את `/` ל-`LandingV1` ונחבר את כל ה-CTAs (כולל `WAITLIST_MODE` ו-`/auth?signup=true`).

