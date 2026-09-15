# Local source preservation — 2026-09-15

This branch is an archive, not an executable product update. It preserves distinct local source variants without replacing newer Lovable or Alpha100 behavior.

For each manifest entry, `objects/<sha256>.source` contains the exact original bytes of `path` from the named worktree and base commit. Check SHA256 before restoring into a separate checkout. Multiple paths can share an object. The original worktrees and indexes were left intact.

Generated caches, model weights, APKs, credentials and private runtime reports are not published. A broader private local source/documentation backup and artifact inventory are retained by the owner. Entries withheld by credential checks remain in that private backup; they were not deleted.

No application build, deployment or runtime validation is implied by this archive. Historical experiments can conflict with the current product. Do not merge this branch wholesale into the deployment branch.
