## Co-Parent Phase 2 UI — Implementation Plan

### Current V2 Surface Mapping

**Where family/account management lives:**

- `FamilyV2.tsx` — children list, add child button, family summary. Natural home for co-parent management section.
- `SettingsV2.tsx` — account info, subscription, push notifications. Has "Family" section linking to FamilyV2.
- `ChildControlV2.tsx` — per-child management with dropdown menu containing: edit child, reconnect, disconnect device, delete child (owner-only/destructive actions are here).

**Where owner-only actions currently appear:**

- **Add child**: `FamilyV2.tsx` lines 244, 332-341 (two places: empty state + bottom CTA), plus `AddChildModal`
- **Delete child**: `ChildControlV2.tsx` lines 365-376 + dropdown menu item lines 476-481
- **Disconnect device**: `ChildControlV2.tsx` lines 378-390 + dropdown menu item lines 469-474
- **Billing/upgrade**: `FamilyV2.tsx` line 354 (checkout button), `SettingsV2.tsx` line 257 (upgrade button)

**Critical data query issue found:**  
HomeV2, FamilyV2, and ChildControlV2 all use `.eq("parent_id", user.id)` to fetch children. A co-parent's `auth.uid()` differs from `parent_id`, so they'd see zero children despite RLS allowing access. Fix: remove the explicit `parent_id` filter and rely on RLS, or use `get_family_owner_id()` only where an existing query truly requires owner resolution.

**Accept-invite entry point:**  
No existing accept flow. Smallest approach: a new `/accept-invite/:inviteId` route that uses the real existing RPC flow. Do not rely on direct pending-row reads from `family_members` unless current RLS already allows that safely. The invited adult would receive a link (email/WhatsApp — out of scope for this phase) containing the invite ID.

---

### Plan

#### 1. Create a `useFamilyRole` hook

A small hook that queries `family_members` on mount and exposes:

- `role: 'owner' | 'co_parent'`
- `isOwner: boolean`
- `membership: { id, owner_id, receive_alerts, status } | null`
- `loading: boolean`

Logic: query `family_members` where `member_id = auth.uid()` and `status = 'accepted'`. If found → `co_parent`. Otherwise → `owner` (backward compatible default).

File: `src/hooks/useFamilyRole.ts`

#### 2. Fix children queries for co-parent visibility

In `HomeV2.tsx`, `FamilyV2.tsx`, and `ChildControlV2.tsx`, remove the `.eq("parent_id", user.id)` filter on the children query. RLS already enforces family access on SELECT, so the query will return only children the caller is authorized to see. This is the minimum change needed to make V2 work for co-parents.

For `ChildControlV2.tsx` specifically, the `fetchData` query also filters by `parent_id` — remove that filter too.

Files: `src/pages/HomeV2.tsx`, `src/pages/FamilyV2.tsx`, `src/pages/ChildControlV2.tsx`

#### 3. Co-parent management section in FamilyV2

Add a new section at the bottom of `FamilyV2.tsx` (above the `AddChildModal`), visible only to owners:

- Query `family_members` by `owner_id = auth.uid()` to fetch the current pending/accepted co-parent row
- Shows current co-parent status (none / pending invite / active co-parent)
- If none: "Invite co-parent" button → opens a small inline form (email + alert toggle)
- If pending: shows invited email + status badge + revoke button
- If accepted: shows co-parent name/email if available + alert toggle switch + revoke button
- Calls `invite_co_parent`, `revoke_co_parent` RPCs
- Reads/updates `family_members` table directly for `receive_alerts`

This uses the `useFamilyRole` hook only to determine if current user is owner. The actual membership row shown in this section must come from `owner_id = auth.uid()` query, not from the hook.

File: `src/pages/FamilyV2.tsx` (add a narrow new section/component)

#### 4. Owner-only action hiding in ChildControlV2

Use `useFamilyRole` hook. When `isOwner === false`:

- Hide "מחק ילד" (delete child) from the dropdown menu
- Hide "נתק מכשיר" (disconnect device) from the dropdown menu
- Keep: edit child name, reconnect, all operational actions (ring, locate, sync, apps, schedules, bonus time)

File: `src/pages/ChildControlV2.tsx`

#### 5. Owner-only action hiding in FamilyV2

When `isOwner === false`:

- Hide "הוסף ילד" button (both empty state and bottom CTA)
- Hide billing/upgrade CTA card
- Hide the co-parent management section (co-parent shouldn't manage themselves)

File: `src/pages/FamilyV2.tsx`

#### 6. Owner-only action hiding in SettingsV2

When `isOwner === false`:

- Hide or disable the "שדרג עכשיו" upgrade button in subscription section
- Optionally show a role badge ("הורה שותף") in the account section

File: `src/pages/SettingsV2.tsx`

#### 7. Accept invite page

Create a minimal `/accept-invite/:inviteId` route:

- Uses the real `accept_family_invite(inviteId)` RPC
- If invite preview data is safely readable under current RLS, show invite details
- Otherwise show a minimal generic acceptance screen ("הוזמנת להצטרף למשפחה") without relying on direct pending-row select
- "Accept" button calls `accept_family_invite(inviteId)` RPC
- On success: redirects to `/home-v2`
- On error: shows appropriate Hebrew message
- If not logged in: redirects to `/auth` with a return URL

File: `src/pages/AcceptInvite.tsx`  
Route added in: `src/App.tsx`

#### 8. No backend changes expected

All RPCs and RLS are already in place. The main required fix is client-side: removing explicit `parent_id` filters that prevent co-parents from seeing data that RLS already authorizes.

If a real blocker is found around pending invite preview under current RLS, allow only the smallest safe backend addition needed for preview/validation and report it explicitly.

---

### Files Changed Summary


| File                           | Change                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `src/hooks/useFamilyRole.ts`   | New — role detection hook                                                            |
| `src/pages/HomeV2.tsx`         | Remove `.eq("parent_id", user.id)` filter                                            |
| `src/pages/FamilyV2.tsx`       | Remove parent_id filter + add co-parent management section + hide owner-only actions |
| `src/pages/ChildControlV2.tsx` | Remove parent_id filter + hide owner-only menu items for co-parent                   |
| `src/pages/SettingsV2.tsx`     | Hide upgrade button for co-parent + optional role badge                              |
| `src/pages/AcceptInvite.tsx`   | New — invite acceptance page                                                         |
| `src/App.tsx`                  | Add `/accept-invite/:inviteId` route                                                 |


### What This Does NOT Change

- No Android changes
- No legacy (non-V2) screen changes
- No billing flow changes
- No notification delivery changes (phase 3)
- No redesign of existing pages
- No backend/migration changes unless a real pending-invite preview blocker is found and explicitly reported