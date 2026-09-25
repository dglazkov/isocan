---
status: designed
since: 2026-09-25
issue: 355
see: evals, canvas-groups, voice-agent, extensions
note: a seven-lane read-only audit on 25 Sep 2026 (React render cost, hook correctness, types and error handling, duplication, dead code, bundle and CSS, tests/scripts/CI) found 91 things, every one verified in code and the load-bearing ones reproduced. This walks them in seven phases ordered by what breaks first — the PR check that cannot finish, four ways the daemon or `isocan rc` exits on one bad input, a history scrub that can blank the app, two ways one canvas's data lands on another, a presence roster that re-renders every item 25 times a second — before the drift and the sweeps. Nothing built yet.
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

**Where we are:** designed 25 Sep 2026; no phase started.

**How it runs.** Each fix lands with a guard that imports the rule it guards
(lessons #5) and was seen to fail without the fix. `npm test` and
`npm run typecheck` per fix, `npm run test:deep` before any push. Nothing in
this walk adds an op or a verb, so the both-surfaces checklist is untouched
except where a phase says otherwise.

---

## Phase 0 — a PR check that can finish

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

## Phase 1 — one bad input does not end the process

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

## Phase 2 — one canvas's data stays on that canvas

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

## Phase 3 — the canvas does not re-render for nothing

- **RP-1.** Every `presence-roster` (≤25/s while any cursor moves, echoed to
  the sender) replaces `actorColors`/`actorNames`/`actorJoins` with fresh
  objects in [`canvasStore.ts`](../../../packages/web/src/stores/canvasStore.ts),
  so ~50 subscribers — every `ItemView`, past its memo — re-render even for a
  person alone. Keep the held map when it is shallow-equal.
- **RP-8.** The marquee writes a new selection array on every pointermove, and
  each one publishes a presence beat that comes back as RP-1.
- **RP-3.** `useVotesHiddenOn`/`useRoundMarks` subscribe every item to the
  whole canvas: every op re-renders all N.
- **RP-6.** `CanvasSurface` subscribes to `canvas` and `actorJoins` only to
  feed two effects, so the whole page chrome re-renders on every op and roster.
- **RP-9.** `CanvasViewport` re-sorts every item, with `groupAncestors` in the
  comparator, on every pan frame, and re-renders layers that read no viewport.
- **RP-4, RP-2, RP-7.** `MarkdownBody` builds its `img`/`a` renderers inline, so
  every re-render remounts every link and image (focus and selection lost as
  often as rosters arrive); chat markdown re-parses on every keystroke; every
  visible document re-parses on every op.

**Proof:** the existing pan and drag budgets, before and after; a render count
for N items under a cursor stream.

## Phase 4 — what ships is what runs

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

## Phase 5 — copies agree

- **DU-1.** The talk module's `Resampler`, a copy marked "reconcile by hand",
  missed both of `053d2d42`'s fixes: at 44.1 kHz it writes a PCM zero about once
  a second. Port them, and add `test/copies.test.ts` over every declared copy
  pair — or move the pure DSP into core.
- **DU-2.** Title→filename exists six ways; the canonical one decomposes
  accents and never strips the marks ("Crème brûlée" → `cre-me-bru-le-e`), and
  the ASCII copies drop letters ("Café" → `caf`). One rule, in core.
- **DU-4.** Core's mime table has no `pdf`/`csv`: the CLI makes "other" of a
  file the browser makes a "document". **DU-5.** The agent tray's own `ago()`.
- **BC-6, BC-4.** `var(--page)` on a full-screen cover, `var(--muted)` ×10 and
  `--radius-lg` — defined nowhere — because every CSS guard reads only
  `styles.css`. Point the guards at every stylesheet.
- **TR-3.** `docs/decisions.md` is stale (88 lessons of 93) and its `--check`
  runs nowhere.
- **RH-3, RH-4, RH-5.** StageEditor's "landed while you edited" fires for your
  own save and ⌘S runs the first render's `save`; five design panels disable
  their forms on every op.

## Phase 6 — the sweeps

Each is mechanical and each ends with a ratchet so it stays done:
`noUnusedLocals` (DC-4, ~25 dead declarations and ~100 unused imports); 48 dead
rules in `styles.css` (BC-3); the nine private `run()` wrappers (TS-5); a
tsconfig over `test/` and one CLI-spawn helper (TR-12, TR-13, DU-3); the
eager-core import in `AddPopover` (BC-1) and the lazy-only CSS split (BC-2);
the operator and passes sections out of the 5,948-line `registerRoutes` (TS-8).

---

## Not in this walk

- **The entry bundle is 567 B over `CEILING`** on `main`. That is the ratchet's
  own conversation — a `bundle-over-ceiling` finding — not a cleanup.
- **The React Compiler lint rules.** 126 hits, mostly noise against house
  patterns; the real ones are RH-1/3/5/11, fixed above. `exhaustive-deps` stays
  the gate.
- Anything touching `packages/cli/src/main.ts` beyond what a phase names, while
  it has work in flight.
