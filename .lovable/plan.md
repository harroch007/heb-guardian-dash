
# SYSTEM_PROMPT 2.0 + Data Enrichment for analyze-alert

## Overview
Replacing the existing SYSTEM_PROMPT (lines 10-179) with the full v2.0 provided by the CEO, and enriching the `userMessage` with child age/gender and alert history per chat.

## Changes

### File: `supabase/functions/analyze-alert/index.ts`

#### Change 1: Replace SYSTEM_PROMPT (lines 10-179)
Replace the entire `SYSTEM_PROMPT` constant with the CEO-approved v2.0 text. Key improvements:
- Structured scoring framework (severity x involvement grid + adjustments)
- Non-overlapping verdict ranges: 0-24 safe, 25-59 monitor, 60-79 review, 80-100 notify
- Iron rule: child_role cannot be "bystander" in private chats
- `patterns` field = behavioral tags only, no PII or quotes
- `social_context` without `participants` array (label + description only)
- `positive_behavior` = null when not detected (never `detected: false`)
- `recommendation` for notify = 3 numbered steps
- Age/gender awareness in scoring
- Alert history awareness for pattern detection
- Stack window context (40 private / 60 group)

#### Change 2: Add alert history query (after line 328, before userMessage construction)
Query the `alerts` table for the same `child_id` + `chat_name` in the last 7 days to provide `alertHistoryLine`:

```text
Alert history for this chat: 3 alerts in last 7 days, max_risk=82
```

This enables the AI to detect cross-stack patterns (repeated bullying from the same chat over days).

#### Change 3: Add child context line (around line 334)
Build a `childContextLine` from the already-computed `childAge` and `childGender`:

```text
Child age: 10, Gender: male
```

#### Change 4: Update userMessage construction (lines 335-343)
Add the two new lines (`childContextLine` and `alertHistoryLine`) to the user message array.

#### Change 5: Simplify social_context cleanup (lines 438-457)
Remove the `participants` filtering logic since v2.0 no longer returns a `participants` array. Keep only the group/private null enforcement.

#### Change 6: Increase max_tokens (line 361)
Increase from 1500 to 2000 to accommodate the more detailed notify recommendations (3 numbered steps) and richer output.

## Technical Details

### Alert History Query
```javascript
let alertHistoryLine = 'Alert history for this chat: 0 alerts in last 7 days, max_risk=0';

if (childIdForLookup && chatNameForLookup) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentAlerts } = await supabase
    .from('alerts')
    .select('ai_risk_score')
    .eq('child_id', childIdForLookup)
    .eq('chat_name', chatNameForLookup)
    .gte('created_at', sevenDaysAgo)
    .neq('id', alertId); // exclude the current alert

  if (recentAlerts && recentAlerts.length > 0) {
    const maxRisk = Math.max(...recentAlerts.map(a => a.ai_risk_score ?? 0));
    alertHistoryLine = `Alert history for this chat: ${recentAlerts.length} alerts in last 7 days, max_risk=${maxRisk}`;
  }
}
```

### Updated userMessage
```javascript
const childContextLine = (childAge !== null && childGender)
  ? `Child age: ${childAge}, Gender: ${childGender}`
  : '';

const userMessage = [
  'Analyze this message content:',
  `Chat type: ${alert.chat_type || 'UNKNOWN'}`,
  `Author type of flagged message: ${alert.author_type || 'UNKNOWN'}`,
  relationshipLine,
  chatNameHint,
  childContextLine,
  alertHistoryLine,
  '',
  redactPII(content),
].filter(Boolean).join('\n');
```

### social_context Cleanup (simplified)
```javascript
let cleanedSocialContext = aiResult.social_context;
if (!isGroupChat) {
  cleanedSocialContext = null;
}
```

## Files Modified
| File | Change |
|------|--------|
| `supabase/functions/analyze-alert/index.ts` | Replace SYSTEM_PROMPT, add alert history query, add child context to userMessage, simplify social_context cleanup, increase max_tokens |

## No Database Changes Required
All data needed (alerts table, children table, daily_chat_stats) already exists.

## Expected Results
For the specific case mentioned (private chat, "Yariv Harroch" sending "דיי כבר נמאס ממך ישמן, אל תבוא מחר לבית ספר"):
- **child_role**: "target" (not "bystander" -- iron rule for private chats)
- **summary**: "הילד/ה קיבל/ה הודעה פוגענית עם השפלה ואיומים"
- **meaning**: Active language reflecting direct targeting
- **risk_score**: ~70-80 (severity=4, involvement=2, base=70-80, pattern and age adjustments apply)
- **recommendation**: 3 numbered steps for notify verdict
- **social_context**: null (private chat)
