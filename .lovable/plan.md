

## Replace Coordinates with Address Autocomplete

### Problem
The current geofence UI shows raw lat/lng inputs — unusable for normal users. Need a proper address search with autocomplete suggestions.

### Approach
Use **OpenStreetMap Nominatim** (free, no API key needed) for address search with autocomplete. This works for Israeli addresses and returns coordinates automatically.

### How it works
1. User types an address (e.g., "גדעון האוזנר 3, הרצליה")
2. After 300ms debounce, query Nominatim: `https://nominatim.openstreetmap.org/search?q=...&format=json&countrycodes=il&limit=5`
3. Show dropdown with matching results
4. User selects → lat/lng saved automatically behind the scenes
5. Display saved address as readable text, not coordinates

### Changes

**New component: `src/components/child-dashboard/AddressAutocomplete.tsx`**
- Text input with Hebrew placeholder "הכנס כתובת: רחוב, מספר, עיר"
- Debounced search (300ms) against Nominatim API
- Dropdown list of results showing `display_name`
- On select → returns `{ latitude, longitude, address }` to parent
- Loading spinner while searching
- RTL, clean styling matching existing UI

**Modified: `src/components/child-dashboard/GeofenceSection.tsx`**
- Remove lat/lng `Input` fields entirely
- Replace with `AddressAutocomplete` component
- When place exists, show saved address text (from label field) instead of coordinates
- "Use device location" button stays as-is (already has address from device)
- On save, store the selected address in the `label` field of `child_places`

**Modified: `src/hooks/useChildPlaces.ts`**
- `upsertPlace` already accepts `label` — no changes needed, just ensure UI passes the full address string as label

### UI Flow (after changes)

```text
┌─────────────────────────────┐
│ 🏠 בית                  מוגדר │
│ גדעון האוזנר 3, הרצליה       │
│ רדיוס: [150 מ׳ ▼]           │
│ [עדכן מיקום]        [🗑]    │
└─────────────────────────────┘

Editing mode:
┌─────────────────────────────┐
│ השתמש במיקום המכשיר: ...     │
│ [הכנס כתובת: רחוב, מספר, עיר]│
│   ┌─ גדעון האוזנר 3, הרצליה │
│   ├─ גדעון האוזנר 5, הרצליה │
│   └─ גדעון האוזנר, רעננה    │
│ [שמור]              [ביטול] │
└─────────────────────────────┘
```

### Files

| File | Change |
|------|--------|
| `src/components/child-dashboard/AddressAutocomplete.tsx` | New — reusable address search component |
| `src/components/child-dashboard/GeofenceSection.tsx` | Replace lat/lng inputs with AddressAutocomplete, show address text |

No backend changes needed — `label` field already exists in `child_places`.

