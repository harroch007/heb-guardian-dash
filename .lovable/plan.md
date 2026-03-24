## New Parallel Settings Screen — `SettingsV2`

### Overview

Create a new page at `/settings-v2` with a redesigned Settings screen using the `homev2-light` theme. The live `/settings` remains untouched.

### Architecture

Reuse only real connected hooks and data:

- `useAuth()` — user object
- `usePushNotifications()` only if already used safely in the current app and visually fits V2
- `useFamilySubscription()` only for real connected family/subscription summary
- `parents` table — parent name if verified
- `children` table — children summary if needed
- Existing real navigation only: `/notification-settings`, `/privacy`, `/terms`, `/checkout`, `/family`
- Existing real support actions only
- Existing real sign out flow only

Do **not** add any new account-management logic.  
Do **not** add any fake settings toggles.  
If a reused settings block is too tightly coupled to the live dark UI, create a V2-only wrapper instead of editing the live component.

### New file: `src/pages/SettingsV2.tsx`

Single page with `homev2-light` wrapper, standalone (no `DashboardLayout`), back button to `/home-v2`.

**Layout (light premium, RTL, mobile-first):**

1. **Header** — "הגדרות", subtitle "ניהול חשבון, התראות ותמיכה"
2. **Account section** — card showing only real connected data:
  - Parent name
  - Parent email
3. **Subscription section** — card showing only real connected data:
  - Family premium / subscription status
  - Children count
  - Premium children count only if real
  - "שדרג עכשיו" button only if the current app already uses a real upgrade flow and only when relevant
4. **Notifications section** — card with only real connected settings/actions:
  - Push notifications state only if truly connected and safe for V2
  - Test notification action only if already real and used in current app
  - Link to `/notification-settings` only if that route is already the real place for alert preferences
5. **Family summary** — card showing only real connected data:
  - Children names
  - Subscription status per child only if already real
  - "הוסף ילד" or family-management CTA only if existing real route/action already exists
6. **Privacy & Legal** — card with only real connected items:
  - Privacy policy button → `/privacy`
  - Terms button → `/terms`
7. **Support** — card with only real connected support actions:
  - WhatsApp support button
  - Bug report button only if this is already a real existing support action
  - Feature suggestion button only if this is already a real existing support action
8. **Sign out** — real sign-out action only
9. **Version footer** — only if this is already shown in the current app or already reliably available in the project

### Modified file: `src/App.tsx`

Add route + import:

```tsx
<Route path="/settings-v2" element={<ProtectedRoute><SettingsV2 /></ProtectedRoute>} />

```

### Real data used


| Data                            | Source                                                         | Type             |
| ------------------------------- | -------------------------------------------------------------- | ---------------- |
| Parent email                    | `auth.user.email`                                              | Real             |
| Parent name                     | `parents` table / auth metadata only if verified               | Real             |
| Children + subscription summary | `useFamilySubscription` / real connected family source         | Real             |
| Push notifications              | `usePushNotifications` only if already reliable in current app | Real if verified |
| Test push notification          | Existing real push flow only if already used in current app    | Real if verified |
| Alert preferences entry point   | `/notification-settings` only if real                          | Real if verified |
| Sign out                        | `useAuth().signOut`                                            | Real             |
| Support actions                 | Existing real support links/actions only                       | Real             |
| Privacy/Terms                   | Real routes `/privacy`, `/terms`                               | Real             |


### Items omitted (not truly connected)


| Item                                | Reason                                                |
| ----------------------------------- | ----------------------------------------------------- |
| Account editing (name/email change) | No verified edit flow exists                          |
| Plan details / billing history      | No verified billing-history UI/data flow              |
| FAQ / help center link              | No verified help-center page                          |
| Environment/debug info              | Not part of approved user-facing scope                |
| Fake settings toggles               | Not allowed                                           |
| Placeholder support actions         | Not allowed                                           |
| Version footer                      | Omit if not already reliably available in current app |


### Files changed


| File                           | Change                                                              |
| ------------------------------ | ------------------------------------------------------------------- |
| `src/pages/SettingsV2.tsx`     | New file                                                            |
| `src/App.tsx`                  | Add route + import                                                  |
| `src/components/settings-v2/*` | Only if needed for V2-only light wrappers / safe section components |


### Design

- Light premium theme via `.homev2-light` class
- Hebrew RTL, mobile-first
- Standalone (no `DashboardLayout`), back button to `/home-v2`
- Clean, trustworthy, service-oriented feel
- Reuse existing logic only if it does **not** affect the live `/settings`
- If reused sections do not visually match the new branding, create V2-only wrappers / light versions
- No fake toggles
- No invented settings
- No placeholder legal/support links
- No dark-theme leftovers