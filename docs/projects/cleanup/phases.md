---
status: partial
since: 2026-09-25
issue: 355
see: evals, canvas-groups, voice-agent, extensions
note: a seven-lane read-only audit on 25 Sep 2026 (React render cost, hook correctness, types and error handling, duplication, dead code, bundle and CSS, tests/scripts/CI) found 91 things, every one verified in code and the load-bearing ones reproduced. This walks them in seven phases ordered by what breaks first — the PR check that cannot finish, four ways the daemon or `isocan rc` exits on one bad input, a history scrub that can blank the app, two ways one canvas's data lands on another, a presence roster that re-renders every item 25 times a second — before the drift and the sweeps. Phases 0–2 closed 27 Sep (the PR check finishes; one bad input costs one socket, one turn or one item, not the process or the page; a canvas switch no longer writes one canvas's seen-mark or ink onto another; a cursor stream no longer re-renders every item; what #release ships now runs); phase 5 next.
---

# Cleanup — the walk

**The debt.** Nothing here is a feature. It is what four weeks of shipping
fast left behind, found by looking rather than by being bitten: crash paths no
test reaches because the input that trips them is rare, copies that were told
to "reconcile by hand" and did not, subscriptions that were cheap on the
canvas they were written against, and gates that stopped being able to answer.
Each phase below is a class of thing, not a list of incidents — the point of
fixing it here is the guard that comes with it, so the class stops recurring
(`docs/reviews/lessons.md`, whose shapes most of these are).

The audit ran on `2d3ad79b`, read-only, one lane per concern. IDs are the
lanes' own: **TS** types/errors, **RP** React render cost, **RH** hook
correctness, **DU** duplication, **DC** dead code, **BC** bundle/CSS, **TR**
tests/scripts/CI.

**Where we are:** designed 25 Sep 2026; taken up by the conductor 27 Sep.
Phases 0–4 closed 27 Sep. Next is cleanup phase 5 — then 6. The audit ran on `2d3ad79b`, and some of it was
fixed since by other work — marked *Done* where it stands, so a phase does
not re-fix it; everything else in a phase is re-checked against `main` in its
brief before anything is built.

