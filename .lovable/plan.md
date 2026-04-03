## Co-Parent / Partner Role — Phase 1 Backend Foundation

### 1. Current Model (Before Changes)

**Core structure — single-parent ownership:**

- `parents` table: `id` (= `auth.uid()`), `full_name`, `phone`, `email`, `group_id`, `is_locked`
- `children` table: `parent_id` column directly references the owning parent
- No `family_members`, `memberships`, or `roles` table exists
- No co-parent concept anywhere in the system

**Single-parent assumption locations:**


| Layer                    | Pattern                                                                          | Count     |
| ------------------------ | -------------------------------------------------------------------------------- | --------- |
| RLS policies             | `children.parent_id = auth.uid()`                                                | 24 tables |
| RPCs                     | `delete_child_data` checks `parent_id != auth.uid()`                             | 1         |
| RPCs                     | `generate_new_pairing_code` — relies on current ownership path / RLS assumptions | 1         |
| RPC                      | `approve_chore` checks `parent_id = auth.uid()`                                  | 1         |
| `children` INSERT        | `parent_id = auth.uid()`                                                         | 1         |
| `children` DELETE        | `parent_id = auth.uid()`                                                         | 1         |
| `device_commands` INSERT | joins `children.parent_id = auth.uid()`                                          | 1         |
| `settings` ALL           | `parent_id = auth.uid()` or child_id match                                       | 1         |


**Key insight:** Every data access gate goes through ownership of the child, but not every table keys the same way. A co-parent needs to pass this gate without changing `children.parent_id` (which must remain the owner).

### 2. Design — Smallest Additive Model

**Strategy:** Create a `family_members` table that maps additional parents to the owner's family. Then create a small set of `SECURITY DEFINER` functions so RLS can answer the right question based on the table’s real key path. Use a child-based helper for tables keyed by `child_id`, a device-based helper for tables keyed by `device_id`, and keep owner-only checks for destructive family-structure actions.

**New tables:**

```text
family_members
├── id (uuid, PK)
├── owner_id (uuid, NOT NULL, FK → parents.id)         -- the primary parent
├── member_id (uuid, NULL, FK → parents.id)            -- NULL while invite is pending
├── role (text, NOT NULL, default 'co_parent')         -- 'co_parent' only for now
├── receive_alerts (boolean, NOT NULL, default false)  -- owner-controlled, set explicitly on invite
├── status (text, NOT NULL, default 'pending')         -- pending/accepted/revoked
├── invited_email (text, NOT NULL)                     -- normalized/lowercased email for matching on signup
├── invited_at (timestamptz, default now())
├── accepted_at (timestamptz)
├── revoked_at (timestamptz)
├── CHECK (role = 'co_parent')
├── CHECK (status IN ('pending', 'accepted', 'revoked'))
├── CHECK (owner_id IS DISTINCT FROM member_id)
├── UNIQUE(owner_id, invited_email)

```

**No** `family_invitations` **table** — the membership row itself carries the invitation lifecycle (pending → accepted → revoked). This avoids a second table.

**New functions (all** `SECURITY DEFINER`**):**

1. `is_family_parent(p_child_id uuid) → boolean` — returns true if caller is the child's `parent_id` OR has an accepted `co_parent` membership where `owner_id = child.parent_id`. This is the core gate replacement for tables keyed by `child_id`.
2. `is_family_parent_for_device(p_device_id uuid) → boolean` — returns true if caller is the owner/co-parent of the child that owns the device. This is used for tables/RPCs keyed by `device_id`.
3. `is_child_owner(p_child_id uuid) → boolean` — returns true only if caller is the child's `parent_id`. Used for destructive actions (delete child, add child).
4. `get_family_owner_id() → uuid` — given `auth.uid()`, returns either `auth.uid()` (if they are an owner) or the `owner_id` from their accepted membership. Use only where an existing query truly needs the owner's `parent_id`.

**RLS update strategy:**

For all 24 tables with `children.parent_id = auth.uid()` pattern:

- **READ (SELECT)**: Replace with the matching family helper for the table’s real key path — co-parent can see everything
- **WRITE (INSERT/UPDATE on operational tables)**: Replace with the matching family helper — co-parent can manage apps, schedules, etc.
- **DESTRUCTIVE (DELETE children, INSERT children)**: Keep using `is_child_owner(child_id)` or `parent_id = auth.uid()` — owner only

