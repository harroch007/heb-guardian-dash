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

No function was invoked, deployed, updated, or deleted while creating this
snapshot. No secret values are stored here.
