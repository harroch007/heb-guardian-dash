

## Analysis: Waitlist User Cannot Sign In

### The Problem
The current flow has a gap:

1. User fills waitlist form (name, email, phone) — stored in `waitlist_signups`
2. Admin approves → adds email to `allowed_emails` → sends WhatsApp saying "log in"
3. **But the user has no Supabase Auth account** — they never signed up with a password
4. Login fails because there's no account
5. Password reset fails because there's no account to reset
6. Google OAuth may redirect to a work/company Google account instead of their personal one

### Root Cause
`WAITLIST_MODE = true` forces the Auth page to show **login only** — the signup tab is hidden. But approved waitlist users need to **create an account first**.

### Proposed Solution
Allow signup for emails that are in `allowed_emails`, even in waitlist mode.

**File: `src/pages/Auth.tsx`**

1. Change the initial state: instead of forcing `isLogin = true` in waitlist mode, keep it as login by default but **show a toggle** to switch to signup
2. When in waitlist mode and the user tries to sign up, check `is_email_allowed` first — if approved, allow the signup; if not, show "email not on the approved list" message
3. Update the signup button text to clarify: "הרשמה" (signup)

**Specific changes:**

- Line 31: Remove the forced `WAITLIST_MODE ? true :` so the toggle works
- Lines 163-172: Instead of blocking signup entirely in waitlist mode, call `is_email_allowed` RPC first. If allowed → proceed with `signUp`. If not → show error "האימייל שלך לא נמצא ברשימת המורשים"
- Lines ~500-520 (toggle area): Show the login/signup toggle even in waitlist mode, with adjusted text like "אושרת מרשימת ההמתנה? הרשם כאן"

**No database changes needed** — `allowed_emails` table and `is_email_allowed` RPC already exist.

### WhatsApp Message Update
**File: `src/pages/admin/AdminWaitlist.tsx`**

Update the `DEFAULT_MESSAGE_TEMPLATE` step 1 to say "הרשם/י" instead of "התחבר/י":
```
1. היכנס/י לאתר והרשם/י עם האימייל שאיתו נרשמת:
```

### Summary of Changes
- `src/pages/Auth.tsx` — allow signup for approved emails in waitlist mode (3 sections)
- `src/pages/admin/AdminWaitlist.tsx` — update WhatsApp message wording

### Technical Details
- The `handle_new_user` database trigger already checks `is_email_allowed` before creating a parent record, so the existing security layer remains intact
- `enforceWaitlistAccess` in AuthContext will still block unapproved emails post-signup
- Google OAuth will continue to work as before — if the user's Google email matches an approved email, they'll get through

