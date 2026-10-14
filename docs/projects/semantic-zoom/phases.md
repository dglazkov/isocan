---
status: designed
since: 2026-10-13
see: canvas-groups
note: "the walk: a bench that judges summaries before any ship, text nodes behind the experiment, groups and areas, freshness and cost, the CLI, evidence."
---

# Semantic Zoom — the walk

**13 October 2026.** Held to [journey.md](journey.md) and [design.md](design.md).

**Where we are, 13 Oct 2026: designed, not started. Dion's answers are in design.md §10 (the first person who can pay causes a summary; only notes over ~40 words; not shown without the flag; vision as its own setting, §11). Phase 0's bench is built and waits on a text key to run; phase 1 proceeds on a stub model.**

Rules for every phase, on top of `AGENTS.md`:

- **Behind the flag.** With `semantic.zoom` off, no request is made, no model
  is called, and no new chunk loads. A test says so.
- **Never instead of words.** A summary shows only where the words cannot be
  read, and is marked as a summary.
- **Never an op.** Nothing Semantic Zoom does appears in undo, the timeline or
  the oplog.
- **No spend without the key's rules.** Every model call goes through
  `/api/text`'s guards; a view-only viewer can read, never cause.
- **Stub in tests.** Journeys and unit tests use a stub model; only the bench
  (phase 0) and the walk (phase 5) spend real calls, and scheduling either is
  Dion's yes.

## Phase 0 — The bench

**Status: PART-DONE, 14 October 2026.** The bench is built (`bench/`: `bench.mjs render | plan | run | table`, the prompts in `prompts.mjs` ready to lift into core, a synthetic Acme fixture of 20 notes, 4 groups, an 11-card board and 8 rendered screens). It has not been run: no text key resolves on the build machine, so `run` stopped with zero calls. The plan is 74 calls (worst case 88), estimated well under $0.50.

**Outcome:** `docs/projects/semantic-zoom/bench/`: a script that runs the
three prompts over a fixture canvas (synthetic, "Acme": twenty notes of
different lengths, four groups, a three-area board) with the configured key,
and writes each summary beside its source with its word count, latency and
token cost.

**Proof:** a page in `bench/README.md` with the table, a judgement of each
summary against its source (faithful: says nothing the source does not; short:
under 30 words; useful: tells two neighbours apart), and the model tier
chosen. Run once, by hand, with Dion's yes.

### Trajectory

- **2026-10-13** — `/api/text` is not prompt-free: `claudeTextGenerator` (core `jev.ts`) sends a copywriting system prompt on every call and always asks for `fallbacks: "default"`, and the door takes no model. Phase 1's make route must set its own system line and model in-process, or summaries are asked of a copywriter on the most capable tier.
- **2026-10-13** — The 40-word threshold catches 16 of the fixture's 20 notes, and the four it leaves out are already their own title. Kept.
- **2026-10-13** — A screen alone needs its own framing line (`screen`) for §11; the bench adds it, used only with vision. Phase 3b's to ship.
- **2026-10-13** — Estimated, not measured: a 40-note canvas is about $0.002 on Haiku and $0.04 on Sonnet; vision's cap is about rate, not money.
- **2026-10-13** — Open: the run (table, judgements, tier choice) waits on a text key at the home (`isocan keys set anthropic` or `ISOCAN_TEXT_API_KEY`).

## Phase 1 — Text nodes, behind the experiment

**Status: NOT STARTED.**

**Outcome:** the `semantic.zoom` experiment; core's content key, text
collector, prompt and checks; the home's summary cache and its two routes;
the summary band for text nodes longer than the threshold, falling back to
the opening words; the "≈" mark; the stale-while-updating mark.

**Proof:**

- Unit: the key changes on an edit, not on a move; undo restores the old key
  and the old summary is found; excluded content never reaches the prompt.
- Server: view-only GET works, view-only POST is refused, owner-only spend
  holds, the 30 s debounce holds, two requests for one key make one call.
- Journey `semantic-zoom-text` (stub model): flag off → no requests; flag on,
  zoomed out → the summary shows; an edit → the old summary stays with the
  updating mark, then the new one replaces it with no empty frame between.

## Phase 2 — Groups and areas

**Status: NOT STARTED.**

**Outcome:** the group and area collectors; `Z_GIST` with hysteresis; the
counter-scaled summary card inside a group's or area's frame.

**Proof:** journey `semantic-zoom-board` (stub): a three-area board zoomed
out shows three summaries; dragging a card from one area to another changes
both keys and, after the debounce, both summaries; a group's summary ignores
an excluded member.

## Phase 3 — Freshness and cost

**Status: NOT STARTED.**

**Outcome:** the per-canvas hourly budget; eviction; nearest-first ordering;
a cost record (calls, tokens, per canvas per day) that `isocan summary --stats`
prints.

**Proof:** a forty-note fixture seen whole makes forty calls once and zero on
a reload; ten edits in a minute make one call; over the budget, nothing is
called and stale summaries keep showing.

## Phase 3b — Looking at pictures

**Status: NOT STARTED.**

**Outcome:** the `semantic.zoom.vision` row (shown only under
`semantic.zoom`); the make route's `vision` input; downscaled renders of
images and screens sent with the prompt; `vision` in the content key; its own
hourly budget; the row refusing, with the reason, when the provider's model
takes no images.

**Proof:** unit: a vision summary and a text-only one of the same item are
two keys; a text node's key does not change with vision. Journey (stub
model, which records what it was sent): with vision off no image is sent;
with it on a screen's render is, at most eight per group; a viewer with
vision off never reads a vision summary. The bench (phase 0) gains a vision
column for the fixture's screens before this ships.

## Phase 4 — The terminal

**Status: NOT STARTED.**

**Outcome:** `isocan summary`, `--refresh`, `ls --summaries`, the agent-guide
paragraph.

**Proof:** CLI tests against a scratch daemon with the stub; `surface.test.ts`
names the new verb and flag.

## Phase 5 — Evidence

**Status: NOT STARTED.**

**Outcome:** a verify walk in `docs/verify/` for what only a person can judge
(does a summary tell neighbours apart, is it ever wrong in a way that
misleads, does the band switch at the right zoom); an eval of summary
faithfulness on the bench fixtures that a persona owns.

**Proof:** the walk written, and the eval's first number.
