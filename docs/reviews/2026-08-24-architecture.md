# Architecture review — 2026-08-24

Second run. The [first](2026-08-23-architecture.md) is the baseline; this one
opens by re-checking every finding it left, **verified rather than remembered**
— I re-ran the greps, re-ran the suite, and where a claim was about behaviour I
reproduced it against a live daemon and pasted what came back.

**Scope note.** [`docs/phases.md`](../phases.md) is an active build by another
session and it moved *under this review* — the tip went from `0690db8` to
`331f8b0` mid-run, phase 9 closed and phase 10 (offline in the browser) opened,
and three test files appeared between my first and second suite runs. Anything
phases.md declares is treated as **in-flight, not drift**. Two of the standing
findings below were fixed by that session while I was measuring them, which is
the memory working.

Measured at `331f8b0`: `npm test` — **1032 passed, 55 skipped, 105 files, 35s**
wall. Five runs: **four green, one red** (8 tests across 3 files), and the red
one is the interesting measurement — it took **68.8s**, nearly double, because
another session was writing into the repo while it ran. Re-run immediately:
green. See standing finding 4. `npm run typecheck` — five workspaces, clean. `@isocan/core` still has exactly
one dependency (`nanoid`); no workspace grew one.

---

## Standing findings, re-checked

| # | Last run's finding | Now |
| --- | --- | --- |
| 1 | `surface.test.ts` matches substrings, so English-word verbs pass vacuously | **Still true, and it had already cost something — closed in this run** |
| 2 | Nothing watches the web surface's op set | **Still true.** Verified by hand again: web 20 ops, CLI 23, web ⊂ CLI |
| 3a | Three `formatBytes`, two behaviours | **Still true**, unchanged |
| 3b | `defaultSize` in `mime.ts` and inlined in `upload.ts` | **Still true** |
| 3c | Three mime tables in two directions | **Still true** |
| 4 | `npm test` fails ~1 test per run and gates the release | **Fixed for that test**, better-diagnosed than I proposed — but the class reproduced here under load |
| 5 | The npm package ships ~1.1 MiB nothing reads | **Worse** — now 1.56 MiB, package 5.0 MB / 388 files |
| 6 | `cloud-desk.ts` claims one badge writer; there are four | **Still true** |
| 7 | `MAX_DIRECT_UPLOAD_BYTES` written in the present tense, unused | **Still true** |
| D1–D4 | Four README drift rows | **All four still true** |

### 1 — still true, and this run closed it

The guard was unchanged at `packages/cli/test/surface.test.ts:49`:

```ts
const missing = commands.filter((name) => !PLUMBING.has(name) && !guide.includes(name));
```

Last run I could only prove the hole with `session move`. This run the hole had
**caught something new**. Running the strict check I proposed against the
current guide:

```
MISSING under backtick-token match: empty, fit, move
MISSING under substring match:      (none)
```

Three registered verbs, none named in the guide, build green:

- `fit <items...>` — `packages/cli/src/main.ts:2743`. Shipped in
  `b319947` ("Shift F grows an item to what is in it"), a *new feature of this
  week*, on both surfaces, and agents were never told the verb exists. It
  passed because the word "fit" appears in prose.
- `session move <x> <y>` — `main.ts:3732`. The one I found last time. Still
  undocumented ten days later, which is the argument for a test rather than a
  third mention.
- `trash empty` — `main.ts:4436`. Not undoable, `--force`-gated, unnamed.

