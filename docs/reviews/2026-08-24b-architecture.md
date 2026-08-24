# Architecture review — 2026-08-24 (run 3)

Third run, and the second one today — the [morning
run](2026-08-24-architecture.md) is the one this opens by re-checking, with the
[baseline](2026-08-23-architecture.md) behind it. Every standing finding was
re-measured rather than recalled: I re-ran the greps, re-ran the suite twice,
and where a claim was about behaviour I reproduced it against a live daemon and
pasted what came back.

**Scope note, and it matters more this run than last.** The working tree moved
under me continuously. `git status` at the start was two files
(`ItemView.tsx`, `styles.css`); by the end it was ten files plus four
untracked, including `AGENTS.md`, `README.md`, `lessons.md`, two new test files
and `docs/new-project.md`. One of my findings was **found and closed by that
session while I was writing it up** — recorded below rather than deleted,
because the shape it belongs to is still open. Anything `docs/phases.md`
declares (10.3 "one daemon, many homes" is next) is in-flight, not drift.

Measured at `2dc0090` plus the working tree:

- `npm test` — **1071 passed, 55 skipped, 112 files**, two runs, **both green**,
  57.6s and 58s wall.
- `npm run typecheck` — five workspaces, clean.
- `@isocan/core` — still exactly one dependency (`nanoid`), **zero** `node:`
  imports, zero imports from any other workspace. No workspace grew a
  dependency since 2026-08-20; the only manifest change in that window is the
  `cloudstore` workspace itself.
- `applyOperation` is exported once (`packages/core/src/reducer.ts:25`) and
  called from ten places: the engine (×4), both stores' replay, the web
  replica (×2) and the offline queue. Grepping for a write to
  `canvas.items[…]` outside the reducer returns **four hits, all reads**.
  Invariant 1 holds structurally.

---

## Standing findings, re-checked

| # | Last run's finding | Now |
| --- | --- | --- |
| N1 | `item.add`'s final position decided in the reducer, never logged | **Fixed** (`c088f61`), and fixed the way the review proposed — plus `positionIsMeaningful` moved into core |
| N2 | `fit` is one gesture and N+1 undo steps on both surfaces | **Still true**, unchanged, both surfaces |
| N3 | `architecture.md` maps neither `placement.ts` nor `fit.ts` | **Still true** — `grep -c` is still **0** |
| 1 | `surface.test.ts` matched substrings | **Closed and holding.** The strict guard is unchanged and green; the `documentedVerbs` regression case is still there |
| 2 | Nothing watches the web surface's op set | **Still true**, re-measured by hand: web **20** op types, CLI **23**, web ⊂ CLI, web-only **none** |
| 3a | Three byte formatters, two behaviours | **Still true**, byte-identical to last run |
| 3b | `defaultSize` in `mime.ts` and inlined in `upload.ts` | **Still true** |
| 3c | Three mime tables in two directions | **Worse — now measured as a real divergence.** Finding A1 |
| 4 | The flake class: load, not logic | **Better, and now it has a number.** 9 red out of 100 release runs; **0 of the 9 since the 30s timeout landed** |
| 5 | The npm package ships what nothing reads | **Worse again** — 396 files, 5.1 MB, `docs/` up to 1,382 KB |
| 6 | `cloud-desk.ts` claims one badge writer | **Still true, and the count was wrong both ways.** Finding A7 |
| 7 | `MAX_DIRECT_UPLOAD_BYTES` present tense, unused | **Still true** — one definition, one mention, zero clients |
| D1–D4 | Four README drift rows | **All four still true**, and D1 turns out to be bigger than the README |
| D5–D9 | Comment/doc drift rows | **All five still true** |

Two of last run's three new findings were closed inside 24 hours, and
`docs/design/convergence.md` was corrected in place with the counter-shape
recorded. That is twice in two runs that the memory has done its job.

---

## Findings, worst first

### A1. The two surfaces disagree about what a file **is**, and I measured it

