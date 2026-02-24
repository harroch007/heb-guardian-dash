

## Plan: Upgrade AI Model to gpt-4.1

Two simple changes in `supabase/functions/analyze-alert/index.ts`:

### Change 1: Add console.log before the OpenAI call
Around line ~678 (before the `fetch` call to the OpenAI API), add:
```
console.log("Using model: gpt-4.1 for alert analysis");
```

### Change 2: Change model from `gpt-4o-mini` to `gpt-4.1`
Line 682: replace `model: 'gpt-4o-mini'` with `model: 'gpt-4.1'`

No other changes to temperature, max_tokens, prompts, or any other logic.

### Technical Detail
- File: `supabase/functions/analyze-alert/index.ts`
- Line 682: `model: 'gpt-4o-mini'` → `model: 'gpt-4.1'`
- New log line inserted just before the fetch call
- Edge function will be redeployed after the change