**How it runs.** Each fix lands with a guard that imports the rule it guards
(lessons #5) and was seen to fail without the fix. `npm test` and
`npm run typecheck` per fix, `npm run test:deep` before any push. Nothing in
this walk adds an op or a verb, so the both-surfaces checklist is untouched
except where a phase says otherwise.

---

## Phase 0 — a PR check that can finish

**Status: CLOSED, 27 September 2026.** `pr.yml` runs `test:ci` in four shards
beside a `checks` job; a human PR's run (#361) was green with its slowest job at
484 s of a 20-minute limit, and the shard guard reads every workflow that runs
`test:ci` — red on the old `pr.yml`, green on the new.

Everything after this lands through `pr.yml`, and today it cannot answer.

- **TR-2.** [`pr.yml`](../../../.github/workflows/pr.yml) runs `test:ci`
  unsharded under `timeout-minutes: 20`. Human PR runs are cancelled at ~20m20s;
  the last success took 19m43s. [`release.yml`](../../../.github/workflows/release.yml)
  sharded four ways on 13 Sep and `pr.yml` did not follow — and the shard guard
  in `test/workflows.test.ts` reads only `release.yml`, so nothing noticed.
  Renovate's automerge waits on this suite.
- **TR-17.** Every nightly bot PR (grades, personas, changelog) shows a `pr.yml`
  run that failed with zero jobs ("likely a workflow file issue") or sits
  `action_required`. Diagnose before believing any bot PR's check.

**Proof:** a human PR's `pr.yml` green inside its timeout; the shard guard
fails if any workflow running `test:ci` is unsharded.

**Trajectory:**

- **2026-09-27** — TR-17 is a recording artifact, not a broken workflow: a
  `GITHUB_TOKEN` PR gets a zero-job `pr.yml` run, held `action_required`, turned
  failure within seconds of the PR closing. Fixed in words (AGENTS.md), not
  YAML; `paths-ignore` would stop it but strip checks from doc-only human PRs,
  which have reddened `main` before, so it was declined.

## Phase 1 — one bad input does not end the process

**Status: CLOSED, 27 September 2026.** Each crash path has a guard that records
escaped rejections and was seen red on the unfixed files (eight cases) and
green on the fix; the scrub was walked in headless Chrome — a blank page with
`unknown item` before, both notes drawn and no errors after.

Node 24 exits on an unhandled rejection and nothing in the repo handles one, so
each of these is a whole-process crash, not an error.

- **TS-1.** [`ws.ts`](../../../packages/server/src/ws.ts) closes a failed
  connection with `String(err)` as the reason; over 123 bytes `ws` throws. A
  long Firestore `UNAVAILABLE` takes down the Cloud Run instance. Fix with a
  byte-safe `closeReason()` beside a test.
- **TS-2.** The WebSocket upgrade handler and the roster timer in the same file
  are `void`ed with no `.catch`: any desk or engine rejection during connect.
- **TS-3.** `HomeLink.dial` ([`home-link.ts`](../../../packages/server/src/home-link.ts))
  awaits `ensureBadge()` outside its try — a leftover identity write lock or a
  corrupt `identity.json` is a crash loop that knocks on the metered door every
  restart. `gaveUp()` two lines up exists for exactly this.
- **TS-4.** The ACP adapter child ([`acp.ts`](../../../packages/cli/src/acp.ts))
  has no `'error'` listener: a mistyped `acpAdapters` command ends all of
  `isocan rc`, on every canvas it holds, instead of failing one turn.
- **RP-5.** While the scrubber shows the past, `ItemView`'s `groupDepth`
  selector calls `groupAncestors` on the LIVE canvas, which throws
  `unknown-item` for anything deleted since. No error boundary sits above the
  canvas, so this is plausibly a blank page. Fix the selector, and add an
  item-level boundary so one item's bad render costs one item — the third
  render-time throw that could white out the app, after the Pen.

**Proof:** a guard per item, each seen to fail against the unfixed code; the
scrub case walked in a browser and said so.

**Trajectory:**

- **2026-09-27** — RP-5 had siblings: `memberCount`, `noteSlideTitle` and
  the `reach` scan also read the live canvas under the past (wrong values, not
  throws). Fixed here through one on-screen helper in `ItemView`, since the
  class, not the incident, is what the phase is for.
- **2026-09-27** — The boundary cost 487 entry bytes past `CEILING`; paid back
  rather than raised, by removing two `await import("upload.ts")` calls that
  split nothing (the module is static elsewhere) yet emitted wrappers in the
  entry. BC-1 turned out to save nothing: `AddPopover` was already lazy.
- **2026-09-27** — TS-3's "crash loop every restart" was overstated: on boot
  the sweep meets the badge rejection first and swallows it; the dial only
  receives it when sharing an in-flight knock. Fixed all the same; the guard
  stubs the private `ensureBadge` because a real lock never reaches the dial.
- **2026-09-27** — Open: two more escapes of the same shape, found beside the
  phase and not yet guarded — `ws.ts`'s `presence-relay`/`rc-relay` voided
  IIFEs (a synchronous throw inside escapes) and `AcpAgentProcess`'s
  `child.stdin` with no error listener (EPIPE; not reproduced on Node 24.21).
  Waits on work: phase 6's sweep, or sooner.

## Phase 2 — one canvas's data stays on that canvas

**Status: CLOSED, 27 September 2026.** Each finding has a store-level test that
flips `canvasId` mid-flight and was seen red on the unfixed code; the Pen and
the switcher walked green in a real browser (`scripts/journeys.mjs`, 14/14).

- **RH-1.** [`useCanvasHome`](../../../packages/web/src/lib/homes.ts) resets
  inside an effect, so on an in-app canvas switch `CanvasSurface` runs its
  arrival effects with B's id over A's store: B's durable seen-mark is written
  at A's head (the home keeps the max, so B's inbox and "since your last visit"
  go quiet, on every machine), B's recents row gets A's title, and the surface
  remounts. Key the answer by the id it answers.
- **RH-2.** Leaving within 1.5 s of drawing: [`sketch.ts`](../../../packages/web/src/lib/sketch.ts)
  `place()` returns before dropping the placed strokes, so the same ink is
  placed again on the next canvas — which may have a different audience.

**Proof:** a store-level test for each, flipping `canvasId` mid-flight.

**Trajectory:**

- **2026-09-27** — RH-2 had a third path: ink drawn on A while A's upload was
  in flight was refused by the leave and then placed on B by B's settle timer.
  Decided: leaving takes all of a canvas's ink to that canvas — commits queue
  instead of refusing, and a failure off-screen waits for its own canvas.
- **2026-09-27** — The fix cost 291 entry bytes past `CEILING`; paid back by
  splitting the placing half of `sketch.ts` into a lazy `sketchplace.ts` (every
  caller was already asynchronous). Entry 700,723 bytes, 577 under — the
  leave's capture and clear stay eager, in the caller's own tick.
- **2026-09-27** — Open: `stranded` ink (a placement that failed after its
  canvas was left) lives in memory, so it is lost if the tab closes before that
  canvas is reopened. Waits on a decision to persist wet ink, if ever.

