# Deployed Edge Function source snapshot

This directory is the immutable, read-only source snapshot for the active Edge
Function bundles in Supabase project `gscclrgcmvtbyquveoze`, captured through
the Supabase Management API on `2026-08-31T14:54:38+03:00`.

Each function is stored in its own versioned Supabase workdir:

```text
functions/<slug>/v<version>/supabase/functions/...
```

The per-function layout is intentional. The deployed bundles contain multiple
historical versions of `_shared/auth.ts`, `_shared/http.ts`,
`_shared/incident_private_key.ts`, `_shared/incident_retention_policy.ts`, and
`_shared/web_cors.ts`. Flattening those files into one shared directory would
create a synthetic source tree that does not exactly represent the deployed
bundles.

`manifest.json` records the provider bundle hash, version, JWT setting, and
snapshot path for every active function observed during capture. The legacy
`check-device-health` function is recorded as an explicit exclusion and its
source is not copied here. This preserves the decision not to modify, revive,
or treat that V1 function as canonical V2 source.

These snapshots are deployment evidence and exact recovery inputs. They must
not be edited or normalized in place. Future implementation source belongs in
`../../functions/`; promoting a snapshot into that editable tree requires an
explicit diff, tests, and a deployment review.

On `2026-09-02`, `v2-poll-device-commands` and
`v2-finish-device-command` were downloaded again from their active version 44
bundles. Their provider hashes and normalized source bytes match the recorded
version 39 bundles. The version 44 bundles are preserved here, and their exact
entrypoints were promoted into the editable tree. The editable tree retains
the newer, stricter shared device-auth implementation; the versioned snapshots
remain the byte-accurate record of the currently deployed shared dependencies.

No function was invoked, deployed, updated, or deleted while creating this
snapshot. No secret values are stored here.