Invariant 4, broken — **the code is the wrong side.**

Three mime tables, in two directions, none of them authoritative:

- `packages/cli/src/mime.ts:3-17` — ext → mime, 15 entries. Used by
  `isocan add`.
- `packages/web/src/lib/mime.ts:1-7` — ext → mime, **5 entries**, used only to
  patch what the browser reports.
- `packages/core/src/filenames.ts:36-48` — mime → ext, 12 entries, in core.

`packages/core/src/kinds.ts:34` names a mime type the CLI's table **cannot
produce**:

```ts
if (mime.startsWith("text/") || mime === "application/pdf") return "document";
```

A browser drop of a PDF gets `application/pdf` from `file.type`. `isocan add
report.pdf` gets `application/octet-stream`. Run against the real code:

```
report.pdf   CLI mime: application/octet-stream   kind: other     size: 420x320
a.md         CLI mime: text/markdown              kind: document  size: 420x320
b.png        CLI mime: image/png                  kind: image     size: 480x360

browser file.type for report.pdf is application/pdf → kind: document
```

So the same file, added from the two surfaces, is a **different kind of thing**.
`isocan ls --kind document` misses the PDFs the files panel is showing under
"Document". `.csv` and `.json` do the same in the other direction.

`kinds.ts:6-8` states the exact rule this breaks — *"Shared so the web app's
files panel and `isocan ls --kind` group the canvas the same way. A kind that
means one thing in a list and another in a filter is worse than no kinds at
all."* — and `filenames.ts:26-31` already makes the whole argument for the
inverse map: *"Two copies of this map would drift, and the drift would be
silent."* The argument was made, accepted, and applied to one direction only.

**Fix.** `mimeFor` moves to core beside `extensionFor`, with one table and its
inverse derived rather than typed twice, and it gains at minimum
`pdf`/`csv`/`json` — every mime type `kinds.ts` branches on must be reachable
from an extension, or the branch is dead on one surface. `mimeTypeOf` in the
web keeps its job (`file.type` is a better answer when the OS has one) but
falls through to core's table instead of its own five rows. Then one test:
for a list of filenames, `itemKind` agrees whichever door the file came
through. `defaultSize` (3b) comes along in the same move — it is the same
table asked a different question, and `upload.ts:24-41` and `mime.ts:25-28`
already carry identical numbers.

### A2. The door checks who you are exhaustively and what you sent not at all

Reproduced against a live daemon on a scratch home:

```
POST /api/ops item.move x='banana' → 200
canvas item → {"id":"itm_1","x":"banana","y":null,"width":100}
oplog tail  → {"type":"item.move","itemId":"itm_1","x":"banana","y":null}
```

Not a rejected request — an **applied op, durably written**, broadcast to
every replica, and part of the log forever. `item.resize` with
`width: -5000, height: "tall"` does the same.

The mechanism is not a bug anybody wrote; it is the absence of a layer.
`Operation` is a TypeScript discriminated union, and TypeScript is not there at
runtime. `packages/server/src/engine.ts:1556-1558` goes envelope → invert →
apply with no shape check between the HTTP body and the reducer. The reducer
validates *referential* facts thoroughly — unknown item, duplicate id, unknown
anchor, internal op (`ops.ts:248`, enforced at `engine.ts:1509`) — and an
entirely unknown `type` is caught by `unknownOperation` in both the reducer
(`reducer.ts:397`) and `invert.ts:191`. What nothing checks is a **known type
with wrong-shaped fields**.

Today that is bounded, because every client is code in this repo. Three things
are about to unbound it, and this is why it is finding two rather than a
footnote:

1. **The oplog is truth.** `architecture.md` says durability precedes
   broadcast; a malformed op is not a failed request, it is a permanent record
   that every future replay applies.
2. **`docs/design/extensions.md:60`** — *"`does` is a slash command or an
   `Operation`"* — puts a literal `Operation` in a manifest, which is an item,
   which is user data on a canvas. The doc's whole rule is *"an extension may
   only ask for what a person could ask for"*, and that sentence is only true
   if "what a person could ask for" is a **checked** set. Right now it is a
   type that has already been erased.
