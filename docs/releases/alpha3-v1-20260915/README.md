# Alpha 3.0 Version 1 — source consolidation

Date: 2026-09-15. This milestone identifies source, not a new installed APK or production deployment.

## Baselines and preservation

- Android: versionCode 100, versionName 2.0.0-alpha.60, Room 41. Alpha99 remains the last device-validated version. Published source ancestry 959c0b1fe7d3d30b69ab49edd39a6419f8c58d79 is retained.
- Web: latest Lovable/main base 3fd568550233e061d4150ae01a135d23d186e53d is retained, including double-confirm child removal and generated Supabase types.
- Active Supabase project: gscclrgcmvtbyquveoze. Persisted deployment evidence reports submit59 and moderation5; this operation neither redeploys nor independently validates the current remote functions.
- Original dirty worktrees and their indexes are preserved. Historical incompatible local alternatives are recoverable source archives, not activated product features.
- Web archive: https://github.com/harroch007/heb-guardian-dash/tree/59365ee08f4d751b751706ef6f145288897391c0
- Android archive: https://github.com/harroch007/KippySafetyCore/tree/edbe8206d295093a8818fb779757b739cb5e590f
- Archive object SHA256 values were verified against committed Git blobs. Full local source snapshots and complete Git-history bundles are retained privately under Kippy-Reviews/alpha3-v1-20260915/preservation. Sensitive files, signing material, runtime evidence and generated outputs are not added by this consolidation.

## Validation evidence

- Android Alpha compilation passed; MessageHistoryReaderTest 8/8 and ExpertReviewStoreTest 3/3 passed. Room generated schema41. Exact migration40-to-41 SQL preserved synthetic legacy data on desktop SQLite and matched schema41 structure. This is not Android Room/SQLCipher instrumentation or device proof.
- Backend: 28 focused Deno contract tests passed; both canonical entrypoints passed Deno type checking. Existing isolated SQL contract evidence is preserved locally.
- Web: TypeScript and production build passed. Lint passed with 34 existing warnings. Initial focused browser suite passed 50/53; three obsolete single-confirm expectations were updated for the existing double-confirm product flow. The entire child-management file then passed 16/16, including those three cases.
- Visual inspection: reconnect, remove, final confirmation and retry screenshots use synthetic data. Mobile390 and desktop1280 dialogs are contained, Hebrew/RTL and keyboard focus are visible. Reduced-motion and keyboard assertions passed. No request is sent before final confirmation.
- The source-files.json manifest records SHA256 of the intended source files as staged in Git, before this documentation is added. Hashes identify content; they are not a cryptographic author signature.

## Outstanding runtime work

Before an Alpha100 device release, validate Room/SQLCipher migration and the actual frozen-history review path, edit/delete evidence, semantic assessment and parent delivery. Four separate Sep14 text capture gaps remain at 20:17, 20:18, 20:20 and 20:22; history work does not fix them. No device, installation, migration application or production function invocation is performed by this source consolidation.

## CI reconciliation follow-up

First full GitHub run 34958711002 passed 70/71 browser tests. The remaining assertion referenced a 1/1 aggregate counter removed by the newer Lovable design. Updated the test to verify the actual reporting child card and usable controls without issuing a command; the disconnected/reporting assertions remain. Focused local rerun passed. Product code was not changed. A new full CI run is required before web merge.
