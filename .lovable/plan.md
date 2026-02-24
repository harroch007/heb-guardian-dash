

## Two Layout Tweaks in Dashboard.tsx

### Change 1: Move "צפה בסיכום של אתמול" below the disclaimer
- **Remove** the button block at lines 642-650 (the Yesterday Summary ghost link inside the `isPremium` block)
- **Add** it below the disclaimer text (after line 797), centered with `justify-center mx-auto`, wrapped in a `{isPremium && selectedChildId && (...)}` guard
- Keep the disclaimer's bottom margin on the new button instead

### Change 2: Rename "קשרים פעילים" → "הצ'אטים הפעילים ביותר"
- Line 700: replace `קשרים פעילים` with `הצ'אטים הפעילים ביותר`

### Files
- `src/pages/Dashboard.tsx` only

