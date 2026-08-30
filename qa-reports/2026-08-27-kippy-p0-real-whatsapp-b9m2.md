# Kippy P0 Real WhatsApp Runtime Validation

- Date: 2026-08-27
- Verdict: NOT_READY
- Device: SM-G965F, Android 10 / API 29
- Baseline epoch: `1787813902193`
- Synthetic message SHA-256: `C70B8AD0DD8987391646459A8D4C01357C25B4D949D64F36207915567296E636`

## Provenance

- Android source: `f5ab4870df03d3beea55db4483449ce145317fba`
- Backend source: `2184b1ee5d98b032db8989616e58ea698110995e`
- Android and backend worktrees remained clean.
- No source edit, commit, push, deployment, reset, or production-package replacement occurred.

## Preconditions

- Per-device activation snapshot: contract version 1, revision 3, enabled and unexpired.
- Only the isolated alpha package handled the bounded P0 test.
- The approved WhatsApp conversation was the resumed activity.
- Alpha notification listener was enabled during admission.

## Observed Result

The notification-only phase passed:

- one private TEXT staging row;
- state `PENDING`;
- zero journal rows;
- zero ledger rows;
- zero canonical observations.

After a verified Accessibility reconnect and reopening the approved WhatsApp conversation, the service observed the live window but could not structurally identify any message candidate:

- spatial nodes: 139;
- structural candidates: 0;
- admitted candidates: 0;
- parsed messages: 0;
- stable nodes: 0;
- viewport state: unavailable.

The final enrichment condition therefore did not pass. The staging row remained `PENDING`; no ledger row or canonical observation was created. A post-attempt replay audit again found exactly one pending staging row and no duplicate downstream records.

## Safety and Restoration

- Grant revoked atomically: revision 3 to revision 4.
- Revision 4 snapshot: contract version 1, enabled false.
- Stale alpha parental-settings cache removed so local behavior defaults OFF.
- Original production Accessibility service restored and bound.
- Production notification listener restored; alpha listener removed.
- Alpha process stopped; Android test package removed.
- Production APK SHA-256 unchanged: `5A5FB57BC75E4D25B83D2328CD1B93C7E67727EFC0BE00306A40C61E3F700709`.
- Lab APK SHA-256 unchanged: `F5BBE4D058A60F912378F223477999A6BC01D178CC2B5F82B40DBAC64D25C7E8`.
- Backend remains at 58 matched migrations with zero local-only or remote-only migrations.
- `v2-get-parental-settings` remains ACTIVE at version 37.

## Primary Finding

The current parser is incompatible with the live WhatsApp conversation hierarchy on this device/version. The failure is upstream of reconciliation, notification enrichment, FIFO dispatch, and canonical observation creation.

## Single Next Action

Add a bounded, content-free structure diagnostic to the existing alpha path that records only widget class, resource ID, geometry, list position, and event metadata for the approved conversation. Use that evidence to implement the smallest parser compatibility correction, rerun synthetic gates, and then repeat one controlled real-message validation.
