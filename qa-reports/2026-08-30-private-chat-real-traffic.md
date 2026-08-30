# QA Session: Kippy WhatsApp — private-chat real traffic

## Executive Summary

- **Outcome:** Passed with findings
- **User goal:** Verify that natural WhatsApp traffic in a 1:1 chat is retained exactly once with complete text.
- **Runtime validation:** Device `21a9bad8de0c7ece`; WhatsApp was opened on a private chat; three recent text rows were visible and non-empty; three new `safe_local_stage_1` results were recorded; three replay attempts were rejected as exact-source duplicates.
- **Top risks:** The three-message sample contained no reply-shaped message; PRIVATE first-entry screen-capture bootstrap was not activated during this session.
- **Recommended next action:** Run a separate natural private-chat reply and first-entry screen-path scenario when those conditions are intentionally active.

## Mission and Persona

- **Product/build:** Kippy V2 Alpha on the physical Android device.
- **Scope:** Natural 1:1 WhatsApp text capture, reply handling, and PRIVATE bootstrap relevance.
- **Persona:** Parent validating that a child's real conversation is not silently lost or duplicated.
- **Context and constraints:** No synthetic messages; no message sent by the system; no message content retained in this report.
- **Success definition:** Each natural message appears in the private-chat UI and is accepted once with non-empty text, without duplicate persistence.
- **Explicit assumptions:** The three messages sent by the user correspond to the three newest private-chat rows and the three new intake acceptances observed after opening the chat.

## Environment and Safety

- **Date/time and timezone:** 2026-08-30, Asia/Jerusalem.
- **Device:** Samsung SM-G965F, serial `21a9bad8de0c7ece`.
- **Account/test data:** Existing real WhatsApp account and private chat; content intentionally omitted.
- **Tools used:** Android `adb`, WhatsApp UI hierarchy, Kippy content-free logcat diagnostics, on-device DB file metadata.
- **Sensitive checkpoints:** Accessibility and notification listener were confirmed enabled/bound before testing. DB/WAL/SHM baseline backup: `qa-reports/private-chat-baseline-20260830T1324-db.tar`.

## Coverage Map

| Area or risk | Scenario | Status | Evidence | Notes |
|---|---|---|---|---|
| Ordinary text | Three natural messages in the private chat | Passed | 3 newest UI rows had non-empty bodies; 3 new intake acceptances | No content reported |
| Exact-once persistence | Reprocessing after initial acceptance | Passed | 3 `rejected_exact_source_duplicate` results | No duplicate acceptance observed |
| Reply capture | Natural private-chat reply | Not run | No quoted/reply UI marker in the three-message sample | Requires a new natural reply |
| PRIVATE bootstrap | First transition to screen-capture path | Not run | No activation evidence for the P0 screen path in this session | Legacy/accessibility path was active |

## Findings

### QA-001 — Reply scenario was not present in the submitted sample

- **Type:** Unverified risk
- **Severity:** Major
- **Likelihood:** Medium
- **Confidence:** Confirmed
- **Affected persona/goal:** Parent relying on complete capture of private-chat replies.
- **Starting state and preconditions:** Private chat open; three natural text messages visible.
- **Expected:** At least one reply-shaped message should be captured and retained once.
- **Actual:** No reply marker was present in the tested three-message sample.
- **Evidence:** Content-free UI inspection reported `reply_markers=0`.
- **Recommended correction:** None yet; execute a dedicated natural private-chat reply scenario.

### QA-002 — PRIVATE bootstrap was not exercised

- **Type:** Unverified risk
- **Severity:** Major
- **Likelihood:** Medium
- **Confidence:** Confirmed
- **Affected persona/goal:** Parent relying on no duplicates during first screen-capture activation.
- **Actual:** No P0 screen-path activation/bootstrap evidence appeared during this run.
- **Evidence:** Diagnostics showed accessibility/legacy intake activity, with no private screen bootstrap event.
- **Recommended correction:** None yet; repeat only when the device is configured to activate the PRIVATE screen path.

## Session Close

- **Exploration passes without material new findings:** 1
- **Stop reason:** Scope complete for the three submitted messages; reply and bootstrap conditions were absent.
- **Evidence locations:** Device logcat (content-free), UI hierarchy counts, DB/WAL metadata, and the baseline DB archive listed above.
