

## Plan: Make Apps, Screen Time, and Schedules sections collapsible (closed by default)

Apply the same collapsible pattern used in `LocationSection` to the three other sections. Each section will start collapsed, showing only a compact header with a summary and chevron. Clicking the header expands/collapses the content.

### Changes

**`src/components/child-dashboard/AppsSection.tsx`**
- Add `expanded` state, default `false`
- Make `CardHeader` clickable with `cursor-pointer` and `onClick` toggle
- Add chevron icon (ChevronDown/ChevronUp) on the left side of the header
- Show summary text when collapsed (e.g. "3 חסומות" or number of installed apps)
- Wrap `CardContent` in `{expanded && (...)}`

**`src/components/child-dashboard/ScreenTimeSection.tsx`**
- Add `expanded` state, default `false`
- Make `CardHeader` clickable with toggle
- Add chevron icon; show the formatted total time as summary when collapsed (already visible in header)
- Wrap `CardContent` in `{expanded && (...)}`

**`src/components/child-dashboard/SchedulesSection.tsx`**
- Add `expanded` state, default `false`
- Make `CardHeader` clickable with toggle
- Add chevron icon; show a brief summary when collapsed (e.g. active schedule count)
- Wrap `CardContent` in `{expanded && (...)}`

All three sections will follow the exact same UX pattern as `LocationSection`: collapsed card with icon + title + summary + chevron, expanding on click.

