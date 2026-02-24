

## Dashboard Home Tab Redesign — Design-Only Plan

### Current State
The Dashboard currently renders a vertical stack of separate cards: Greeting, Digital Activity, Positive Alert, Yesterday Summary button, AI Insights, Top Contacts, Device Status, Top Apps, and Premium Upgrade. Each card is a standard `Card` component with similar styling, resulting in a flat, uniform look that doesn't guide the parent's eye to what matters most.

### Reference Analysis
The uploaded screenshot shows the existing layout. The user wants a redesign that is "הכי נכון להורה" — the most intuitive and parent-friendly design possible. This means:
- Prioritize what a parent cares about: "Is my child safe?" first, details second
- Reduce visual noise and card overload
- Create clear visual hierarchy
- Make actionable items immediately visible

### Proposed Design Changes (Pure CSS/Layout — No Logic Changes)

#### 1. Greeting — Compact Header Row
- Move the greeting to a single centered line with smaller text
- Add the refresh button inline (right side) instead of at the bottom
- Remove the `mb-6` spacer — tighter layout

#### 2. Digital Activity — Horizontal Stats Bar (Not a Card)
- Remove the card wrapper; render as a compact bordered row at the top
- 2 or 3 stat bubbles in a horizontal line with icons above numbers
- Subtle background (`bg-muted/30`), not a full card
- This is the "pulse" — parents glance at it, not study it

#### 3. AI Insights — Promoted to Hero Position
- Move AI Insights to be the **second element** (right after stats bar)
- Give it a distinct accent border (e.g., `border-primary/30`)
- The headline should be prominent (`text-base font-semibold`)
- Bullet insights below in smaller text
- This is the card parents actually read — it should be visually dominant

#### 4. Top Contacts — Pill Chips Inside a Compact Section
- Keep the horizontal pills layout but reduce padding
- Add a subtle section header instead of a full card header
- If no data, collapse entirely (don't show "אין נתונים")

#### 5. Device Status — Compact Inline Row
- Convert from a full card to a compact single-row summary:
  `📍 תל אביב · 🔋 41% · 🕐 לפני 6 דקות`
- Only expand to full card if tapped (collapsible)
- Footnote text removed to save space

#### 6. Top Apps — Visual Enhancement
- Add colored app icon circles (already exists) but make the row tighter
- Show usage as a mini progress bar instead of plain text
- Keep max 3 apps

#### 7. Yesterday Summary Button — Subtle Placement
- Move below AI Insights as a small text link, not a full-width outlined button
- `צפה בסיכום של אתמול ←` as a ghost link

#### 8. Positive Alert ("רגע טוב") — Inline Highlight
- If exists, show as a subtle green-tinted banner between greeting and stats
- Not a full card — a single-line callout with dismiss option

#### 9. Premium Upgrade Card — Keep As-Is
- Already well-designed, keep at bottom for free users

#### 10. Bottom Refresh — Remove
- Refresh is now in the header row, remove the bottom `רענון נתונים` button
- Keep the disclaimer text

### Card Order (Premium User)
```text
1. Greeting + Refresh (single row)
2. Positive Alert banner (if exists)
3. Digital Activity stats bar
4. Yesterday Summary link
5. AI Insights (hero card)
6. Top Contacts (compact)
7. Device Status (compact row)
8. Top Apps (with progress bars)
9. New Apps / Nightly Usage (conditional)
10. Disclaimer
```

### Card Order (Free User)
```text
1. Greeting + Refresh (single row)
2. Digital Activity stats bar (2 cols)
3. Device Status (compact row)
4. Top Apps
5. New Apps / Nightly Usage (conditional)
6. Premium Upgrade Card
7. Disclaimer
```

### Technical Scope
- **Files changed**: `src/pages/Dashboard.tsx` (layout reorder + styling), `src/components/dashboard/DashboardGreeting.tsx` (compact variant)
- **No new components** — just restructuring existing JSX and Tailwind classes
- **No data logic changes** — same hooks, same queries, same state
- **No new dependencies**
- Fully RTL-compatible, mobile-first responsive

