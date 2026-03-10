

## Fix: `NodeJS.Timeout` TypeScript errors

The `NodeJS` namespace is not available in a Vite/browser TypeScript config. Three files use `NodeJS.Timeout` for timer refs.

### Fix
Replace `NodeJS.Timeout` with `ReturnType<typeof setTimeout>` in all three files:

1. **`src/hooks/useTripleEscape.ts` line 15**: `useRef<ReturnType<typeof setTimeout> | null>(null)`
2. **`src/pages/ChildDashboard.tsx` line 107**: `useRef<ReturnType<typeof setTimeout> | null>(null)`
3. **`src/pages/Dashboard.tsx` line 188**: `useRef<ReturnType<typeof setTimeout> | null>(null)`

Three one-line changes. No logic changes.

