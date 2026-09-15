# Identity writes that preserve the next agent command

The debt is a reproduced landing failure: replica setup succeeds but the next
CLI command loses custody because the daemon and CLI replace each other's
credential fields. Phase 7's landing encountered it in incoming release
`34976543716`, on `packages/cli/test/pass.test.ts`. A normal local run passed;
an actual two-daemon/CLI probe forced the stale-read schedule and reproduced the
same refusal. This correction protects shared local persistence; it does not
advance either frozen study runtime or establish a design-quality result.

## What the failure showed

Both processes use `packages/server/src/badge-store.ts`, but its queue is
process-local. The daemon reads the old identity before keeping its home badge;
the CLI reads the same file and writes its local badge; the daemon then replaces
that field with its stale view. Setup returns the adopted person successfully.
The next CLI finds no local credential, mints another badge and correctly fails
to speak for the person still held by the lost one.

Moving actor adoption into the daemon's queue fixed the earlier #284 schedule;
it did not serialize the daemon's home-badge write with the CLI's local-badge
write. Individual atomic renames cannot protect a read/merge/write transaction.
The forced clean probe is retained at
`/tmp/isocan-design-partner-execution/phase7-pass-race-proof-clean.log`; it
records badge IDs and outcomes, never credential secrets.

## One critical section for every shared-file writer

Keep read/merge/atomic replacement in the server package, where the physical
home and identity path already live. The in-process queue remains useful, but
every update also owns a process-shared lock for the physical home from before
the identity read through conditional choice and completed atomic replacement.
Resolve the existing home to its physical path, so aliases cannot obtain two
locks for one file. The lock covers local filesystem work only, never network
admission, user interaction or a model turn.

Atomic directory creation claims the lock. A private owner record contains a
unique nonce and process ID; release verifies ownership and cannot remove
another writer's lock. Wait only on actual contention, with a bounded deadline
and an actionable path in the refusal. Do not steal stale or incomplete locks:
PID reuse, partial owner writes and concurrent recovery make age alone unsafe.
An orphaned lock requires explicit inspection/recovery; timeout leaves identity
bytes untouched. A failed owner-record write must clean up only its own newly
claimed lock and must not start the identity update.

All shared-file writers participate:

- `writeBadge` merges one normalized address without dropping another badge,
  the person or private fields.
- `adoptIdentity` decides and writes the pass-returned person in the same
  critical section, preserving the existing different-person refusal.
- API `writeIdentity` delegates the human-name/new-identity update to that
  server mechanism. Choose an existing or new ID inside the lock and preserve
  credentials, unknown fields and existing permissions.

The separate voice identity file is not this store. Legacy project identity
files are read-only inputs. No operation vocabulary, credential format, door
custody rule or default identity is changed. Core remains filesystem-free;
CLI and browser-backed API paths use the same persistence implementation.

Only ENOENT means a fresh identity file. Malformed JSON, unsupported shapes and
other read errors must refuse instead of replacing unknown existing bytes with
an empty object. Preserve file mode; a newly created credential file stays
private. A failed update releases its own lock without rewriting the identity.

## Proof before landing

Use real processes and actual filesystem writes, with IPC barriers that expose
the relevant read/lock events. The old implementation must fail the forced
schedule; the corrected implementation must block the second read until the
first write completes, preserve both exact credentials and keep the next real
CLI command under the original actor. Verify setup, subsequent pass minting
and restart against actual owned daemons.

Also prove name/adoption/badge updates preserve unrelated fields and file mode,
corrupt or unreadable existing data is not overwritten, a foreign/unknown lock
cannot be stolen, and a failed mutation releases only its own lock. Keep existing
refusal and different-person assertions. Do not add sleeps, retries or larger
timeouts to make the existing test appear reliable.

The conductor independently repeats the scheduled walk and checks saved public
identities and actual command results. Full fast, typecheck, build and strict
Firestore/process checks follow on the combined tree, then exact-commit CI.
The measured-study provision, people and opt-in rollout gates remain unchanged.
