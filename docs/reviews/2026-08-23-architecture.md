# Architecture review — 2026-08-23

First run of this persona, so this is the baseline: everything below was
checked against the code rather than against the docs that describe it, and
where a claim was checkable I ran it and pasted what came back. Nothing here
is a refactor; every finding ends in a proposal.

**Scope note.** [`docs/projects/multiuser/phases.md`](../projects/multiuser/phases.md) describes an active build —
the hosted home on Cloud Run, phases 1–5 closed, phase 6 closed and verified,
phase 7 next. Everything it names as not-yet-built (the service worker, the
Share dialog, the clients' half of the large-blob upload, the admission scope
on `GET /api/projects`) is treated here as **in-flight, not drift**. It is
declared, dated, and owned.

## Verdict

**The isomorphism holds.** Not approximately — structurally. Every one of the
20 distinct `Operation` types the web app constructs is also constructed by the
CLI; the web's op set is a strict subset of the CLI's. The four ops only the
CLI issues (`comment.update`, `thread.setAnchor`, `items.restore`, and the
`align`/`distribute`/`format`/`merge` families that reduce to `items.move`) are
the *agent-ahead* direction, which is the safe one. There is no web gesture
today whose intent has no CLI verb.

The seven load-bearing invariants all hold. Package boundaries are not merely
clean, they are *asserted* — `@isocan/core` still has exactly one dependency
(`nanoid`), imports nothing from server, web, or cloudstore, and the hand-rolled
YAML subset in `designmd.ts` is intact with its reasoning attached.

The real findings are three: **the forcing function that guards the isomorphism
is weaker than it reads** (a substring match that passes on English prose);
**three small computations are duplicated across the surfaces** in exactly the
shape AGENTS.md warns about, one of them already visibly divergent; and the
**README has drifted in four places**, one of which contradicts another bullet
in the same list.

Measured: `npm test` — 806 tests, 87 files, 25s wall / 311s of file time.
`npm run typecheck` — all five workspaces, 6.3s. Two of three full test runs
failed exactly one test, a *different* one each time (see finding 4).

---

## Findings, worst first

### 1. `surface.test.ts` passes on prose, not on documentation

`packages/cli/test/surface.test.ts:49` is the house rule with teeth:

```ts
const missing = commands.filter((name) => !PLUMBING.has(name) && !guide.includes(name));
```

`guide.includes(name)` is a bare substring match against a 592-line markdown
file. For any verb that is also an ordinary English word, it cannot fail.

The proof, found by looking rather than by reasoning: `packages/cli/src/main.ts:2633`
registers `session move <x> <y>`. The guide's quick reference at
`packages/cli/src/agent-guide.md:577` lists `session start|on|work|say|point|end`
— **no `move`**. The test is green anyway, because the word "move" appears at
`agent-guide.md:115`, `:401` and `:403` in ordinary sentences. An agent reading
the guide is not told that verb exists; the build says it was told.

The same hole is open under `on`, `say`, `end`, `work`, `point`, `set`, `add`,
`get`, `use` and `star`. Measured: "on" appears as a bare word 63 times in the
guide and zero times as `isocan on`.

**Fix.** Match the way the guide actually names a verb, not the way English
does. Assert against a *fenced quick-reference block* parsed out of the guide,
matching on backticked tokens (`` `session move` ``, `` `align` ``) rather than
`String.includes`. Keep the sanity floor that already exists. Then add
`session move` to the quick reference, which is the one real gap this uncovers.

### 2. Nothing at all watches the web surface

This is the gap the persona brief predicted, and it is real: `surface.test.ts`
reads `packages/cli/src/main.ts` and `agent-guide.md`. It never opens
`packages/web`. A new op wired into a React component and not into the CLI
breaks the isomorphism silently, and no test in the repo would notice.

That the invariant holds today is a fact about the people writing the code, not
about the build.

**Fix, and it is cheap because it passes today.** A test in the same family as
`seam.test.ts` — source-reading, no runtime — that greps every
`type: "<family>.<verb>"` literal out of `packages/web/src` and asserts each one
also appears in `packages/cli/src`. I ran that comparison by hand for this
review: web issues 20 op types, all 20 appear in the CLI, so the test is green
on day one. That is the property worth freezing, and it is precisely the one
`surface.test.ts` is structurally unable to check.

