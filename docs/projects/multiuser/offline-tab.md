# The offline tab

The debt this discharges is the [journey](journey.md)'s rule 6,
which [phases.md](phases.md) turns into phase 10: *"People enter through
one origin, always … offline in the browser is the service worker's job —
cached shell, durable browser replica, queued ops — so per-viewer state has
exactly one home, and every replica (tab or daemon) reconnects with the same
seq-cursor gesture."*

Its sibling is [offline-birth](offline-birth.md), which owns the *daemon's*
offline story and the case where a canvas has no home yet. This doc owns the
case where the canvas has a home and the tab cannot reach it, and it borrows
that doc's vocabulary rather than inventing its own: a promise, an adoption,
a queue that starts at a cursor.

## A tab was already a replica; it lacked a disk

Nothing here is a new architecture, which is the point and also the reason it
is short. The web client has applied the shared reducer to a seq-numbered
stream since the first week; `HomeLink` does the same thing from a daemon.
Three things were missing and all three are storage or ordering, not
mechanism:

| a daemon replica has | a tab had | a tab has now |
| --- | --- | --- |
| a store on disk | memory | IndexedDB (`lib/replica.ts`) |
| `?since=<lastSeq>` from that store | `?since=<lastSeq>` from memory | the same, from the confirmed state |
| a loud refusal for writes it cannot forward | a thrown `fetch` | a queue (`lib/writequeue.ts`) |

The daemon refuses offline writes on purpose — `HomeUnreachableError` says so
in as many words, and says that the browser is where a queue belongs. This is
that queue, and the sentence in that error is now true rather than a promise.

## The split that makes it correct: confirmed, and the view over it

The store holds two states, and every hard question below is answered by
which one you are talking about.

- **confirmed** — what the home said, at `lastSeq` and not one op further.
- **the view** (`project`/`canvas`, what every component reads) — confirmed
  with the queue folded over it.

From that one split:

- The **cursor** describes the confirmed state, because a seq is a claim about
  what the home said. Presenting a cursor for an optimistic state would be
  claiming the home had seen work it has never heard of.
- The **tail** on reconnect is applied to the confirmed state, never to the
  view, and the queue is re-folded afterwards. Folding a tail onto a guess
  embeds the guess into what the tab then calls history, and the two replicas
  disagree forever with neither able to tell.
- **Persistence** writes confirmed, never the view. A replica that persisted
  its optimistic canvas as truth has quietly forked.

## Rebase, not skip

On reconnect the queue is flushed and then the tail comes down — and the tail
CONTAINS the flushed ops, because they are now history. The tempting
optimization is to skip them: we applied them already. It is wrong, and the
counterexample is one sentence long.

> Offline you move a card to (10,10). Meanwhile Bob moves it to (50,50), and
> the home orders his op at seq 12 and yours at 13. Skip 13 as "already
> applied" and the card ends at Bob's position while the home says yours.

So the whole tail is folded onto the confirmed state, and the view is rebuilt
from it. This is the journey's rule 2 holding at the tab: *no peer-merge
machinery* — the home orders, the replica replays.

A write therefore **retires when the cursor reaches it, not when it is sent**.
The POST's answer sets its seq; it leaves the queue when `lastSeq >= seq`,
which is the moment the same op arrives as confirmed history. Retiring on the
answer would rewind the item for the few frames until the tail caught up.

## The crux: what happens to an op that was sent but whose answer never came

This is the question the codebase did not answer, and it is not optional: a
queue that retries is **at-least-once** against a server that assumed
**exactly-once**.

### What the failure actually is — measured, not assumed

The obvious fear is a second item. It turns out the op vocabulary already
forbids one, and has since long before this phase:

- every op that CREATES carries a **client-minted id** — `item.add`'s
  `itemId`, `thread.create`'s `threadId`, `thread.reply`'s `comment.id`,
  `item.addVersion`'s version id — and the reducer refuses the second with
  `duplicate-id`;
- everything else is either **absolute-valued** (`item.move`, `item.resize`,
  `item.update`, `project.update`) and so idempotent by shape, or **refuses on
  the second pass** (`item.delete` → `unknown-item`, `item.restore` →
  `not-in-trash`).

So the damage is one layer along, and worse for being quiet: **a replay comes
back as a refusal**. And a client doing the honest thing with a refusal — roll
the optimistic change back, tell the person their work was rejected — would be
lying about an item that is sitting in the canvas. The duplicate was never the
risk; the *false refusal* was.

### The decision: a client-minted idempotency key, which is the envelope id

`PostOpRequest.opId`. The client mints what the daemon used to mint, and the
engine, on the writer chain and before anything is applied or forwarded, looks
for an entry with that id in the canvas's live log. Found: hand back that
entry — same seq, same envelope, nothing appended. Not found: write it, under
that id, so the next retry can find it.

Three properties, each load-bearing:

- **The key IS the id.** Not a side table, not a header. The oplog already
  remembers envelope ids forever, so the ledger the dedupe reads is the one
  the canvas already keeps — nothing to keep in step, nothing to expire, and
  a replica that replicates the log replicates the answer.
- **`clientId` could not have done this.** It names a CLIENT, not an op, and a
  browser mints a fresh one on every page load — including the
  reload-while-offline this phase exists to survive.