3. **Phase 10's queue** stores ops in IndexedDB and replays them
   (`writequeue.ts:96`). Anything that can write that store can write an op.

**Fix, and it is the shape this repo already likes.** One
`validateOperation(op): void` in `@isocan/core`, hand-rolled beside the union
the way the YAML subset is hand-rolled beside the parser it refused to depend
on — no schema library. Called by the engine before `invertOperation`, and by
the web before queueing, so both surfaces refuse the same things: that is
invariant 4 exactly. It gives `extensions.md` tier 1 its `does` check for free,
and it turns "the vocabulary is the contract between the two surfaces" from a
compile-time statement into a runtime one.

### A3. The map's own inventory of what is missing lists work that shipped

`docs/architecture.md:6-11` sets a contract: *"the whole system is mapped here
now, and the map changes only when reality produces something we didn't see
coming — never because a region was left blank to fill in later."*

`docs/architecture.md:475-476`, under **Distance to the map** — *"What the code
does not have yet"*:

> - The Share dialog and grant routes; registrations and the dispatch path.

Half of that shipped in phase 7 (`995fbe5`):

- `packages/web/src/components/ShareDialog.tsx` exists.
- `packages/server/src/http.ts:786`, `:818`, `:876` — GET, POST and DELETE on
  `/api/projects/:id/grants`.
- `packages/cli/src/main.ts:1351` — `isocan share`.

Registrations and dispatch really are unbuilt (phase 12), so the bullet needs
splitting, not deleting. This is worse than a stale sentence elsewhere in the
doc, because **this section's entire job is to be accurate about absence** — a
reader planning work reads it as a to-do list and would go build the thing
twice.

N3 is the same contract failing in the other direction:
`grep -c "placement.ts\|fit.ts\|nearestFreeSpot\|fitMoves" docs/architecture.md`
→ **0**, unchanged, ten days after `item.add` started resolving its position
against the whole canvas inside the reducer. `architecture.md:264` — *"the rest
are absolute-valued or refuse on the second pass"* — became true again when
`c088f61` landed, which is worth saying out loud: that row is **fixed by code**,
and it is the only one in three runs that resolved that way.

**Fix.** Split the Share bullet. Add the paragraph N3 asked for. Both are
five minutes; the reason they have not happened is decision 1 below.

### A4. The retired "on call" presence is still taught in five places — one of them the component that would draw it

Last run filed this as one README row (D1). Re-measuring it found it is not a
README problem.

`packages/server/src/presence.ts:10-12` is the truth:

> There used to be a second, home-wide scope — "on call", an agent parked on
> `isocan wait` surfacing in every canvas's roster — retired with #60.

Still describing the retired behaviour as current:

| where | what it says |
| --- | --- |
| `packages/web/src/components/Presence.tsx:19-22` | *"A third state sits between the two: ON CALL … it wears a dashed ring"* |
| `packages/web/src/components/Minimap.tsx:33` | *"Everyone with a place to stand — an on-call session has none."* |
| `packages/core/src/protocol.ts:89` | *"Scene 4's dimmed face with a dashed ring"* |
| `README.md:317-322` | *"A parked agent wears a dashed ring in **every** canvas's facepile"* |
| `docs/multiuser-journey.md:126, :219` | the ideal, so arguably legitimate — see decision 4 |

`Presence.tsx` is the interesting one. Its own face renderer emits exactly
`live`/`away` plus `self`/`badged`/`followed`; there is **no dashed-ring rule
for a face anywhere in `styles.css`**. The component's doc comment describes UI
the component does not have — which is the failure mode this repo is otherwise
unusually good at avoiding, since almost every comment here is load-bearing and
therefore trusted.