**Closed.** `surface.test.ts` now derives the documented set from inline code
spans — the way this guide names a command everywhere it means one
(`` `isocan star <item>` ``, `` `comment main <thread>` ``, and the quick
reference's alternations `` `session start|on|work|say|point|end` ``) — instead
of from `String.includes`. Flags and placeholders (`--dry-run`, `<item>`,
`[--css]`) are rejected, so there is no new way to pass vacuously. A second
test freezes the regression itself: a sentence containing "move", "get", "star"
and "end" must yield the empty set.

It went red on exactly the three above; the guide's quick reference now names
them, and the file is green. `agent-help.test.ts` and `skills.test.ts` still
pass. **This is the only code I changed** — a test and the documentation that
test demands. Everything else in this review is a proposal.

One limit, recorded in the test rather than hidden: the check is flat, because
`registeredCommands()` reads `.command("x")` without knowing which sub-program
the call hangs off. `session move` documented as `mv move` would still pass.
Carrying parents through the parse is a bigger change than the hole it shuts.

### 4 — fixed, and the reasoning beat mine

`3c7825e`, "The flake, named at last — by CI, which is slower than this
machine." My last review guessed load in the daemon-spawning suites and said
"not a longer timeout — that hides it." A longer timeout is what landed, and
the commit's argument for why is better than my objection:
`session-identity.test.ts`'s "presence beats never cross" makes **eight real
CLI spawns** against vitest's default 5s, its assertions are about roster state
and never about time, so the deadline was never carrying signal. Phase 10
tipped it over by adding three more files for the workers to run in parallel —
which is exactly the load hypothesis, confirmed from the other end.

That specific flake is closed. **The shape it came from is not**, and this run
measured it again by accident. Five full runs here: four green (1032/1032, ~35s)
and one red — 8 tests across 3 files — during the one run that took **68.8s**
because a concurrent session was writing into the repo. Re-running immediately
was green. That is the same signature as last review's finding: load, not logic,
in the suites that spawn real daemons in parallel workers.

So the fix was right about *that* test and the class stays open. Every such test
is one scheduling delay from red, each will be found the same way — one CI
failure at a time, and this time one contended local run — and the habit it
teaches is "run it again", which is the habit that hides the next real failure.
The number worth having before deciding whether that is acceptable is one
`gh run list` away: how often CI is red for this reason. Naming a deadline per
test is a fix that has to be repeated; constraining the parallelism of the
daemon-spawning suites is a fix that does not.

### 5 — worse

`npm pack --dry-run --ignore-scripts`, broken down by top-level directory:

| dir | size | files | read at runtime? |
| --- | --- | --- | --- |
| `packages` | 3,289 KB | 297 | yes |
| `docs` | **1,315 KB** | 35 | no |
| `infra` | 145 KB | 21 | no |
| `test` | 80 KB | 11 | no |
| `scratch` | 16 KB | 1 | no |

**388 files, 5.0 MB unpacked** (was 378 / 4.8 MB). `docs/` alone grew from
1,033 KB to 1,315 KB in ten days — it is the fastest-growing thing in the
tarball and 26% of the install. `.npmignore` is unchanged and still excludes
only `marketing`. This will keep getting worse on its own, because the repo
documents itself well; that is the point of decision 2 below.

### 2, 3, 6, 7, D1–D4 — unchanged

- **2.** No test in the repo opens `packages/web/src` except `packaging.test.ts`
  (which checks the built bundle). Re-measured the invariant by hand: web
  issues 20 distinct op types, all 20 appear in `packages/cli/src`; CLI-only are
  `comment.update`, `items.restore`, `thread.setAnchor`. Web-only: none. **The
  isomorphism still holds** — and still by the people, not by the build.
- **3a.** `packages/cli/src/output.ts:31` (`formatBytes`),
  `packages/web/src/components/TrashPanel.tsx:7` (`formatBytes`),
  `packages/web/src/components/FilesPanel.tsx:51` (`formatSize`, and still the
  odd one out). A 5,200-byte file is **5.1 KB** in `isocan ls` and the trash
  panel, **5 KB** in the files panel.
- **6.** `packages/cloudstore/src/cloud-desk.ts:56` still says "nothing writes a
  badge except `writeBadge`". Badge-document writers today: `:91` (`writeBadge`),
  `:118` (the `lastSeen` merge, carved out), `:259`, `:394`. Still four, still
  all correct, still described wrongly.
- **7.** `MAX_DIRECT_UPLOAD_BYTES` at `packages/core/src/protocol.ts:285`,
  mentioned in `packages/server/src/http.ts:1428`, referenced by no client.
  `docs/architecture.md:394` still present tense; `:486` still correct.
- **D1.** `README.md:308` still carries the "On call" bullet the same list later
  retires. **D2.** `cloudstore` appears in the README **zero times**.
  **D3.** `isocan get`, `isocan browse`, `isocan distribute` and now `isocan fit`
  appear in the README zero times. **D4.** `README.md:431` still describes core
  as "state model, operation vocabulary, pure reducer, inverse engine, placement
  math" — a description that has been wrong for months and is now, ironically,
  the only doc that mentions placement at all.

---

## New findings, worst first

### N1. The reducer decides where an item lands, and nobody who asks is told

This is the structural consequence of moving placement into the reducer, and it
is currently a wrong answer handed to agents. Reproduced live against a daemon
on a scratch home, three `add`s all requesting the same spot:

```
$ isocan add a.md --at 0,0 --json   →  { "itemId": "itm_p3CxWJd84S", "placement": { "x": 0, "y": 0 } }
$ isocan add b.md --at 0,0 --json   →  { "itemId": "itm_ub4kFCVYJd", "placement": { "x": 0, "y": 0 } }
$ isocan ls --json
itm_p3CxWJd84S  0    0    a.md
itm_ub4kFCVYJd  460  0    b.md
```

`b.md` is at **460,0** and the CLI reported **0,0**. `--json` — the surface an
agent parses to decide where to put the next thing — is wrong by 460px.

The mechanism, and why it is a boundary question rather than a printf bug:

- `packages/server/src/engine.ts:1529-1535` normalizes `placement` **only** for
  the anchored form, and calls `resolvePlacement(state, op.placement, op.width)`
  with `height` defaulting to `0`.
- `packages/core/src/placement.ts:121` early-returns on `height <= 0`. So the
  engine's normalization resolves the anchor and deliberately does **not**
  settle. For the `{x, y}` form it does not rewrite the op at all.
- `packages/core/src/reducer.ts:100` then does the real search, with the real
  height, at apply time.
- `packages/cli/src/main.ts:2473` and `:2526` read
  `result.envelope.op.placement` and print it as where the item went. It is the
  request.

The engine comment at `:1527` states the principle exactly right — *"Normalize
placement so the logged op never references ephemeral client selection state"* —
and then stops one step short. The collision search's input is the **entire item
set at that instant**, which is more ephemeral than a selection, not less.

Three costs, in order:

1. **The reported answer is wrong** (above), on both `add` and `browse`.
2. **`nearestFreeSpot` is now frozen into replay semantics.** The oplog records
   the request, so rebuilding a canvas from its log re-runs the search. Change
   the lattice, the clearance, the ring order or the tie-break and every
   historical canvas silently relays. Nothing says so; `PLACEMENT_GAP` and
   `PLACEMENT_CLEARANCE` read like tunable constants and are not.
3. **`item.add` stopped being absolute-valued, and `docs/architecture.md:263`
   still says it is** — *"the rest are absolute-valued or refuse on the second
   pass"*, written for the idempotency key in phase 10. `item.add` is now the
   first op whose result depends on items it never names. It is still
   duplicate-safe (client-minted id), so the key is fine; the sentence is not.

**Fix.** Normalize fully in the engine: pass `op.width`, `op.height` and the
same `meansIt` predicate the reducer derives, so the logged op carries the
**final** coordinates. This is idempotent by construction — the reducer then
re-resolves a placement that is already free against the same state and returns
it unchanged — so the replica, replay and the log all agree, and the CLI's
`placed` becomes true without touching the CLI. Then move the `meansIt`
predicate into `placement.ts` beside the `exact` parameter it feeds, so there is
one definition rather than two call sites that must stay in step.

### N2. `fit` is one gesture and N+1 undo steps, on both surfaces

`packages/cli/src/main.ts:2774-2778` and `packages/web/src/lib/fititem.ts:39-49`
both do the same thing with `fitMoves`'s result: send one `item.resize` **per
item**, then one `items.move` for the lot.

```ts
for (const r of resizes) await sendOp(..., { type: "item.resize", ... });
if (moves.length > 0) await sendOp(..., { type: "items.move", moves });
```

`packages/server/src/undo.ts:61` pushes one seq per log entry, so ⇧F on six
items is **seven** undo steps and ⌘Z undoes one resize. The web comment at
`fititem.ts:45` names the rule it is following — *"One op for the lot, so
settling the group is one undo step rather than six — the same bargain
`items.delete` already makes"* — and it is only true of the half it is written
above.

The vocabulary has `items.move`, `items.delete`, `items.restore` and no
`items.resize`, and `ops.ts:171-172` says why those exist: *"Batch variants
exist so a multi-select gesture is ONE op and therefore ONE undo step. They add
no new capability over their singular forms."* `fit` is precisely that gesture.

Note the good part first: **both surfaces are wrong identically**, because both
call the same `fitMoves`. The isomorphism did its job; only the last mile
differs, and it doesn't.

**Fix, and there are two shapes.** The cheap one is `items.resize` — consistent
with three siblings, no new concept, and it makes ⇧F two undo steps instead of
seven. The honest one is decision 3 below: the vocabulary is now growing a
batch variant per gesture, and a general grouping concept would stop that. Do
not do both.

### N3. The map does not draw the reducer's new spatial search

`docs/architecture.md:6-11` sets a hard contract:

> It is a **living doc with a specific contract**: the whole system is mapped
> here now, and the map changes only when reality produces something we didn't
> see coming — never because a region was left blank to fill in later.

`grep -c "placement.ts\|fit.ts\|blobtext" docs/architecture.md` → **0**. Zero
mentions of `nearestFreeSpot`, `fitMoves`, `PLACEMENT_CLEARANCE`, or the fact
that applying `item.add` reads every item on the canvas. This is not the
in-flight carve-out: phases.md declares work *not yet built*, and this is built,
shipped, and load-bearing on replay.

It is the smallest of the three findings and the one most likely to compound,
because the map's value is entirely that it is complete.

**Fix.** One paragraph under the reducer, saying: `item.add` resolves its
position against the whole canvas; the search is deterministic and therefore
part of replay; `exact` is the escape for positions that carry meaning. Then
N1's fix is a sentence in the same paragraph rather than an archaeology problem.

---

## The three new modules

Asked for specifically, and worth separating from the findings: two of these
are among the better structural work in the repo.

### `packages/core/src/fit.ts` — correct, and the model for the rest

`fitMoves` (`:34`) is exactly what invariant 4 asks for: one pure function in
core, imported by `packages/cli/src/main.ts:26` and
`packages/web/src/lib/fititem.ts:2`, with the browser-only half (measuring a
page) left on the browser side and nothing else duplicated. `ORDER IS THE
DESIGN` in the doc comment states the property a reader would otherwise have to
reverse-engineer, and `:55-58` records the bug an earlier version had —
exempting the first item let it grow over a bystander — beside the line that
prevents it. `packages/core/test/fit.test.ts` covers the ghost-item case, the
group case and the bystander case. The only thing wrong with `fit` is what
happens to its result (N2).

### `packages/core/src/placement.ts` — deterministic and replay-safe, with one seam

Checked as asked.

**Deterministic: yes.** `nearestFreeSpot` reads `occupied` only through
`.some()` and one `Math.max`, both order-independent, so `Object.values`
insertion order cannot change the answer. `canvas.trash` is a separate array, so
a new item is never pushed off a spot by something invisible — I looked for that
specifically. The ring walk enumerates in a fixed order and sorts by squared
distance then by an eight-way reading-order rank. One nit: that comparator is
not a *total* order — `(2,1)` and `(1,2)` tie on both keys and fall through to
sort stability. Stable sort is specified, so the result is deterministic; it is
deterministic by a property nobody wrote down. Half a line of comment, or add
`dx - dy` as a final key.

**Replay-safe: yes, and that is the problem.** It is safe *because* the reducer
is pure and the WS gap check (`canvasStore.ts:304`) means the replica applies
each op against the identical state the daemon did. `applyLocalEcho`
(`canvasStore.ts:142`) is explicitly scoped to absolute-valued move/resize
commits, so `item.add` is never applied optimistically — which is what keeps
this correct today, and which nothing in `placement.ts` says it depends on. The
consequence is N1: the search is now part of the log's meaning.

**The `exact` escape is sound, and it is sound for a specific reason worth
keeping.** `reducer.ts:98-99` *derives* it from the op's content —
`op.version.mimeType === DRAWING_MIME || op.properties?.[ANNOTATES_PROP]` —
rather than accepting it as a field. So no client can ask to skip the tidy, the
two surfaces cannot disagree about when it applies, and it needs no place in the
vocabulary. That is convention-carrying properties doing exactly the work
AGENTS.md item 3 claims for them. Two things to watch: it is one of only two
places the reducer reads a convention property, so `annotates` is now
load-bearing in the reducer as well as in the readers; and the predicate lives
in the reducer while the parameter lives in `placement.ts`, which is the seam
N1's fix should close.

### `packages/web/src/lib/blobtext.ts` — right size, right place, right reason

An extraction that avoided a cycle rather than one that chased a line count:
`ItemView.tsx`, `DesignSystemView.tsx` and `lib/measure.ts` all read blob text
now, and the alternative was importing from the component that renders it. The
comment on `fetchBlobText` earns its place — only a 2xx is cached, because the
404 body is the daemon's JSON error and caching *that* is how `{"error":"blob
not found"}` gets rendered as the document and then remembered for the session.
That is a bug someone had, written down where it cannot recur. Correctly **not**
in core: it is `fetch` plus a module-scoped `Map`, browser-shaped all the way
down.

---

## The two proposals

### `docs/design/convergence.md` — right problem, right to be an op, wrong shape

**The gap is real** and the doc's case for it is the strongest part: divergence
is served (`/variation` writes children carrying `parent`), vertical convergence
is served (`item.setCurrentVersion` + `version promote`), and there is no
horizontal convergence at all, so today the winner is copied by hand — outside
the log, outside undo, invisible to everyone. Two independent lines of work
reaching it on the same day is good evidence.

**"Op, not property" is correctly argued.** A property records an opinion and
cannot move bytes; `isocan get` and every future reader would receive the loser.
That is the right test and it passes.

**The proposed shape does not survive contact with the reducer.** Three
problems, in order of severity:

1. **It cannot be applied purely.** Step 1 says each child "contributes its
   current blob as a new version of the parent." Every other version in this
   system carries a **client-minted id** — `NewVersion.id` at `ops.ts:13-19`,
   and `item.restoreVersion` carries a whole `ItemVersion` specifically so
   authorship survives undo→redo. `item.adopt` as written gives the reducer no
   ids, so the reducer must mint them. `packages/core/src/reducer.ts` imports no
   id generator and must not: a reducer that mints is not a pure function of
   `(state, envelope)`, the replica and the daemon would produce different
   version ids for the same op, and replaying the log would produce a third set.
   This is the same class of bug as N1, one size larger.

2. **"The inverse is the expensive half" understates it, and the doc's evidence
   for optimism is wrong.** `invertOperation` at
   `packages/core/src/invert.ts:13-16` returns **`Operation | null`** — one op,
   never a list, computed before apply and stored in the `LogEntry`. So the
   proposal's reassurance — *"two internal operations already exist for the
   first half … a good sign the seam was left open on purpose"* — does not hold:
   `item.removeVersion` removes **one** version and `items.restore` restores
   items, and there is no way to return both. Adopting needs a **new internal
   op** (`item.unadopt`, carrying the removed version ids, the previous
   `currentVersionId`, and the retired child ids). The vocabulary grows by two,
   not one. That is still defensible — `INTERNAL_OP_TYPES` at `ops.ts:248`
   exists for exactly this and `engine.ts` refuses any member whose `cause` is
   undefined — but it should be priced in, and the doc's atomicity requirement
   ("the inverse is atomic or the op does not ship") is *only* satisfiable that
   way.

3. **The thread post makes it a third effect in a different family.** "Adopting
   posts the decision to the parent's thread" means the op also mints a comment
   id (and possibly a thread id), and the inverse must remove the comment too.
   The instinct is right — the changelog rule about roads not taken is the best
   argument in the document — but it belongs to the **verb**, not the op:
   `isocan choose` sends `item.adopt` then `thread.reply`, the note is an
   ordinary comment anybody can edit or reply to, and adopt stays one family.

**The shape I would counter-propose:**

```ts
| { type: "item.adopt"; itemId: string; chosenId: string;
    contributions: Array<{ childId: string; versionId: string }> }
```

The client enumerates the children and mints one version id each; the reducer
**validates that `contributions` names exactly the current children of `itemId`
and refuses otherwise**. That keeps the reducer pure, makes the inverse fully
computable from `(stateBefore, op)`, makes a stale client lose the race loudly
rather than silently adopting a set it could not see, and answers the doc's
"Order" question by construction — the order is in the op, so it is a history
rather than something the reader derives. Everything else derivable (blobHash,
mimeType, filename, size) stays derived.

Also worth writing down: `item.adopt` would make the `parent` property
load-bearing in the **reducer**, joining `annotates`. That is a real widening of
what a convention-carrying property costs, and it is the second one this month.

**On the doc's own note** — *"the architecture review found that check is a
substring match, so it may pass vacuously. Fix that first or this lands
undocumented and green."* That is now done; `isocan choose` will fail the build
until the guide names it.

### `docs/design/content-origin.md` — accept the reasoning; it is a boundary, not a feature

I verified every load-bearing fact and they all hold.
`packages/web/src/components/ItemView.tsx:663` is
`sandbox="allow-scripts"` on a same-origin `src`; `:712` is
`sandbox="allow-scripts allow-same-origin allow-forms"` on the mini-browser,
pointed at somebody else's origin, which is the correct contrast the doc draws.
`blobUrl` is same-origin (`packages/web/src/lib/api.ts:514`), and phase 9 made the
blob route credentialed.

**The framing is the valuable part and it is correct.** "The isolation is a
flag, not a structure" is the whole argument: a one-attribute control sitting
next to a standing reason to relax it (interactive items want storage) is a
control that gets relaxed by someone who does not know all three facts. This is
the same argument the repo already accepted for `store.ts`/`desk.ts` having no
runtime import — make the property a grep, not a promise — applied to an origin.

Two structural notes:

- **Split the phases, and say so in the doc.** The local half (a second
  listener; `127.0.0.1:4442` is a different origin from `:4441` for every
  purpose here) is small, testable, and useful on its own. The hosted half is a
  registrable-domain decision that belongs with `isocan.io` and phase 14. The
  doc half-says this under "Open"; it should be the proposal's structure.
- **The cost the doc lists third is the one that will bite.** *"Blob addressing
  has to stand alone … a content origin must not be able to answer questions
  about projects."* Today `blobUrl` is
  `/api/projects/:id/blobs/:hash` — project-scoped by construction. A content
  origin has to serve `/{hash}` or it has become a second API with no door on
  it, and that changes the addressing scheme, `Store.listBlobs`'s relationship
  to reachability, and the phase-9 `Cache-Control: private` reasoning. Not a
  blocker; the thing to design first, before the listener.

There is also a **seam.test.ts-shaped guard** waiting here, and it should land
with the local half: assert that no `.tsx` in `packages/web/src` puts
`allow-same-origin` on an iframe whose `src` is a `blobUrl(...)`. Source-reading,
no runtime, and it turns "never loosen this one attribute" from a comment into a
build failure — which is this repo's best habit and exactly what the doc says
it wants.

---

## Drift table

| # | Doc says | Code does | Wrong side |
| --- | --- | --- | --- |
| D1 | `README.md:308` — "On call": a parked agent wears a dashed ring in **every** canvas's facepile | `packages/server/src/presence.ts:10-12` retired home-wide presence with #60, and the README says so 50 lines later | **Doc.** Unchanged from last run |
| D2 | `README.md` — four packages | Five workspaces; `cloudstore` appears in the README **0 times** | **Doc.** Unchanged |
| D3 | `README.md` CLI surface block | `get`, `browse`, `distribute` and now `fit` appear 0 times | **Doc.** Unchanged, and now one worse |
| D4 | `README.md:431` — core is "…pure reducer, inverse engine, placement math" | Core also holds the design-token system, a YAML subset, a slash-command registry, contrast math, `fit.ts`, and a skill resolver | **Doc.** Unchanged |
| D5 | `cloud-desk.ts:56` — "nothing writes a badge except `writeBadge`" | Four writers (`:91`, `:118`, `:259`, `:394`), all correct | **Doc** (the comment). Unchanged |
| D6 | `docs/architecture.md:394` — `MAX_DIRECT_UPLOAD_BYTES` "is the one number both clients branch on" | Neither branches; `:486` says so correctly | **Doc** (tense). Unchanged |
| **D7** | `docs/architecture.md:6-11` — "the whole system is mapped here now" | `placement.ts`, `fit.ts` and the reducer's spatial search: 0 mentions (N3) | **Doc** |
| **D8** | `docs/architecture.md:263` — "the rest are absolute-valued or refuse on the second pass" | `item.add`'s result now depends on every item on the canvas (N1) | **Doc.** Still duplicate-safe; the sentence is what is stale |
| **D9** | `packages/web/src/lib/fititem.ts:44-45` — "One op for the lot, so settling the group is one undo step rather than six" | True of the moves, false of the N resizes above it (N2) | **Code.** The comment states the rule the code should follow |

D9 is the first row in two runs where the **code** is the wrong side. Worth
noting on its own: for two reviews running, every disagreement between this
repo's documents and its code has been the document falling behind, not a rule
being broken. That is an unusual ratio and it says something good.

---

## What is good, specifically

**The memory worked, and it is not a small thing.** Two of last run's seven
findings were closed by another session between the runs, and one of them
(`3c7825e`) was closed with a *better* diagnosis than the review proposed, then
written up with the wrong turn preserved — "Phase 8 recorded a failing run whose
output was never captured." This is the review index's stated theory —
"a finding that keeps reappearing across runs is a finding that needs a test,
not a third mention" — behaving as designed on its first real test.

**`fit.ts` is the duplication finding not happening.** Last run's finding 3 was
three computations that should have been in core. `fit` arrived a week later and
went into core on the first try, with both surfaces importing it and only the
browser-only measurement left on the browser side. Whatever else is true, the
lesson landed.

**The `exact` escape is derived, not declared.** `reducer.ts:98` works out
whether a position means something from the op's own content rather than
trusting a flag. That is one fewer thing in the vocabulary, one fewer thing a
client can get wrong, and one fewer way the two surfaces can disagree — the
whole argument for convention-carrying properties, made in three lines.

**`placement.ts` documents the bug it fixed and the rule it chose.**
*"Deliberately a REQUEST, not an instruction"*, *"with ties broken in reading
order … because a canvas is read like a page"*, and `fit.ts:55-58` recording the
first-item exemption that let an item grow over a bystander. `placement.test.ts`
opens by naming the reported bug — six files, one pile. These files can be
re-derived rather than re-argued, which is the same standard `daemon.ts:92-119`
set for the cloudstore boundary.

**`applyLocalEcho` is scoped by a written argument, not by habit.**
`canvasStore.ts:133-141` says out loud that optimistic application is only for
absolute-valued commits and that the echo owns `lastSeq`. That restraint is why
N1 is a reporting bug rather than a divergence bug — a replica that
optimistically applied `item.add` would have placed it somewhere the daemon did
not, with nothing to correct it.

**The boundaries have not moved.** Core still has one dependency. `cloudstore`
is still the only workspace that has heard of a vendor. `seam.test.ts` still
holds `store.ts` and `desk.ts` to zero runtime imports. Phase 9 and phase 10 —
attesters, revocation, an offline queue with an idempotency key — landed without
core learning anything about any of them.

---

## Decisions for a human, not an agent

1. **Does the README get a forcing function, or get demoted?** Carried forward
   unchanged from last run, and one row worse (D3 gained `fit`). The asymmetry is
   now proven rather than argued: the guide had a weak test and drifted three
   verbs; the README has no test and has drifted four ways for two reviews. The
   guide's test is now strong. Either point the same machinery at the README's
   CLI block, or say the README is prose and `--agent-help` is the only surface
   with a contract. It is currently in between, which is where drift lives.

2. **Is the shipped tarball the repo, or the CLI?** Finding 5, and it is
   compounding on its own — `docs/` grew 280 KB in ten days and nothing reads
   it. The `.npmignore` edit is five lines; deciding which reading is right is
   not. Note the phase-14 angle that makes it less obvious than it looks: if a
   daemon ever serves this repo's own docs onto a canvas, "docs ship" becomes a
   decision made on purpose rather than a default nobody chose — which is the
   exact wording `.npmignore` already uses about `marketing/`.

3. **Batch variants, or a grouping concept?** N2 wants `items.resize`, which
   would be the fourth `items.*` op. `item.adopt` wants to be atomic across
   three effects in two families. Both are the same missing idea: the log has no
   way to say "these entries are one act." A `groupId` on `LogEntry` that
   `UndoStacks.record` treats as one unit would answer both, stop the vocabulary
   growing a plural per gesture, and let `item.adopt` be built from
   `item.addVersion` × N + `item.setCurrentVersion` + `items.delete` with no new
   op at all. It would also touch the one file both clients share while the
   multiuser build is mid-flight, and undo is the feature people notice when it
   changes. This is the largest structural question open in the repo and it
   should not be settled as a side effect of shipping `fit` or `choose`.

4. **Is CLI-ahead a rule or an accident?** Carried forward unchanged: web ⊂ CLI,
   three ops on the CLI side only, every stated rule points one way and nothing
   says the converse. Still true by the people writing the code rather than by
   decision — and finding 2 (nothing watches the web's op set) stays open until
   it is decided, because the guard's assertion depends on which direction is
   allowed.

---

*Next run: findings 2, 3a/3b/3c, 5, 6, 7 and D1–D9 are the standing set — say
"still true", "fixed", or "worse" rather than rediscovering them. Finding 1 is
closed with a test; if it reappears, the test was weakened. N1 is the one to
check first, because it is the only finding in this review that is currently
telling an agent something false.*