- **The horizon is compaction, and it is a soft one.** An op whose entry has
  been compacted out of the live log is applied again — and what happens then
  is exactly what happened before phase 10, which the section above shows is
  already safe. Past the horizon a replay degrades from "here is your entry"
  to "that was refused". Never to a duplicate item.

What was considered and rejected: **refusing to queue the ops that do not
tolerate duplication.** It sounds conservative and is the opposite — the ops
it would refuse to queue (`item.add`, `thread.create`, `thread.reply`) are
precisely the ones a person offline is most likely to make, and a queue that
holds moves but drops the comment you wrote on the plane is worse than no
queue, because it looks like it worked.

## The two honesty problems

### A queued op the home refuses

Offline it was applied optimistically. On reconnect the home says no — not
admitted, name taken, a main thread that now exists, a fenced writer.

**Rolled back AND said out loud.** The change leaves the view (the canvas now
matches the home, which is the only state anybody else can see) and the
refusal survives as a notice carrying the op's type and the home's own words,
until a person dismisses it. Silent rollback is a lie about work somebody
watched happen; leaving it on screen with a stuck queue is worse, because then
the tab and the home disagree about a canvas and only one of them is right.

**A refusal does not stop the queue.** Each write is submitted on its own; the
refused one drops out and the rest go up. A queue that halted at the first
refusal would strand later work behind a decision that had nothing to do with
it.

### Undo, offline

**Refused, legibly.** Undo here is not "reverse the last thing I did in this
tab" — it is an actor-scoped walk of a stack the home rebuilds from the oplog,
applying stored inverses computed against the state each op was applied to,
repairing or skipping the ones another actor's work has invalidated. A tab
holds a canvas, not a stack.

The engine already refuses to have a second opinion about this on a *daemon*
replica, in as many words: *"a replica whose live log was re-snapshotted holds
no entries to walk. Choosing what to undo here and forwarding the resulting op
would be a second opinion about a stack that has one owner."* A tab is a
thinner replica than that daemon and the sentence applies harder.

Queueing the undo REQUEST was the other candidate and is worse than refusing:
the button does nothing now and something surprising in ten minutes, against a
stack that has moved. So `⌘Z` offline produces a sentence — which is the whole
requirement, because `⌘Z` on a plane is a reasonable thing to try and an
unreasonable thing to be met with silence by.

## Scope cut: blobs

**Adding a file offline is deferred, and fails loudly.**

Queueing a file means queueing BYTES, not an op: a second durable store with
its own quota, its own eviction story, and its own answer to what happens when
the browser reclaims it before the network returns. And the op that would ride
on top names a `blobHash` that exists nowhere yet, so the queue would hold an
`item.add` pointing at nothing — a canvas that renders here and cannot render
for anybody else until the upload either succeeds or is quietly forgotten.
Content-addressed staging, upload-then-op ordering, and a GC that knows about
un-landed bytes are a design, not a phase-10 detail.

What could not be deferred with it is saying so. A drop that silently does
nothing is the exact failure this phase is about, so the refusal names the
file, gives the reason, and states the remedy.

## The shell

`packages/web/public/sw.js`, hand-written, no dependency. The argument for a
plugin is a precomputed precache manifest — offline on a page never loaded
online — and every reachable route in this app requires a canvas this browser
has already synced, so a precached shell would open onto nothing. Runtime
caching gets the same result one page load later, with no build step and no
dependency, in a repo whose root `package.json` explains at length why a
dependency is never just a dependency (#47).

**What is never cached: `/api/*`, first line of the policy.** The blob route
is credentialed as of phase 9 (`Cache-Control: private`), and a service worker
cache is a per-ORIGIN store shared by every tab and persona in the profile — a
blob cached there would be served to a later request the door would have
refused, with the caching layer never asking. That is the back gate phase 9
spent a stage closing, and an optimization is exactly how it would be
reopened. `test/shell.test.ts` drives the shipped file and asserts it.

Navigations are network-first (a deploy must be picked up on the next load,
and `lib/appversion.ts` compares the running bundle against the served one —
cache-first would have it compare a cached page against itself forever);
hashed assets are cache-first, because the filename changes when the bytes do.

One consequence, stated rather than discovered: a page served from the cache
arrives with no `Set-Cookie`, because the daemon badges a browser on the page
load. The badge cookie is durable and survives reloads, and the recovery
already exists — a 401 goes to the door and the request replays — so a cold
cached load with no badge costs one 401 and a door call, which is precisely
what that path was built for.

## Open

- **Blobs** (above), which is the only piece of "work offline" that does not
  work.
- **A queue that outlives its canvas.** Today the queue lives beside one
  canvas's confirmed state, so an op for a canvas this tab does not have open
  is refused rather than queued. Two open tabs on two canvases each keep their
  own; a single tab that navigates away mid-flush keeps the replica but stops
  flushing until it comes back.
- **Eviction.** IndexedDB is best-effort storage and a browser may reclaim it.
  Nothing here asks for `navigator.storage.persist()`, because a permission
  prompt on first canvas load is a worse first impression than the failure it
  prevents — and the failure is bounded: what is lost is a cache of something
  the home still holds, plus any queued ops, which is why the queue is written
  synchronously on every change rather than on a debounce.