Specific table-level decisions:


| Table                      | SELECT                        | INSERT                                | UPDATE                                         | DELETE             |
| -------------------------- | ----------------------------- | ------------------------------------- | ---------------------------------------------- | ------------------ |
| `children`                 | `is_family_parent`            | owner only (`parent_id = auth.uid()`) | `is_family_parent` (non-ownership fields only) | owner only         |
| `alerts`                   | `is_family_parent`            | N/A (device inserts)                  | `is_family_parent`                             | owner only         |
| `app_policies`             | `is_family_parent`            | `is_family_parent`                    | `is_family_parent`                             | `is_family_parent` |
| `schedule_windows`         | `is_family_parent`            | `is_family_parent`                    | `is_family_parent`                             | `is_family_parent` |
| `bonus_time_grants`        | `is_family_parent`            | `is_family_parent`                    | N/A                                            | N/A                |
| `device_commands`          | `is_family_parent_for_device` | `is_family_parent_for_device`         | N/A                                            | N/A                |
| `chores`                   | `is_family_parent`            | `is_family_parent`                    | `is_family_parent`                             | `is_family_parent` |
| All other read-only tables | matching family helper        | unchanged                             | unchanged                                      | unchanged          |


**RPC updates:**

- `delete_child_data`: Keep `parent_id != auth.uid()` check (owner only) — no change needed
- `approve_chore`: Change to use `is_family_parent` — co-parent should approve chores
- `generate_new_pairing_code`: Add explicit family-parent authorization using the correct child/device helper — reconnecting an existing child/device is an operational action and should be allowed for co-parent

### 3. Invitation Lifecycle

```text
Owner invites by email → row created with status='pending', member_id=NULL
  ↓
Invited adult signs up / logs in → matches invited_email
  ↓
Calls accept_family_invite(invite_id) → status='accepted', member_id=auth.uid(), accepted_at=now()
  ↓
Owner can revoke → status='revoked', revoked_at=now()

```

**New RPCs:**

- `invite_co_parent(p_email text, p_receive_alerts boolean)` — owner creates pending membership
- `accept_family_invite(p_invite_id uuid)` — invited user accepts (matches email)
- `revoke_co_parent(p_member_id uuid)` — owner revokes

### 4. Alert Toggle

Stored in `family_members.receive_alerts` (boolean). Owner controls it explicitly at invite time and later via owner-only update. The push notification edge function and alert delivery pipeline will check this flag in phase 2.

### 5. Backward Compatibility

- `is_family_parent()` first checks `children.parent_id = auth.uid()` — if true, returns immediately. Only queries `family_members` as fallback. Existing single-parent accounts never hit the membership table.
- `is_family_parent_for_device()` resolves through the existing owner path first, then falls back to membership only if needed.
- No columns added to `children` or `parents`.
- No existing rows modified.
- All existing RLS policies are replaced (not stacked), maintaining identical behavior for owner-only accounts.

### 6. Migration Scope

**One migration file containing:**

1. Create `family_members` table with RLS
2. Create `is_family_parent()`, `is_family_parent_for_device()`, `is_child_owner()`, `get_family_owner_id()` security definer functions
3. Drop and recreate affected RLS policies on all 24 tables using the correct helper for each table’s real key path
4. Create `invite_co_parent()`, `accept_family_invite()`, `revoke_co_parent()` RPCs
5. Update `approve_chore` RPC to use `is_family_parent`
6. Update `generate_new_pairing_code` authorization to use family-parent access

**No Lovable UI changes in this phase** — the backend can be validated via `supabase--curl_edge_functions` or direct RPC calls.

### 7. Files Changed

- `supabase/migrations/[timestamp]_co_parent_foundation.sql` — single migration with all schema + RLS + RPC changes

### 8. What Remains for Phase 2

- UI for owner to invite/manage co-parent (SettingsV2 or FamilyV2)
- UI for co-parent to accept invite (Auth flow or dedicated page)
- Push notification delivery filtering by `receive_alerts`
- Co-parent sees correct role indicator in dashboard
- Hide add/remove child buttons for co-parent in UI
- AuthContext awareness of co-parent role