## Phase 3 — the canvas does not re-render for nothing

**Status: CLOSED, 27 September 2026.** Five render-count guards, each seen red
on the unfixed code; the census, three runs each way on 250 notes at 4x CPU:
pan's one long frame per run gone, and a new `cursor` gesture (another person's
cursor moving) from p50 50 ms with 13–16 long frames to 16.7 ms with none. The
marquee and a focused link were walked in a real browser.

- **RP-1.** Every `presence-roster` (≤25/s while any cursor moves, echoed to
  the sender) replaces `actorColors`/`actorNames`/`actorJoins` with fresh
  objects in [`canvasStore.ts`](../../../packages/web/src/stores/canvasStore.ts),
  so ~50 subscribers — every `ItemView`, past its memo — re-render even for a
  person alone. Keep the held map when it is shallow-equal.
- **RP-8.** The marquee writes a new selection array on every pointermove, and
  each one publishes a presence beat that comes back as RP-1.
- **RP-3.** *Done 26 Sep 2026* (`2016c2bc`): `useVotesHiddenOn` and
  `useRoundMarks` answer inside their selectors, so an op re-renders the items
  whose answer changed; `packages/web/test/canvaswide-rerender.test.ts` counts it.
- **RP-6.** `CanvasSurface` subscribes to `canvas` and `actorJoins` only to
  feed two effects, so the whole page chrome re-renders on every op and roster.
- **RP-9.** `CanvasViewport` re-sorts every item, with `groupAncestors` in the
  comparator, on every pan frame, and re-renders layers that read no viewport.
- **RP-4, RP-2, RP-7.** `MarkdownBody` builds its `img`/`a` renderers inline, so
  every re-render remounts every link and image (focus and selection lost as
  often as rosters arrive); chat markdown re-parses on every keystroke; every
  visible document re-parses on every op. *The last is done 26 Sep 2026*
  (`2016c2bc`: a note subscribes to the canvas only once it links a path on
  it), and `Markdown` is memoised (`cb9308c1`); RP-4 and RP-2 stand until
  re-measured.

**Proof:** the existing pan and drag budgets, before and after; a render count
for N items under a cursor stream.

**Trajectory:**

- **2026-09-27** — RP-2 as written was already fixed (typing re-parsed
  nothing); its sibling was live: the `@` roster was memoised on the whole
  canvas, so every op and every cursor beat re-parsed each Chat message. Kept
  by ids and names now, as `#` was on 26 Sep.
- **2026-09-27** — RP-8's presence beat already merged into the marquee's own
  cursor beat; the cost was whole-selection readers re-rendering on a fresh
  array. Fixed at the store, for every caller.
- **2026-09-27** — The entry chunk ends 10 bytes under `CEILING` (701,290).
  Every later phase that adds entry bytes pays its own way first.

## Phase 4 — what ships is what runs

**Status: CLOSED, 27 September 2026.** The release guard builds the tree and
resolves every import it ships — 8 unresolved on today's `#release`, none after;
`isocan canvas shot`, `--into` and a deck export ran from an `npm pack` install
of a locally built tree and produced a real screenshot, PDF and slides; the
build context excludes `packages/**/scripts`. No Docker image was built here
(no daemon on the machine).

- **DC-1 / TR-1.** `#release` keeps `scripts/canvas-shot.mjs`,
  `deck-export.mjs` and `lib/browser.mjs`, whose imports that branch stopped
  carrying on 18 Sep — so `isocan canvas shot` and deck export fail with
  `ERR_MODULE_NOT_FOUND` for every install, the CLI's `existsSync` guard never
  fires because the files are there, and Chrome is left running.
- **TR-4.** The release guard checks the drop LIST, not the resulting tree; it
  should resolve every import in what it ships.
- **TR-8.** `.dockerignore` misses `packages/modules/*/scripts`, so a
  calibration script that calls a paid model ships in the home image.
- **DC-2, DC-5.** The root manifest's copy of the CLI's runtime deps, and
  `prepare.mjs`'s nested install, both served git installs from `main`, which
  no longer happen; the second builds the web app twice in three workflows.

**Proof:** the release guard builds the release tree and resolves every import
of every file it ships, and fails on today's `#release`; `isocan canvas shot`
and a deck export run from an install of that tree; the home image's build
context carries no `packages/modules/*/scripts`.

**Trajectory:**

- **2026-09-27** — DC-1 was worse than written: beside the missing modules,
  `--into` named a bin no install has and dropped `--port`, and both scripts
  called `process.exit` past the `finally` that closes Chrome. The install walk
  found all three; the release now ships the camera and export as bundles.
