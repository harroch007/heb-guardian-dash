

## Problem

The header shows only Pencil (edit) and Trash2 (delete child) icons. There's no visible "reconnect" button. The `ReconnectChildModal` exists and works, but `showReconnectModal` is never set to `true` — no UI element triggers it.

When a parent uninstalls the app and wants to reconnect, the only red icon they see is Trash2 (delete child permanently), which is terrifying.

## Plan

**File: `src/pages/ChildDashboard.tsx`** — two changes:

### 1. Add a "חבר מחדש" (Reconnect) button in the device-connected section

Place a `RefreshCw` icon button next to the Pencil/Trash in the header bar, between Pencil and Trash. This button sets `showReconnectModal(true)` and opens the existing `ReconnectChildModal` which generates a new 6-digit pairing code.

### 2. Move delete (Trash2) behind a dropdown or make it less prominent

Move the delete action into a small dropdown menu (DropdownMenu from shadcn) triggered by a MoreVertical icon. This prevents accidental clicks and reduces visual anxiety. The dropdown will contain:
- "חבר מחדש" (reconnect) — triggers `setShowReconnectModal(true)`
- "נתק מכשיר" (disconnect device) — existing `handleDisconnectDevice` with confirmation
- Separator
- "מחק ילד" (delete child) — existing delete flow with AlertDialog confirmation

This way the header becomes: `← [name + status] [pencil] [⋮ menu]` — clean and safe.

### Summary of changes
- **1 file modified**: `src/pages/ChildDashboard.tsx`
- Add `MoreVertical` import from lucide-react
- Add `DropdownMenu` imports from shadcn
- Replace Trash2 button with DropdownMenu containing reconnect, disconnect, and delete options
- Delete confirmation remains via AlertDialog (unchanged logic)