`README.md:382` already says the opposite of `README.md:317` (*"there is no
home-wide listening; the old 'on call' presence was retired"*), so the file
contradicts itself 65 lines apart.

**The doc is the wrong side** — five times. Fix: delete the third state from
`Presence.tsx`, reduce `Minimap.tsx:33` to "a session with no cursor", correct
`protocol.ts:89` to describe what a relayed parked CLI session actually looks
like, and cut the README bullet. If the ideal in `multiuser-journey.md` is
still wanted, that is decision 4, not a comment edit.

### A5. `fit` is still one gesture and N+1 undo steps, on both surfaces

Carried forward unchanged and re-verified.
`packages/cli/src/main.ts:2775-2778` and
`packages/web/src/lib/fititem.ts:41-49` both send one `item.resize` **per
item**, then one `items.move`. `packages/server/src/undo.ts:44-62` pushes one
seq per entry, so ⇧F on six items is seven undo steps and ⌘Z undoes one resize.

The web comment at `fititem.ts:44-45` still names the rule it is only half
following, and `ops.ts:171-172` still says why the batch variants exist. Both
surfaces are wrong **identically**, which is the isomorphism working; only the
last mile differs, and it doesn't.

Unchanged fix: `items.resize`, or decision 3.

### A6. Judging `docs/design/extensions.md`

Asked for the same way `convergence.md` and `content-origin.md` were.

**The core move is right and it is the right kind of right.** "An extension is
an item with `role=tool`" is invariant 3 applied exactly: no new op, no new kind,
and the extension inherits versions, per-actor undo, comments, trash and the
CLI for free. `:133` states *"No new `Operation` per extension"* as a hard
rule. "An extension is an actor" is the strongest section — the identity desk
already does attribution, per-actor undo and tombstoned revocation, and
pointing it at software instead of people costs nothing. I have no structural
objection to the model.

Three things to settle before stage 1:

1. **`role` is a namespace with no owner.** `packages/core/src/designsystem.ts:22-24`
   declares `ROLE_PROP` and exactly one value (plus `LEGACY_DESIGN_ROLE`, kept
   because a rename that orphans somebody's file is not a rename). Nothing
   enumerates legal roles, nothing refuses an unknown one, and both surfaces
   would have to agree on the strings `"tool"` and `"panel"` by memory. That is
   two more clients that can get it wrong, and it is the third widening of a
   convention-carrying property this month (`annotates` into the reducer,
   `parent` proposed by `convergence.md`, `role` here). Cheap fix, and it
   should land *with* stage 1: a `roles.ts` in core with the union, a
   `roleOf(item)` accessor, and `isDesignSystem` rewritten on top of it.

2. **`does` needs A2 first.** `:60` says `does` may be *"a slash command or an
   `Operation`"*. A slash command is a name in a registry and is safe. An
   `Operation` in a manifest is untrusted JSON reaching a reducer that does not
   check field shapes — the `x: "banana"` above, arriving from a canvas
   somebody shared with you. Either narrow `does` to command names only for
   stage 1, or make A2 a prerequisite in the Stages list. Do not ship it on
   the strength of "the vocabulary is the contract"; the contract is erased at
   runtime.

3. **"Both surfaces" (`:143-151`) is the section the forcing function cannot
   police, and it is currently satisfied by an escape hatch.** `:33` offers
   *"The CLI, free: `isocan add rail.json --prop role=tool`"*. That is true and
   it is not enough — `--prop` (`main.ts:2192`, `ctx.ts:403`) can set any
   property, so by that argument no property ever needs a verb. This repo has
   already decided the other way, twice: `isocan star` exists at
   `main.ts:2706` despite `--prop star=1`, and `role=design-system` got both a
   core helper (`designSystemProperties()`) *and* a verb. `surface.test.ts`
   reads registered commands; an intent that registers no command is invisible
   to it. Name the verb in stage 1 (`isocan extension add|list|remove`, or
   whatever it should be called) and the build will hold the guide to it.

The rest — icons from a named set, no app-origin JS, the capability list
printed before install, "it must look like an extension" — I would keep
unchanged. One line to add: the named icon set has to live in **core**, since
the CLI validates a manifest the web renders, and a second copy of that list is
A1 happening again.

### A7. `cloud-desk.ts`'s "one writer" is five writers, and the real invariant is a different word

`packages/cloudstore/src/cloud-desk.ts:55-56`:

> So they cannot be forgotten, structurally: **nothing writes a badge except
> `writeBadge`** … A reviewer's whole job on this file is to confirm there is
> one writer.

I did that job. Writes to a `BADGES` document today:

| line | what | derives the arrays? |
| --- | --- | --- |
| `:118` | `ref.set({ lastSeen }, { merge: true })` | n/a — carved out in a comment, correctly |
| `:262` | `killBadge`, `tx.set(ref, denormalize(…))` | yes |
| `:396` | shelf adoption, `tx.set(badgeRef, denormalize(…))` | yes |
| `:420` | `writeBadge` itself | yes |
| `:452` | `mutate`, `tx.set(ref, denormalize(next))` | yes |

Five, not one — and not the four the last run counted either: its `:91` is
`put()`, which merely *calls* `writeBadge`, and it missed `mutate` at `:452`,
which is the read-modify-write path most of the desk actually goes through.
The file has not changed since before that run, so this is a measurement
correction, not a regression.

**All five are correct**, and that is the point: the invariant the code
actually holds is not "one writer", it is **every badge write passes through
`denormalize`**. That is stronger, simpler, and — unlike the claim in the
comment — greppable. Fix: change the word, and add the grep as a test in
`packages/cloudstore/test/`, in the shape `seam.test.ts` already uses. Then
the sentence *"a reviewer's whole job on this file is to confirm there is one
writer"* stops being a job and becomes a build failure.

### A8. The tarball is 47% things nothing reads, and it grew again in a day

`npm pack --dry-run --ignore-scripts`, by top-level directory:

| dir | size | files | read at runtime? |
| --- | --- | --- | --- |
| `packages` | 3,353 KB | 300 | partly — see below |
| `docs` | **1,382 KB** | 40 | no |
| `infra` | 145 KB | 21 | no |
| `test` | 80 KB | 11 | no |
| `scripts` | 35 KB | 5 | no |
| `scratch` | 16 KB | 1 | no (`sketch.svg`, one file, since 2026-08-20) |

**396 files, 5.1 MB unpacked** — was 388 / 5.0 MB yesterday morning. `docs/`
grew 67 KB in a day and is 27% of the install on its own.

New this run, and it is the number that makes the case: **113 of the 300 files
under `packages/` are test files**, totalling 767 KB —
`packages/server/test` 348 KB, `packages/cli/test` 195 KB, `packages/web/test`
165 KB, `packages/core/test` 155 KB. Add `test/` at the root and it is 847 KB.
Docs plus tests plus `infra` plus `scratch` is **2,390 KB of 5,100 KB — 47% of
what somebody installs to get a CLI.**

`.npmignore` is unchanged and still excludes only `marketing`, with a comment
explaining exactly why (a 500 KB screenshot nobody running `setup` needs). The
same sentence applies to four more directories. Decision 2.

### A9. What `npm test` costs, and where

Two green runs, 57.6s and 58s wall. The distribution is stark:

| workspace | summed file wall | share | files |
| --- | --- | --- | --- |
| `packages/cli` | 195,544 ms | **53%** | 21 |
| `packages/server` | 163,378 ms | **44%** | 23 |
| `packages/web` | 8,001 ms | 2% | 25 |
| `packages/core` | **192 ms** | 0.05% | 31 |
| root `test/` | 750 ms | 0.2% | 5 |

**44 of 112 files (39%) account for 97% of the work.** Thirty-one pure core
files run in under a fifth of a second, combined. `grep -l` for
`startDaemon|spawn(|execFile|bin/isocan.js` returns **42 files** — the overlap
is essentially exact. The slowest five: `session-identity` 31.2s, `home-link`
31.1s, `daemon` 29.4s, `wait` 24.8s, `pass` 21.1s.

That is also where the CI redness lives. `gh run list --workflow=release.yml
--limit 100`: **90 success, 9 failure, 1 cancelled** over 2026-08-19 →
2026-08-24. Every failure I opened failed at `Run npm test`; the one I read
through was `session-identity.test.ts > presence beats never cross`, 1 failed /
109 passed — the exact flake `3c7825e` was written for. **Since that commit
landed (03:51 on the 24th) there have been 9 consecutive green release runs**,
which is the first real evidence the 30s timeout is the right fix rather than a
covered-up symptom. Nine runs over thirteen hours is not proof, but it is
better than "run it again", and the number is now on the record so the next run
can say whether it held.

The structural note stays open: 97% of the suite's cost is process spawning in
parallel workers, so the flake class is a scheduling property, not a per-test
one. Constraining the parallelism of those 44 files is a fix that does not have
to be repeated.

### A10. Found, then closed under me — and the class it belongs to

Worth recording even though the code is already fixed, because the shape
recurred twice in three commits.

The working-tree change I was asked to review moved the title row's screen-pixel
inset **from `.item.selected .item-titlebar` to `.item-titlebar`**.
`worldchrome.test.ts`'s allowlist was `[".resize-handle", ".item.selected",
".item.peeked"]` matched by `String.includes`, so the old rule was covered
*incidentally* — via `.item.selected` — and the new one was covered by nothing.
The guard did not fail; it stopped looking, silently.

Mid-review, the session that owns the file closed it thoroughly: `.item-titlebar`
and the four corner rules are now named individually in `WORLD_CHROME`;
`mentions()` replaced `includes` so `.item.peeked` no longer matches
`.item.peeked-x`; `ownRule()` was added because a *descendant* rule kept the
existence check green with the peek ring deleted; `padding` joined `SIZING`; and
`chrome.test.ts:230` now asserts that `CHROME_INSET` and `.item-titlebar`'s
padding are literally the same number, closing the "must match styles.css"
comment that had no test. `lessons.md` #15 records the underlying bug. That is
better than what I was going to propose.

**The class is still open.** A per-selector allowlist cannot survive a
declaration moving between selectors, and this codebase moves declarations
between selectors — twice in `60a1284` → `e0dc1b2` → the working tree. There
are three other "must match styles.css" couplings with no test
(`CursorGlow.tsx:4`, `MainThreadPanel.tsx:36`, `TrashPanel.tsx:20`) and the
world-space set is still enumerated by hand rather than derived from "every
rule inside `.world`". Worth one conversation, not a refactor.

---

## Drift table

| # | Doc says | Code does | Wrong side |
| --- | --- | --- | --- |
| **D10** | `docs/architecture.md:475` — the Share dialog and grant routes are among "what the code does not have yet" | `ShareDialog.tsx`, `http.ts:786/818/876`, `main.ts:1351` — shipped in phase 7 | **Doc.** New, and in the one section whose job is accuracy about absence (A3) |
| **D11** | `packages/core/src/kinds.ts:6-8` — kinds are shared "so the files panel and `isocan ls --kind` group the canvas the same way" | A PDF is `document` from the browser and `other` from the CLI | **Code.** New, measured (A1) |
| **D12** | `docs/design/extensions.md:143-151` — "Nothing exists only in the web app" | The only CLI path named is `isocan add --prop role=tool`; no verb, so `surface.test.ts` cannot see it | **Doc** (a proposal, so cheap to fix now) (A6) |
| **D13** | `packages/web/src/components/Presence.tsx:19-22` — a third face state with a dashed ring | Two states, `live`/`away`; no dashed-ring rule for a face exists | **Doc** (the comment) (A4) |
| D1 | `README.md:317` — a parked agent's dashed ring in every facepile | Retired with #60 (`presence.ts:10-12`), and `README.md:382` says so | **Doc.** Still true; bigger than the README (A4) |
| D2 | `README.md:440-443` — four packages | Five workspaces; `cloudstore` appears **0** times | **Doc.** Unchanged |
| D3 | `README.md` CLI surface block | `get`, `browse`, `distribute`, `fit` appear **0** times each | **Doc.** Unchanged |
| D4 | `README.md:440` — core is "…pure reducer, inverse engine, placement math" | Core also holds design tokens, a YAML subset, a command registry, contrast math, `fit.ts`, `kinds.ts`, a skill resolver | **Doc.** Unchanged |
| D5 | `cloud-desk.ts:55-56` — "nothing writes a badge except `writeBadge`" | Five writers; the real invariant is `denormalize` | **Doc.** Still true, and the count was wrong in both directions (A7) |
| D6 | `docs/architecture.md:394` — `MAX_DIRECT_UPLOAD_BYTES` "is the one number both clients branch on" | Neither branches; `:486` says so correctly | **Doc** (tense). Unchanged |
| D7 | `docs/architecture.md:6-11` — "the whole system is mapped here now" | `placement.ts`, `fit.ts`, the reducer's spatial search: **0** mentions | **Doc.** Unchanged |
| D8 | `docs/architecture.md:264` — "the rest are absolute-valued or refuse on the second pass" | True again as of `c088f61` | **Fixed, by the code** |
| D9 | `fititem.ts:44-45` — "one op for the lot … one undo step rather than six" | True of the moves, false of the N resizes above it | **Code.** Unchanged (A5) |

Two rows on the code's side now (D9, D11) against nine on the doc's. That
ratio has been stable across three runs and it still says something good: when
this repo's documents and its code disagree, it is almost always because the
code moved forward and the prose did not.

---

## What is good, specifically

**The N1 fix is better than the fix that was proposed, and it says why.**
`c088f61` normalizes `item.add` fully in the engine, and
`engine.ts:1528-1541` records the whole wrong turn in place — *"An oplog that
has to be re-cooked is not a record."* The property it chose is the valuable
part and it is stated: the logged position is already clear, so the reducer's
own search is a **no-op on the way back**, which means the layout survives the
algorithm changing. And `positionIsMeaningful` moved into `placement.ts:129-139`
with the reason written on it — *"two implementations of that predicate is two
canvases."* That is a seam closed with an argument, not a helper extracted for
tidiness.

**The `role`/`annotates`/`star`/`parent`/`region` conventions have zero raw
string literals in any client.** I grepped for `"star"`, `"parent"`,
`"annotates"`, `"region"` and `"role"` across all three clients' source: **no
hits**. Every use goes through a core helper (`starPatch`, `annotationOf`,
`designSystemProperties`, `parentOf`). Invariant 3 is not a convention here, it
is enforced by there being nowhere else to get the string. That is why A6's
`role` note is a small fix rather than an archaeology problem.

**Internal ops are sealed, and sealed by set membership rather than by a list
of cases.** `ops.ts:248` names five; `engine.ts:1509` refuses any of them whose
`cause` is undefined; `daemon.test.ts:128-134` proves it. All five appear
**zero** times in `agent-guide.md`. A sixth internal op inherits the guard for
free — which is the difference between a rule and a habit.

**`packages/core` is genuinely empty of the world.** One dependency. Zero
`node:` imports. Zero imports from any sibling workspace. Thirty-one test files
that run in 192 ms combined. The hand-rolled YAML subset
(`designmd.ts:15`) is still hand-rolled and still says why. Whatever else moves,
this has not.

**The offline queue is the best-argued file in the repo.** `writequeue.ts:5-34`
states three rules and the reasoning for each, including *"Rebase, not skip"* —
with the concrete counterexample (you move a card offline, Bob moves it at seq
12, your flush lands at 13) that shows why the tempting optimisation is silent
divergence. It is also the thing that keeps A1's cousin from being a
correctness bug: the queue is a **view** over confirmed state, never written
into it, so an `item.add` placed locally is re-placed by the home and the tab
adopts the home's answer.

**The guards got sharper this weekend in a way that is unusual.**
`worldchrome.test.ts` now has three independent failure modes it did not have
two days ago — a class that renames to a superstring of itself, a rule deleted
while a descendant keeps the existence check green, and a length that stops
dividing by `--scale` — and each was found by breaking the test on purpose and
watching it stay green. `chrome.test.ts:230` turned a "must match styles.css"
comment into a numeric assertion. `surface.test.ts` grew a regression case that
freezes the *old* bug (prose must not count as documentation). That is three
guards in a row that were mutated before being believed.

---

## Decisions for a human, not an agent

1. **Does the README get a forcing function, or get demoted?** Carried forward
   for the third run, unchanged, and now with a companion: `architecture.md`'s
   inventory drifted the same way (A3). The pattern is proven rather than
   argued — the guide had a weak test and drifted three verbs, then got a
   strong test and stopped; the README has no test and has drifted four ways
   for three reviews. The cheapest version of a forcing function is small:
   point `documentedVerbs()` at the README's CLI block too. The honest
   alternative is to say the README is prose and `--agent-help` is the only
   surface with a contract. It is currently in between, which is where drift
   lives.

2. **Is the shipped tarball the repo, or the CLI?** Finding A8, compounding on
   its own — 47% of the install is now docs, tests, infra and a stray
   `scratch/sketch.svg`. The `.npmignore` edit is five lines; deciding which
   reading is right is not, and the phase-14 angle still applies (if a daemon
   ever serves this repo's docs onto a canvas, "docs ship" should be a decision
   somebody made). Note the newest wrinkle: `packages/*/test` is 767 KB, and
   unlike `docs/` it grows with every guard this codebase adds — which is the
   thing you least want to disincentivise.

3. **Batch variants, or a grouping concept?** Unchanged from last run and now
   with a third claimant. A5 wants `items.resize` (the fourth `items.*`).
   `convergence.md`'s `item.adopt` wants atomicity across three effects in two
   families. `extensions.md`'s "installing one is one keystroke from undone"
   assumes an install is one entry, which it will not be the moment an
   extension is an item *plus* an actor *plus* a grant. All three are the same
   missing idea: the log cannot say "these entries are one act." A `groupId` on
   `LogEntry` that `UndoStacks.record` treats as a unit answers all three and
   stops the vocabulary growing a plural per gesture. It also touches the one
   file both clients share while the multiuser build is mid-flight. Still the
   largest structural question open, and it should not be settled as a side
   effect of shipping `fit`, `choose` or extensions.

4. **Is "on call" retired, or deferred?** New. A4 found the retirement taught
   in five places, but `docs/multiuser-journey.md:126` and `:219` — held as the
   **ideal**, per `AGENTS.md` — still describe Isaac's dashed ring appearing in
   every pile, relayed through Priya's daemon. #60 retired the implementation;
   nothing retired the scene. Either the journey gives up that beat, or the
   code owes it back at some phase, and until somebody says which, four
   comments will keep half-describing it. This is a product call, not a
   cleanup.

5. **Is CLI-ahead a rule or an accident?** Unchanged for three runs: web 20 ops,
   CLI 23, web ⊂ CLI, nothing web-only, every stated rule pointing one way and
   nothing saying the converse. Finding 2 (nothing watches the web's op set)
   cannot be closed with a test until this is decided, because the assertion
   depends on which direction is allowed.

---

*Next run: A1, A2, A5, A7, A8, 2, 3a/3b, 5, 7 and D1–D13 are the standing set —
say "still true", "fixed" or "worse" rather than rediscovering them. N1, D8 and
last run's finding 1 are closed; if any reappears, the fix was undone or the
test was weakened. **A2 is the one to check first**, because it is the only
finding here that a shipped design (`extensions.md`) would turn from a bounded
gap into an open door — and because the fix is one file in core.*
