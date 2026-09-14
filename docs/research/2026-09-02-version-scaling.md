---
status: built
since: 2026-09-02
see: on-demand
note: pruning is on every surface and the board bounds itself; the hosted path's own latency (cold start, Firestore tail, GCS reads) is still unmeasured
---
# What a deep version stack costs, measured

**2 September 2026.** The repo-admin board took "a lifetime" to show its
screens, and every panel wore a badge like ×149. The hypothesis was that
rendering scales with the number of versions. This note is what was measured,
what the number turned out to be, and what was built because of it.

## The canvas in question

`prj_KCQQaoVSdv`, read through the local replica (`isocan --json ls`):

| | |
| --- | --- |
| items | 14 |
| versions across them | 837 (Build 149, Morning brief 140, Recently 137, Tree status 136, The repo's canvas 132, personas 3–54) |
| bytes of every version | 7.36 MB |
| bytes of the versions actually shown | 92 KB |
| the items' JSON, as the snapshot carries it | 221 KB |
| live oplog (bounded by hourly `gc`) | 500 entries, 270 KB |

The board republishes on every commit (`scripts/canvas-board.mjs` through
the post-commit hook), and the repo made 298 commits in seven days. That is
where 149 comes from. The design note for the board named this failure —
"silting", a new item per run — and the generator avoided it by editing
instead of adding, which is the same silt arriving as versions.

## Where the render time goes: not the versions

**What the canvas loads.** `ItemView` finds the current version and mounts
one document; `VersionContent` takes one hash. Nothing on a canvas load
touches an old version — `FilesPanel`, `ItemThumb`, `Minimap`, the card peek
all read `currentVersionId`. The oplog is fetched only by the scrubber, the
card peek and the lens, none of which run on open.

**Reproduced at scale.** A scratch daemon (`ISOCAN_HOME` in a temp dir, port
4447, the worktree's own build) seeded with 14 items × 150 versions — 2,100
`item.addVersion` ops in 75 s through `@isocan/api`. Opened in a browser:

| | |
| --- | --- |
| `GET /api/projects/:id/canvas` | 544 KB, **16 ms** |
| blobs fetched on open | 14 (one per item), **~70 ms each**, in parallel |
| iframes mounted | 14 |
| screens drawn | well under a second after the identity dialog |

So at 2.5× the real board's depth the render is not slow. The version count
is the right suspect for a different crime.

## What versions actually cost

1. **The snapshot.** Every version's metadata rides on every WebSocket
   hello, every `GET /canvas`, every `isocan` command (`canvasAndSnapshot`),
   and the replica the browser writes to IndexedDB. 221 KB on the real board
   against 92 KB of content; 544 KB on the scratch canvas against 33 KB
   after pruning. Linear in versions, and a cost paid on every load — real,
   and about a second of a slow connection rather than a lifetime.
2. **Storage.** 7.4 MB of blobs, an index (`blobs.json`, or a Firestore
   doc per blob) the hourly sweep lists in full, and the file backing
   rewriting a pretty-printed 431 KB `canvas.json` on every op. Linear in
   versions; nothing quadratic anywhere (the reducer copies a stack per
   `addVersion`, which at 150 deep is nothing).
3. **The fan.** Press S on a 150-deep stack and `VersionFanOut` mounted 150
   `VersionContent`s — 150 iframes, 150 blob fetches — to compare the
   newest few. **This was the one place the canvas paid for every version
   at once**, and it is exactly the gesture a person makes when a badge
   says ×149.

## What was not measured, and why

The hosted path. `isocan.io` needs a badge, and this session's browser had
none; the person's Chrome was not reachable. The likely shape, from the code
and the map (`architecture.md`): a Cloud Run instance that scaled to zero
replays its Firestore tail on the first request (`cloud-store.load` reads
every live op above `compactedThrough`, up to ~500 docs), then each panel is
a GCS read through the daemon. Neither is the versions' fault, and both are
worth timing with a badge in hand — `curl -w '%{time_total}'` against
`/api/projects/prj_KCQQaoVSdv/canvas` and one blob, cold and then warm.

Two things seen on the way. `isocan gc --dry-run` took 4–24 s against the
big remote canvas AND 18 s against a small canvas homed locally, so that
wait is the engine's single-writer queue (the hourly sweep, a home link's
work) and not the log's size. And the daemon log for this canvas shows the
home link dropping and reconnecting ("has not carried prj_KCQQaoVSdv for 3
attempts"), which is a different investigation.

## What was built

`item.pruneVersions { itemId, keep }` — one op, on every surface. The
reasoning is in the changelog for the day and on the op itself; the short
form:

- An **op** rather than a `gc` field, because replicas fold the log and a
  stack shortened outside it would leave every replica disagreeing with
  its home about an item's history.
- **Never undoable**, like `trash.empty`, because the collector may have
  swept the bytes an undo would point back at.
- **The current version always survives**, whatever its age — pruning is
  about size and must not change what an item shows.
- **Bytes follow the horizon**: the old blobs leave `reachableHashes` when
  the `addVersion` entries that named them are compacted, and `gc` sweeps
  them then. Held by `gc.test.ts`.
- **One home for the rule**: `pruneVersions`/`prunedVersions` in the
  reducer, imported by the CLI's refusal count, the API's short-circuit and
  the fan's offer.

Surfaces: `isocan version prune <items…> --keep N --force` (`--all`),
`isocan gc --keep-versions N --force`, `canvas.pruneVersions()` in the API
with the board generator calling it after every `edit` (`KEEP_VERSIONS =
14`), and the fan mounting 24 live cards (`FAN_LIVE`) and offering "Keep
only the latest 14…" past that depth.

Measured on the scratch canvas: `gc --keep-versions 5 --force --keep-ops 0`
took 2,100 versions to 70, the snapshot from 544 KB to 33 KB, and swept
2,030 blobs (9.6 MB). The real board was left for a person to prune.

## What was refused

**A snapshot that omits old versions and fetches them lazily.** It is the
obvious way to make the hello O(items), and it would be the wrong day to do
it: the cost it removes is ~220 KB on the worst canvas anybody has, and it
would cost the isomorphism. The web folds its queued ops over the confirmed
state through the same reducer the daemon runs, and `setCurrentVersion`
validates against a stack the client would no longer hold — so it needs
either a second reducer that trusts the client, or a snapshot with two
shapes. Pruning bounds the same number without either. If a canvas ever
wants a deep stack AND a small snapshot, that is the design to write, and
this note is where its numbers are.
