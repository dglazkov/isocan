---
status: partial
since: 2026-09-13
issue: 147
see: switcher, roles, multiuser
note: CLI routing and private seen-marks already exist; finish the home panel and slow in-app notification with authoritative cross-home reads. Polls never write seen-marks
---

# Inbox — one answer across homes

The [original inbox design](../../research/2026-08-29-the-inbox.md) owns
the routing argument; [seen-marks](../../research/2026-09-12-seen-marks.md)
owns the private visit fact. This continuation discharges steps 3 and 4:
the home panel and notification while somebody is on another canvas.

## Read the home that owns the fact

A replica may retain a canvas after the home withdraws access. Its local
snapshot and marks therefore cannot supply a current inbox answer. Add one
shared `GET /api/inbox` assembly, reached through typed routes by both CLI
and web. It uses core `inboxOn` and `newSince`, never another definition of
who a comment addresses.

The request names the actor, optionally one known canvas and an addressable
label. The actor must belong to the presenting badge through the existing
actor and join checks. A default request starts with discoverable canvases;
an explicit canvas is a known-address read through the ordinary door.

The response carries entries, authoritative seen-marks, canvas home URLs
and per-canvas unavailability. Local canvases use the local door and desk.
Remote canvases forward through their `HomeConnection` using the existing
`HomeLink.ensureClaim` and credential-bearing API path; the authoritative
home checks admission, takedown and actor standing. A remote failure is an
unavailable row, never a successful empty result or a stale local answer.
Four reads may run concurrently. Cancellation and upstream deadlines bound
the work, including a home that does not answer.

## Looking is not visiting

The home panel and a small in-app Inbox control share a visibility-aware
30-second poll. A route change, identity change or teardown cannot let an
old response overwrite the current person's answer. Polling writes no mark.
An inbox row opens its canvas at its own home and selects its thread; the
ordinary visit path owns the seen write. No browser push permission,
notification socket or separate notification store is needed.

## Navigation everywhere

The switcher's existing palette state moves to one lazy authenticated
navigation host inside the router, so home, lens and canvas use one keyboard
binding and one dialog. Off-canvas commands only offer acts meaningful
there. Empty search leads with Recent, then the remaining canvases under
space headings. Search ranking and archive behavior stay the shared ones.

## Proof

Use two synthetic homes and separate identities. The actual CLI and browser
must agree about addressed entries and unread counts. A remote link must
navigate to its home and select the thread. A background poll must leave
seen-marks unchanged; visiting must advance the ordinary mark. Withdraw
remote access and stop a home: show unavailability while the other canvas
still answers. A badge cannot ask for somebody else's actor or marks.

Drive the switcher from home, lens and canvas, use keyboard filtering and
Enter, and inspect Recent and space headings without duplicate rows. Repeat
after an identity change. Run the full suite and typecheck.
