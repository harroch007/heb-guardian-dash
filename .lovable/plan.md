

# החלפת כתובת אימייל מ-support@kippyai.com ל-yariv@kippyai.com

## הבעיה
האימייל `support@kippyai.com` מופיע ב-5 קבצים שונים (סה"כ 10 מופעים — href + טקסט).

## קבצים לעדכון

| # | קובץ | מיקום |
|---|---|---|
| 1 | `src/pages/PrivacyPolicy.tsx` | קישור + טקסט בתחתית העמוד |
| 2 | `src/pages/TermsOfService.tsx` | קישור + טקסט בתחתית העמוד |
| 3 | `src/components/legal/LegalPageLayout.tsx` | footer משותף לדפים משפטיים |
| 4 | `src/components/landing/LandingFooter.tsx` | footer דף הנחיתה |
| 5 | `supabase/functions/send-push-notification/index.ts` | contactInformation ב-VAPID config |

## השינוי
בכל קובץ — החלפת `support@kippyai.com` ב-`yariv@kippyai.com` (גם ב-`mailto:` וגם בטקסט המוצג).

## פירוט טכני
- 5 קבצים, שינוי טקסט בלבד
- אין שינוי לוגי או מבני
- ה-edge function `send-push-notification` ידרוש deploy מחדש