- **2026-09-27** — Open: those bundles are built on their own, not beside the
  CLI (shared chunks put `--version` at 42 modules, past its budget of 40), at
  ~780 KB compressed per install. The camera imports the whole of
  `@isocan/api`, core and server; slimming that is the lever. Waits on work.
- **2026-09-27** — DC-2 stopped at `@types/css-tree`: dropping the root copy
  makes it dev-only, and the image's `npm prune --omit=dev` would remove it.
  TR-8's paid-model scripts are wireframe's `calibrate.ts` and talk's
  `fast-path-eval.ts`, not judge's, which calls no model.
- **2026-09-27** — The walk's first commands ran inside the repo, whose
  `.isocan/project.json` binds to its own canvas on isocan.io, and wrote a
  synthetic item there; removed as the actor that made it, with Dion's OK.
  Walks run from an unbound directory.

## Phase 5 — copies agree

**Status: NOT STARTED.**

- **DU-1.** The talk module's `Resampler`, a copy marked "reconcile by hand",
  missed both of `053d2d42`'s fixes: at 44.1 kHz it writes a PCM zero about once
  a second. Port them, and add `test/copies.test.ts` over every declared copy
  pair — or move the pure DSP into core.
- **DU-2.** Title→filename exists six ways; the canonical one decomposes
  accents and never strips the marks ("Crème brûlée" → `cre-me-bru-le-e`), and
  the ASCII copies drop letters ("Café" → `caf`). One rule, in core.
- **DU-4.** Core's mime table has no `pdf`/`csv`: the CLI makes "other" of a
  file the browser makes a "document". **DU-5.** The agent tray's own `ago()`.
- **DU-6.** *Done 26 Sep 2026*, found by that day's Stitch Loop review rather
  than the audit. Canonical JSON — sorted keys, then `JSON.stringify` of the
  leaves — was written seven times: the design request, repair and decision
  intent hashes, the partner plan's retry check, and the API's craft packet,
  review and repair readers. Four of those feed SHA-256 ids already on disk,
  so the copies were one algorithm only as long as nobody "improved" one. Now
  one `canonicalJson` in core, whose test runs the seven former copies beside
  it and pins a recorded design intent hash. Two look alike and stay apart on
  purpose: `canvas-groups.ts` and the wireframe module's `sameStyle` drop
  `undefined` keys the way JSON does, and the hashed ones never did.
- **BC-6, BC-4.** `var(--page)` on a full-screen cover, `var(--muted)` ×10 and
  `--radius-lg` — defined nowhere — because every CSS guard reads only
  `styles.css`. Point the guards at every stylesheet.
- **TR-3.** `docs/decisions.md` is stale (88 lessons of 93) and its `--check`
  runs nowhere.
- **RH-3, RH-4, RH-5.** StageEditor's "landed while you edited" fires for your
  own save and ⌘S runs the first render's `save`; five design panels disable
  their forms on every op.

**Proof:** every declared copy pair held by one test that runs both sides on
the same inputs, or the copy is gone; one filename rule, tested on accented
and non-Latin titles, which every former copy now calls; every CSS guard
reads every stylesheet and fails on the undefined variables; `decisions.md`'s
check runs in the suite; each RH fix with a test seen to fail without it.

## Phase 6 — the sweeps

**Status: NOT STARTED.**

Each is mechanical and each ends with a ratchet so it stays done:
`noUnusedLocals` (DC-4, ~25 dead declarations and ~100 unused imports); 48 dead
rules in `styles.css` (BC-3); the nine private `run()` wrappers (TS-5); a
tsconfig over `test/` and one CLI-spawn helper (TR-12, TR-13, DU-3); the
eager-core import in `AddPopover` (BC-1) and the lazy-only CSS split (BC-2);
the operator and passes sections out of the 5,948-line `registerRoutes` (TS-8).

**Proof:** each sweep's ratchet is in the suite and was seen to fail on a
reintroduced instance — `noUnusedLocals` in the tsconfig, a dead-rule count
for `styles.css`, a count of private `run()` wrappers and of CLI-spawn helpers
that can only go down.

---

## Not in this walk

- **The entry bundle was 567 B over `CEILING`** on `main`. That was the
  ratchet's own conversation, and it was had: `88c5e47e` took 30 KB off and
  lowered the ceiling to 701,300 on 26 Sep.
- **The React Compiler lint rules.** 126 hits, mostly noise against house
  patterns; the real ones are RH-1/3/5/11, fixed above. `exhaustive-deps` stays
  the gate.
- Anything touching `packages/cli/src/main.ts` beyond what a phase names, while
  it has work in flight.
