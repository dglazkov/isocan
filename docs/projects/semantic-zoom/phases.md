---
status: partial
since: 2026-10-13
see: canvas-groups
note: "the walk: a bench that judges summaries before any ship, text nodes behind the experiment, groups and areas, freshness and cost, the CLI, evidence."
---

# Semantic Zoom — the walk

**13 October 2026.** Held to [journey.md](journey.md) and [design.md](design.md).

**Where we are, 13 Oct 2026: designed, not started. Dion's answers are in design.md §10 (the first person who can pay causes a summary; only notes over ~40 words; not shown without the flag; vision as its own setting, §11). Phase 0's bench is built and waits on a text key to run. Phases 1–4 and 3b are CLOSED on a stub model; phase 5's walk and eval are written. What is left needs a text key at the home: the bench's first run, the eval's first number, and Dion's walk.**

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

**Status: CLOSED, 14 October 2026.** The `semantic.zoom` experiment; core `semantic-zoom.ts` (the prompt lifted from the bench, the content key over prompt version, kind, item id, version id and title, the answer check, the 40-word line); the home's cache at `<home>/summaries/<canvasId>/<key>.json` (2,000 per canvas, least-recently-read evicted) with `GET …/summaries?keys=…&for=…` (view) and `POST …/summaries` (the home collects the words and runs `/api/text`'s guards in-process); the summary band in ItemView with "≈", "Summary of …" and ↻ while updating. The journey `semantic-zoom-text` on a recording stub: flag off, no summaries request, no chunk, 0 model calls; flag on, the summary shows, asked of `claude-haiku-5-5` under its own system line; an edit keeps the old summary with ↻ until the new one replaces it, 0 frames without the mark, 2 model calls. A test holds that the canvas's `lastSeq` does not move. Deep suite: 820 of 821 files, the one an unused export, fixed and re-run.

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

### Trajectory

- **2026-10-14** — The make route sets its own system line, model (`claude-haiku-5-5`, `ISOCAN_SUMMARY_MODEL`) and no `fallbacks`, in-process through `TextModel.write(req, own)`; `/api/text`'s callers still get the copywriter line, the most capable tier and fallbacks, held by a test.
- **2026-10-14** — A note changed in the last 30 s answers 202 `{code: "summary-quiet", retryAfterMs}` rather than a refusal, because the web's `ApiError` drops bodies. A stale summary is found by `GET …?keys=…&for=<sourceIds>`: the newest entry for the same note. `ISOCAN_SUMMARY_QUIET_MS` overrides the 30 s (the journey uses 2.5 s).
- **2026-10-14** — The home decides the 40-word line and caches a short note as a `short` entry: the client never loads the words to count them.
- **2026-10-14** — The entry chunk was already 710,970 on main (4,670 past the 706,300 ceiling, from other work; CI reports it and does not fail). The experiment row was paid for by moving `experimentOn` into `modules.ts`, so `EXPERIMENTS`' sentences ride the lazy Settings chunk: 710,079.
- **2026-10-14** — Open: forwarding the routes to a canvas homed elsewhere is wired and untested; the fetcher measures the window, not the canvas, and has no hysteresis of its own (ItemView decides).

## Phase 2 — Groups and areas

