# QA Session: Kippy Guardian — Google Maps integration

## Executive Summary

- **Outcome:** Passed with findings
- **User goal:** A Hebrew-speaking guardian can view child and family locations, search an Israeli address, and place a geofence pin without breaking the rest of the Guardian PWA.
- **Runtime validation:** Production build and the 18-test Playwright suite passed. From `http://localhost:5173`, Maps JavaScript loaded, a map reached idle, and reverse geocoding returned results. The Places API (New) autocomplete request was rejected because that API is not enabled for the Google Cloud project.
- **Top risks:** Address autocomplete currently falls back to “no results” for every query even though maps and reverse geocoding work.
- **Recommended next action:** Enable Places API (New) for the same Google Cloud project, then repeat the localhost autocomplete smoke before considering merge to `main`.

## Mission and Persona

- **Product/build/URL:** `heb-guardian-dash` review branch, Vite development origin `http://localhost:5173` and production build output
- **Scope:** Google Maps loader, child map, family map, address autocomplete, map pin picker, and broad Guardian PWA regression
- **Persona:** Hebrew-speaking guardian using the PWA on a mobile-sized viewport
- **Context and constraints:** Synthetic coordinates and address queries only; no real family or child data; no staging mutation or deployment
- **Success definition:** Existing Guardian routes still render; maps load from the approved local referrer; Maps, Places autocomplete, and Geocoding requests all succeed; RTL/mobile behavior remains usable
- **Explicit assumptions:** Google Cloud restriction, API-family, and budget details are manually supplied by the user and were not changed in this session

## Environment and Safety

- **Date/time and timezone:** 2026-09-02, Asia/Jerusalem
- **Device/browser/viewport or client:** Playwright Chromium, 390×844 mobile viewport; Playwright project defaults also exercised desktop and mobile routes
- **Account/test data:** Isolated synthetic Playwright data; no real guardian credentials or child content
- **Tools used:** Vite, TypeScript production build, ESLint, Playwright, Google Maps JavaScript SDK runtime calls
- **Sensitive checkpoints:** The public browser key was never printed in the report; no private keys, Console changes, deployment, or live environment mutation
- **Time or scope limit:** One integration and one focused runtime pass

## Coverage Map

| Area or risk | Scenario | Status | Evidence | Notes |
|---|---|---|---|---|
| General PWA regression | Full existing Playwright suite | Passed | `18 passed (1.1m)` | Public, auth, private parent, mobile, RTL, and child-install routes |
| Production compilation | Vite production and PWA service-worker build | Passed | Build exit 0 | Existing large-chunk warning remains |
| Maps referrer and SDK | Load Maps JS and construct a map on `localhost:5173` | Passed | `mapsNamespace=true`, `mapConstructed=true`, no auth console errors | Confirms the local referrer works |
| Reverse geocoding | Browser Geocoder request for synthetic Israeli coordinates | Passed | 11 results, no request error | Supports the map-pin fallback flow |
| Address autocomplete | Places API (New) suggestion request for a synthetic Hebrew query | Finding | Runtime RPC rejection | API is disabled/not enabled for the project |
| Key controls | Referrers, Maps-family API restriction, and budget | Passed (manual evidence) | User-supplied Console verification | Referrers: `www.kippyai.com`, `localhost:5173`; 35 Maps-family APIs; budget configured |

## Experience Trace

| Step | Persona action | Observed response | Expected/interpretation | Friction | Evidence |
|---|---|---|---|---|---|
| 1 | Opens the Guardian PWA and its existing routes | Routes render in Hebrew RTL on desktop and mobile | No regression outside maps | None | 18 Playwright tests passed |
| 2 | Opens a map-backed location view | Google Maps SDK loads and the map reaches idle | Child/family maps can render | None | Local Maps SDK smoke |
| 3 | Places a pin and resolves its address | Reverse geocoding returns results | Pin flow can show a human-readable address | None | Browser Geocoder smoke |
| 4 | Types an Israeli address | Places autocomplete request is rejected; UI catches it and presents no-results/fallback UI | Guardian cannot select a suggestion until the API is enabled | High | Places API (New) runtime rejection |

## Findings

### QA-001 — Address autocomplete cannot query Places API (New)

- **Type:** Functional defect
- **Severity:** Major
- **Likelihood:** High
- **Confidence:** Confirmed
- **Affected persona/goal:** Any guardian searching for an address while configuring a place/geofence
- **Starting state and preconditions:** Review branch served from the approved `http://localhost:5173` referrer with the integrated Google browser key
- **Steps to reproduce:**
  1. Load the shared Maps SDK through `src/lib/googleMaps.ts`.
  2. Create an autocomplete session token.
  3. Call `AutocompleteSuggestion.fetchAutocompleteSuggestions` with a Hebrew Israeli query.
- **Expected:** One or more authorized suggestions are returned.
- **Actual:** Google rejects the request because Places API (New) has not been used or is disabled for the project.
- **User/business impact:** The address field reports no results for valid addresses; the guardian must use the map-pin fallback.
- **Evidence:** Focused browser runtime smoke from `localhost:5173`; Maps and Geocoding succeeded in the same environment.
- **Reproduction:** 2/2 focused attempts failed consistently at the Places request, including a later retry to rule out immediate propagation delay.
- **Workaround:** Use the visible “סמן על המפה” fallback; this is less efficient than address search.
- **Recommended correction:** Enable Places API (New) for the key’s Google Cloud project and rerun the exact runtime smoke before merge.

## Blockers and Sensitive Stops

- Exact stopping point: Review branch preparation; no merge to `main` and no deployment.
- Reason: Places API (New) runtime validation failed despite the key’s manually verified restrictions.
- Approval or access required: Google Cloud API enablement is outside this code-only integration task.
- What remains unvalidated: Real address selection through Places and the exact live `www.kippyai.com` build after deployment.

## Untested Areas and Residual Risk

- **Not tested:** Real guardian data, live PWA deployment, real saved geofence mutation, iOS Safari rendering, and Google Cloud billing alerts firing.
- **Why:** Review-only task; no deployment or staging mutation was authorized.
- **Residual risk:** The key allows 35 Maps-family APIs, broader than the three code paths currently used; a configured budget is visibility/alerting unless a hard quota was also set.
- **Overall confidence:** High for the identified Places blocker and broad PWA regression; medium for final live-browser behavior until Places is enabled and the branch is deployed.

## Session Close

- **Exploration passes without material new findings:** 1
- **Stop reason:** Scope complete with one confirmed blocker
- **Evidence locations:** This report; local build/lint/Playwright output from the review worktree