Web's op sites, for the record: `components/{Toolbar,OnIt,CommentLayer,ItemView,MainThreadPanel,TrashPanel,VersionFanOut}.tsx`,
`lib/{identity,identitycolor,mainthread,upload}.ts`, `pages/{CanvasPage,ProjectListPage}.tsx`.

### 3. Three computations live in both clients instead of in core

AGENTS.md item 4 names this failure mode by hand ("a filename from a title,
what kind an item is, where 'aligned' is") and the codebase has *fixed* all
three of those. What it has not caught is three smaller ones of the same shape.
One of them already gives two different answers.

**3a. Bytes, as a person reads them — three implementations, two behaviours.**

| where | code |
| --- | --- |
| `packages/cli/src/output.ts:31` | units `KB MB GB TB`, `toFixed(value >= 100 ? 0 : 1)` |
| `packages/web/src/components/TrashPanel.tsx:7` | units `KB MB GB`, otherwise a character-for-character copy |
| `packages/web/src/components/FilesPanel.tsx:51` | `Math.round(bytes/1024) KB`, then `toFixed(1) MB` — **different** |

A 5,200-byte file reads **5.1 KB** in `isocan ls` and in the trash panel, and
**5 KB** in the files panel. A 2.5 GB blob reads **2.5 GB** in the CLI and
**2560.0 MB** in the files panel. Same file, same canvas, three places, two
answers.

**Fix.** One `formatBytes` in `@isocan/core`; delete the other two.

**3b. The default footprint of a new item.** `packages/cli/src/mime.ts:25`
`defaultSize(mimeType)` returns 480×360 / 480×270 / 420×320. The identical
table is inlined at `packages/web/src/lib/upload.ts:36-40` as the fallback when
`createImageBitmap` cannot measure the file. Identical today, owned by nobody.

**Fix.** `defaultSize` moves to core; the web's `measure()` calls it for its
fallback. The web keeps its *measuring* (that is browser-only and correct);
what it stops keeping is a second copy of the answer.

**3c. Three mime tables, in two directions.**

- `packages/core/src/filenames.ts:33-51` — mime → extension, 12 entries. Its own
  doc comment argues the case: *"Two copies of this map would drift, and the
  drift would be silent."*
- `packages/cli/src/mime.ts:3-19` — extension → mime, 15 entries.
- `packages/web/src/lib/mime.ts:1-7` — extension → mime, 5 entries.

The core file made exactly the right argument and then the argument was applied
one layer down instead of all the way. No user-visible divergence today (the
browser supplies `File.type` for the image and video cases the web table
omits), which is why this is 3c and not 3a — but it is one dropped `.webp` away
from a `.bin` on one surface and a `.webp` on the other.

**Fix.** One table in core with both lookups derived from it
(`mimeForExtension`, `extensionForMime`). The web keeps only its genuinely
browser-specific rule: prefer `File.type` unless it is empty or
`application/octet-stream`.

### 4. `npm test` fails about one test per run, and it gates every release

Three full runs on this machine:

| run | result |
| --- | --- |
| 1 | 1 failed — `cli/test/wait.test.ts > clears the status when it wakes` — `fetch failed`, `connect ETIMEDOUT 127.0.0.1:59864` |
| 2 | 1 failed — `cli/test/session-identity.test.ts > presence beats never cross` |
| 3 | 806 passed, 0 failed |

Different test each time, both in the CLI's daemon-spawning integration files,
both connection timeouts to a freshly spawned daemon on loopback. Re-running
the failing test alone passes in 570ms. It is load, not logic — those two files
are the two slowest in the suite (36.0s and 26.2s of a 311s total) and the
runner is spawning real daemons in parallel workers.

Why this is an architecture finding and not just a QA one:
`.github/workflows/release.yml` runs `npm test` on every commit to `main`, and
a red run leaves the previous release standing. At a per-run failure rate near
2-in-3, the release branch stops tracking `main` for reasons that have nothing
to do with the commit. It also teaches everyone that a red suite means "run it
again", which is the habit that hides the next real failure.

**Fix.** Not a longer timeout — that hides it. Either give the daemon-spawning
CLI suites their own vitest project with `singleThread`/limited concurrency, or
make the spawn helper wait on the port with a bounded retry instead of a single
`fetch`. Then measure the rate again over ten runs and record the number here.

The slow files, for whoever picks this up: `cli/session-identity` 36.0s,
`server/home-link` 32.4s, `cli/wait` 26.2s, `server/daemon` 24.8s,
`cli/restart` 21.6s, `cli/binding` 18.3s.

### 5. The npm package ships 1.1 MiB the CLI never reads

`npm pack --dry-run --ignore-scripts`: **323 files, 3.6 MiB unpacked.**
`.npmignore` correctly keeps `marketing/` out (520 KiB, verified absent from
the file list) — but the same reasoning written in that file's own comment
applies to four more things that do ship:

| shipped | size | read at runtime? |
| --- | --- | --- |
| `docs/` | 1,033 KiB | no |
| `infra/` | 129 KiB | no |
| `test/` | 58 KiB | no |
| `scratch/` | 16 KiB | no (one stray `sketch.svg`) |
| `Dockerfile`, `cloudbuild.yaml` | 14 KiB | no |

`grep -rn '"docs/\|/docs/\|scratch/\|infra/' packages/*/src packages/cli/bin`
returns nothing: no code path reads any of them. `docs/` alone is 28% of the
install. The things an agent actually needs — `agent-guide.md` and the skill —
ship *inside* `packages/cli` and `.agents/`, which is right.

This is deliberate-looking in one direction and accidental in the other:
somebody thought about `marketing/` and wrote down why. Nobody has thought
about `docs/`.

**Fix.** Extend `.npmignore` with `docs`, `infra`, `scratch`, `test`,
`Dockerfile`, `cloudbuild.yaml`, and add the assertion to
`test/packaging.test.ts` — which currently asserts what *must* ship (`dist`)
and nothing about what must not. Keep `AGENTS.md` and `README.md`: those are
orientation, and they are 31 KiB.

### 6. `cloud-desk.ts` states an invariant its own file no longer satisfies

`packages/cloudstore/src/cloud-desk.ts:41-45`:

> So they cannot be forgotten, structurally: **nothing writes a badge except
> `writeBadge`** … A reviewer's whole job on this file is to confirm there is
> one writer.

I did that job. There are four writers:

- `:225` `writeBadge` — `set(denormalize(badge))`
- `:202` `adopt` — `tx.set(badgeRef, denormalize({...badge, claims}))`
- `:249` `mutate` — `tx.set(ref, denormalize(next))`
- `:98` `touch` — `ref.set({lastSeen: at}, {merge: true})`, carved out in a
  comment right there as the one safe exception

**The code is correct** — all three full writes go through `denormalize()`, so
the three derived arrays are rebuilt on every one of them, which is the property
that actually matters. The *prose* is stale, and it is stale in the most
expensive way: it tells the next reviewer to check a thing that is false, so
they either raise a false alarm or stop trusting the comment.

**Fix.** Restate the invariant as what it really is — *every write of a badge
document passes through `denormalize()`, except the `lastSeen` merge* — and
make it a source grep in `test/seam.test.ts`'s family, which needs no emulator:
every `.set(` on a `BADGES` doc ref either wraps `denormalize(` or is the
single `{ lastSeen` merge. Then the reviewer's job is a test's job.

### 7. `MAX_DIRECT_UPLOAD_BYTES` reads as shipped in the map, and is not

`docs/architecture.md`'s Blobs section says, present tense: *"`MAX_DIRECT_UPLOAD_BYTES`
in `@isocan/core` is the one number both clients branch on."* Grep says
otherwise — `packages/core/src/protocol.ts:252` defines it, `packages/server/src/http.ts:608`
mentions it in a comment, and **no client references it at all**.

The doc *does* declare this correctly two sections later, under "Distance to
the map": *"neither the CLI nor the web uploader branches on `MAX_DIRECT_UPLOAD_BYTES`
yet."* So this is not undeclared work — it is one paragraph written in the
tense of the destination while another is written in the tense of today, and a
reader who stops after the Blobs section is misled.

**Fix.** One clause in the Blobs section: "…is the one number both clients will
branch on (not yet — see Distance to the map)." Doc-side only; the code is
exactly where phases.md says it is.

---

## Drift table

Which side is wrong matters, because the fixes are opposite.

| # | Doc says | Code does | Wrong side |
| --- | --- | --- | --- |
| D1 | `README.md:240` — **"On call"**: "`isocan wait` belongs to the *home*. A parked agent wears a dashed ring in **every** canvas's facepile" | `packages/server/src/presence.ts:9-12`: *"There used to be a second, home-wide scope — 'on call' … retired with #60."* And `README.md:292` says, 52 lines later, "there is no home-wide listening; the old 'on call' presence was retired with this change." | **Doc.** The README contradicts itself in one bulleted list. Delete the "On call" bullet — the #60 bullet already tells the true story, and `README.md:328`'s CLI block agrees with it. |
| D2 | `README.md:338-346` — "npm-workspaces monorepo", table of **four** packages | Five workspaces; `packages/cloudstore` has been the Google-Cloud boundary since phase 4 and is the subject of two tests | **Doc.** Add the row: *"`packages/cloudstore` — the hosted home's backing: Firestore oplog, GCS blobs, KMS. The only workspace that has ever heard of a vendor, and nothing an installed CLI can resolve."* |
| D3 | `README.md:296-335` — the CLI surface block | `browse`, `get`, `star`, `align`, `distribute` are all registered (`main.ts:1426`, `:1522`, `:1651`) and absent from the block. `isocan get` appears **nowhere in the README** — 0 matches | **Doc.** And note the asymmetry that caused it: the agent guide has a test forcing it to stay complete, the README has nothing. |
| D4 | `README.md:343` — core is "the contract: state model, operation vocabulary, pure reducer, inverse engine, placement math" | Core is 5,595 lines across 37 modules and also holds a DTCG design-token system, a hand-rolled YAML front-matter reader, a 748-line slash-command registry, contrast math, and a skill-source resolver | **Doc** — and the code is right, which is the point. Every one of those is there *because* both surfaces need the same answer. The one-line description is from when core was smaller. Rewrite as "the contract, and every answer both surfaces must agree on." |
| D5 | `cloud-desk.ts:41` — "nothing writes a badge except `writeBadge`" | Four writers, all correct (finding 6) | **Doc** (the comment). |
| D6 | `architecture.md` Blobs — "the one number both clients branch on" | Neither branches (finding 7) | **Doc** (tense). Declared correctly elsewhere in the same file. |

Nothing in the reverse direction. I looked for it specifically — a rule the
code has broken — and did not find one. Every architecture.md claim I spot-checked
held: the `Store` interface exists with `listBlobs`/`deleteBlobs` at
`store.ts:197-199` exactly as phase 4 describes; `healthPath` at
`protocol.ts:364-377` picks `/api/healthz` for remote and `/healthz` for
loopback; `@google-cloud/*` appears in `packages/cloudstore/package.json` and
in no other manifest; `daemon.ts:126` is the single dynamic import;
`~/.isocan/dirs.json` is at `paths.ts:67`.

---

## What is good, specifically

This codebase has made several unusual calls that are correct, and a review
that only lists debt would teach the next person nothing about why it works.

**The habit of turning a convention into a build failure.** Three tests do
this — `packaging.test.ts`, `surface.test.ts`, `seam.test.ts` — and
`seam.test.ts` is the best of them. It asserts that every method on the `Store`
and `Desk` interfaces is exercised by the *shared* conformance suite, that both
suites run against *both* backings, and that `store.ts` and `desk.ts` still
have **no runtime import at all**. That last one turns "the engine compiles
against the interface and nothing else" from a promise into a grep. The
failure it prevents — a method implemented on FileStore, tested on FileStore,
and broken in the cloud where only production can find it — is the exact bug
two backings make possible.

**The emulator gate has an anti-skip switch, and CI throws it.**
`test/emulator.ts` has three tiers, and tier 3 skips the cloud suites while
naming what is missing *in the test titles*. `ISOCAN_REQUIRE_EMULATOR=1` turns
that skip into a failure, and `.github/workflows/release.yml:71` sets it. So a
contributor with no Java 21 gets a green run that says out loud what it did not
check, and CI cannot. That is the correct resolution of a tension most repos
resolve by lying in one direction or the other.

**The cloudstore boundary is documented at the point of decision.**
`daemon.ts:92-119` is 28 lines of comment above a 13-line function, and it
explains the dynamic import, why the specifier is deliberately *not* in the
manifest (declaring it would make the graph a cycle and would say, in the one
place people look, that the server needs Google's libraries — it does not), and
the price paid (a typo is a runtime error, bought back by a two-line test). The
measurement that decided it — 156 packages, 43 MiB, and a git install that
resolves the root manifest only — is in the comment, so the decision can be
re-derived rather than re-argued.

**Identity was the duplication that got fixed, and the fix is documented as a
lesson.** `packages/core/src/claims.ts:11-16` names the failure mode directly:
*"four stores, no single writer, and two clients re-implementing the same
continuity rule over different storage (#55)."* Today `applyClaim`, `bindName`,
`bindClaim` and the whole registry live in core, and the two clients hold only
storage adapters (`web/src/lib/identity.ts` over localStorage,
`cli/src/identity.ts` over `~/.isocan/identity.json`). Finding 3 above is the
same shape three sizes smaller — which is a good sign, not a bad one.

**The web's `lib/` is adapters, not a second brain.** I read every module in
`packages/web/src/lib`. `colors.ts`, `names.ts`, `mentions.ts`, `itemrefs.ts`,
`commands.ts` each open with a comment saying which part lives in core and why
only the React-shaped remainder is here, and each one imports the core function
and wraps it in a hook. `snap.ts` (177 lines of geometry) looked like a
candidate for duplication and is not: it answers "what edge is this drag
catching", where core's `layout.ts` answers "where does this group align to" —
different questions, and `layout.ts:5-8` says so.

**Convention-carrying properties are doing real work.** An annotation is an
ordinary drawing wearing `annotates` and `region`
(`packages/core/src/annotation.ts:1-13`), a favourite is `starPatch()` on
`item.update`, a site is a mime type. Not one of them taught every client a new
op. `isStarred`/`starPatch`/`renamedFilename`/`itemKind` are each imported by
*both* `ItemView.tsx` and `main.ts` — I checked the call sites, not the
imports. The vocabulary has stayed at 25 op types while the feature list has
roughly doubled, and that is the invariant paying rent.

**The invariants I could check mechanically, all held.** Internal ops:
`engine.ts:1077` refuses any `INTERNAL_OP_TYPES` member whose `cause` is
undefined, so the five inverse-only ops cannot enter through the front door.
Undo: `undo.ts` keys every stack on `actorId` and there is no unkeyed path.
Presence: `presence.ts` has no store reference, no append, no save — the file
does not import a persistence anything.

---

## Decisions for a human, not an agent

1. **Does the README get a forcing function, or get demoted?** Findings D1–D4
   are all the same root cause: `agent-guide.md` has a test that fails when it
   falls behind, and the README does not, so the README is where drift
   accumulates. Two honest answers. Either extend `surface.test.ts` to hold the
   README's CLI-surface block to the same standard as the guide's quick
   reference — cheap, and it would have caught all three of D1/D3 — or decide
   the README is prose and let `--agent-help` be the only surface with a
   contract. Do not leave it in between, which is where it is now. *An agent
   should not choose this: it changes what the README is for.*

2. **How much of the repo is the package?** Finding 5 is an easy `.npmignore`
   edit, but the underlying question is a product one: is the shipped tarball
   *the repo* (in which case docs belong and 3.6 MiB is the price of "the repo
   is the package") or *the CLI* (in which case docs, infra and tests go)?
   `marketing/` was excluded on the second reading. Applying it consistently is
   a five-line diff; deciding which reading is right is not.

3. **Where does the flake budget sit?** Finding 4 says the release gate is
   ~2-in-3 red on this machine. Fixing it properly means constraining the
   parallelism of the daemon-spawning suites, which makes `npm test` slower for
   everybody in exchange for a gate that means something. That trade is a human
   call, and the number to trade against — how often CI is actually red for
   this reason — is one `gh run list` away and worth pulling before deciding.

4. **Is CLI-ahead acceptable as a standing state?** `comment.update` (edit your
   own comment) and `thread.setAnchor` (re-pin a thread) have no web gesture, and
   `align`/`distribute`/`format`/`merge` have no button. Every stated rule
   points one way — AGENTS.md's "a feature that only a human can reach is half
   a feature", README's "every operation possible with a click is possible with
   a command" — and nothing says the converse. That may be exactly right (an
   agent's affordances are cheap; a person's cost screen space). But it is
   currently true by accident rather than by decision, and the moment it is
   written down, "the CLI may lead the web, never the reverse" becomes a rule
   the next feature can be checked against.

---

*Next architecture run should read this page first and say "still true",
"fixed", or "worse" for each finding rather than rediscovering it. Findings 1,
2 and 3 are the ones that want tests rather than a second mention.*