**Status: CLOSED, 14 October 2026.** Core `summaryMembers` collects a group (`groupDescendants`) or an area (`itemsIn`, by geometry), minus excluded items, nested frames, ink and annotations, sorted by id; notes send their words, screens and pictures their titles. The home makes `group` and `area` summaries with the same guards, waits out the quiet period across the frame, its members and what its last summary held, truncates over 64 KB longest-first, and caches an empty frame as `short`. `Z_GIST` (with `holdsAtZoom` hysteresis on the median member's type size) draws a counter-scaled card under the title strip. The journey `semantic-zoom-board` on a stub: four frames, six calls; a card dragged from To do to Doing changed both summaries after the quiet period, with 0 frames showing a card missing; the excluded note never in any prompt. Deep suite 821 of 821; entry 710,079 → 710,185.

**Outcome:** the group and area collectors; `Z_GIST` with hysteresis; the
counter-scaled summary card inside a group's or area's frame.

**Proof:** journey `semantic-zoom-board` (stub): a three-area board zoomed
out shows three summaries; dragging a card from one area to another changes
both keys and, after the debounce, both summaries; a group's summary ignores
an excluded member.

### Trajectory

- **2026-10-14** — An area's key covers membership, not each member's x, y, w, h (design §4 departed from): the prompt carries no positions, so a nudge inside an area keeps its summary, and a card moved in or out changes the key.
- **2026-10-14** — A frame's quiet period runs from the newest `updatedAt` across the frame, its members, and what its last summary held, so after a drag both the area it left and the area it joined wait.
- **2026-10-14** — On a groups canvas an "area" is a group (`isocan area new`); geometric areas exist only on legacy canvases. The board journey uses groups; legacy areas are proved by core and server tests, not in a browser.
- **2026-10-14** — While its card shows, a frame rises over its members (`.gisted`, z-index 1) and stops taking the pointer, so the card is not painted under the cards and a ⌘-press still reaches one. The members are washed at about 40% meanwhile: a judgement for phase 5's walk.
- **2026-10-14** — Open: forwarding a make to a canvas homed elsewhere is wired and untested, as in phase 1.

## Phase 3 — Freshness and cost

**Status: CLOSED, 14 October 2026.** A per-canvas budget of 60 makes an hour (`ISOCAN_SUMMARY_PER_HOUR`), answered over it with a 429 `summary-budget` and `retryAfterMs`; nothing is called and stale summaries keep showing. Eviction takes what nobody can reach first (a key no longer current and not the stale summary on screen; a deleted or excluded source), then least-recently-read. `SummaryLedger` keeps a cost record per canvas per UTC day (calls, tokens, model, kind, makes, hits, stale reads, refusals; 90 days) at `GET …/summaries/stats`, editors only. Server tests on a stub: forty notes make 40 calls once and 0 on a reload; ten edits in a minute make 1; over budget, 0 calls and the stale summary shows; eviction order; the stats add up. Deep suite 822 files, the one failure a bookkeeping list, fixed and re-run.

**Outcome:** the per-canvas hourly budget; eviction; nearest-first ordering;
a cost record (calls, tokens, per canvas per day) that `isocan summary --stats`
prints.

**Proof:** a forty-note fixture seen whole makes forty calls once and zero on
a reload; ten edits in a minute make one call; over the budget, nothing is
called and stale summaries keep showing.

### Trajectory

- **2026-10-14** — The budget is checked after owner-only and no-key and before the badge's rate, so a canvas refusal spends none of the badge's minute. The web pauses 60 s on it and wakes on its own; the rate-limit pause before this only ended when the view moved.
- **2026-10-14** — "Unreachable" is not "not current": the newest entry for a source whose current key has none yet is the stale summary on screen, and is kept.
- **2026-10-14** — Tokens come from the provider's own `usage`, read from a cloned response inside `TextModel.write`; core's generators are unchanged. A forty-note canvas takes about two minutes on one badge, because of `/api/text`'s 30 a minute, not the budget.
- **2026-10-14** — The cache's first load of a canvas raced since phase 1 (concurrent makes each built their own index); the forty-note test found it, and the load promise is now kept.
- **2026-10-14** — Open: the hour is held in memory, so a restarted home starts it fresh; every viewer read that hits writes the ledger once.

## Phase 3b — Looking at pictures

**Status: CLOSED on a stub model, 14 October 2026.** `semantic.zoom.vision`, "Semantic Zoom: look at pictures", shows in Settings only under `semantic.zoom` and is disabled, with the reason, where the home's model takes no pictures (`GET /api/text/pictures`). The make route takes `vision`; at most eight pictures go, largest on the canvas first, PNGs downscaled to 1024 px at the home with `node:zlib`; a screen alone is a new `screen` kind. The key gains "vision" only when a source has a picture, so a note or a group of notes keeps one entry. A separate 15-an-hour vision budget, counted in the ledger. `summary-vision.test.ts` on a recording stub: vision off sends no image; on, eight of ten go, largest first, a 2048 px render arrives at 1024×768; a vision-off reader never reads a vision summary; a model without pictures is refused before any is read. The board journey gained a picture: 0 images with vision off, 1 with it on. The bench's vision column is not yet run (no key).

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

### Trajectory

- **2026-10-14** — The home cannot draw a screen: a screen's picture is its version's image visual face (what `canvas shot --into` adds), else its title, and the prompt says which went by title.
- **2026-10-14** — Only PNGs are scaled down at the home (`node:zlib`, no new dependency); JPEG, WebP and GIF over 1024 px go by title. A decoder (an image library, and a Dockerfile line) waits on Dion.
- **2026-10-14** — Decided (Dion: "Image library sounds good"): `sharp`, an optional dependency of `@isocan/server` alone, scales JPEG, WebP, a GIF's first frame and PNG to 1024 px and sends whichever of PNG or JPEG is smaller. It is external to the CLI bundle and undeclared on `release`, so installs carry no native binaries and keep the zlib PNG path; the image `require`s it after the prune so a dropped optional install fails the build rather than going quiet. `docker build` was not run here.
- **2026-10-14** — The pictures check lives in `lib/api.ts`, the app's one door, spelled there and held equal to core's constant by a test: entry 710,185 → 710,246.
- **2026-10-14** — Open: no `isocan summary --vision`, so an agent cannot ask for a vision summary; the look of a lone screen's card is unjudged.

## Phase 4 — The terminal

**Status: CLOSED, 14 October 2026.** `isocan summary <item|group|area>` reports current, stale (with its age), short, excluded or missing, computing the content key from core over the snapshot the CLI already reads; `--refresh` uses the web's make route and prints the quiet period and the hourly budget as answers (exit 0); `--stats` prints the cost record; `ls --summaries` adds a column and never makes. The agent guide says summaries are approximate and an agent reads the words before acting. `summary.test.ts` (scratch daemon, stub model, `perHour: 2`): every state, `ls` making nothing, refresh while quiet and over budget, a group, a view-only identity refused `--refresh` and `--stats`.

**Outcome:** `isocan summary`, `--refresh`, `ls --summaries`, the agent-guide
paragraph.

**Proof:** CLI tests against a scratch daemon with the stub; `surface.test.ts`
names the new verb and flag.

### Trajectory

- **2026-10-14** — `current` after a make is the proof that the terminal's key matches the home's. `ls --summaries` is witnessed making nothing: a short note stays `missing`, where any make would cache it as `short`.
- **2026-10-14** — The CLI's summary code is a static import, and `routes.ts` spells the route path itself: every lazy shape split core's shared chunk and cost `isocan --version` a module past its budget (40 → 41/42). Semantic Zoom adds about 10 KB to every command and no module.
- **2026-10-14** — Open: `ApiError` drops bodies, so the terminal cannot show the budget's `retryAfterMs`; it points at `--stats`.

## Phase 5 — Evidence

**Status: PART-DONE, 14 October 2026.** The walk is written (`docs/verify/2026-10-14-semantic-zoom.md`, twelve steps, unverified; it needs a text key at the home). The faithfulness eval is built (`bench/eval.mjs`, `bench.mjs eval`): a cheapest-tier judge marks each claim supported, unsupported or contradicted against what the summariser saw, and "useful" is a matching task over the fixture's look-alike pairs; about 83 calls, refused with zero calls without a key. The `copy` persona owns `summary-unfaithful` (at most 0), which reads the recorded `bench/eval.json` and reports "no reading yet" (exit 3) until the eval has run; the ratchet, the nightly and the board count that as neither held nor missed. Not yet: the eval's first number and the walk, both waiting on a key.

**Outcome:** a verify walk in `docs/verify/` for what only a person can judge
(does a summary tell neighbours apart, is it ever wrong in a way that
misleads, does the band switch at the right zoom); an eval of summary
faithfulness on the bench fixtures that a persona owns.

**Proof:** the walk written, and the eval's first number.

### Trajectory

- **2026-10-14** — A recorded reading can be absent honestly: exit 3 plus "no reading yet", counted as neither held nor missed. `summary-unfaithful` is the first goal to use it.
- **2026-10-14** — The persona is `copy`, not `qa-tester`: a summary is words on the screen a model wrote, and copy's standing rule is that a confidently wrong sentence is worse than none.
- **2026-10-14** — The judge is the summariser's own tier; self-agreement is the bias to watch. In a three-item "useful" set the middle summary stays in place, so the area set is the weakest check.
- **2026-10-14** — Open: the bench, the eval's first number and the walk all wait on a text key at the home and Dion's yes.

