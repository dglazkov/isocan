---
status: partial
since: 2026-11-19
see: modules, proactive-agent, durable-agents, multiuser, embed, browser-surface, workbench
note: "the walk: seams first (module routes, jobs, keys, models, module MCP); then the shell and the physics; then agents you can see and the one you always have; then media as modules; then agent sessions on the canvas with Antigravity as one driver; then memory as items; then voice."
---

# Open Stitch — the walk

**19 November 2026.** Held to [journey.md](journey.md). The source of every
rule ported here is OS1 (`depot.code.corp.goog:personal/openstitch`), cited
by its decision-record number (ADR) so a later session can read the argument.
Each phase ends with **Trajectory**: what it discovered that changes the
course, and the Open entries a later phase must pay for.

**Where we are, 21 Nov 2026: phases 0, 1, 2 (2A + 2B), 3 (all 11 integration
modules), 4 (workbench + 4 drivers), and 5 (memory + source-level Forget) are
CLOSED on `main` (47/47 ops, 9/9 core runtime deps). Phase 6 (voice
choreography, co-listening, vision share) code is merged and stays PART-DONE
until the five physical-microphone walks in `docs/verify/` are run by a
person; the Phase 1/5/6 human walk is registered at
[2026-11-21-openstitch-walk.md](../../verify/2026-11-21-openstitch-walk.md).
Decisions still open for Dion: hosted custody for `@house` (Cloud Run job vs
runner pool) and BYOK vs metered key on isocan.io.**

Rules for every phase, on top of `AGENTS.md`:

- **Port rules, not code.** A rule from OS1 arrives as a core helper, a
  table, a property convention or a protocol shape, re-expressed in isocan's
  idiom. No React Flow, no browser-resident tool loop, no Postgres.
- **Two op changes in the whole project** at most: an `expect` precondition
  on item ops (2A) and, if chosen, `op.redact` (5). Everything else is
  properties, comment metadata, presence and modules.
- **Both surfaces.** Core helper → CLI verb → `--agent-help` line → README →
  tests, every phase. `surface.test.ts` names every new verb; the affordance
  parity test (1B) names every shortcut's verb.
- **Lazy or nothing.** New shell and every module is a lazy chunk. The entry
  chunk must be back under its agreed ceiling (734,500 B) by the end of
  phase 1; no new lines in the hot files (`main.ts`,
  `CanvasViewport.tsx`, `CanvasPage.tsx`).
- **Honest presence.** An agent's cursor says what it is doing because the
  agent said so; nothing is simulated, nothing is claimed before it is on
  screen.
- **A human walk per phase** recorded in `docs/verify/`.
- **OSPO before public.** Tables ported near-verbatim (kinds sizing, tokens,
  context budgets) go through the open-source path before the public repo.

## Phase 0 — Seams

**Status: CLOSED, 19 Nov 2026.** All six seams landed on `main` with zero new ops (47/47): `ServerModule` (`./server`) + `ServerHost` under `/api/m/<module>/<path>` with `talk` and `mood` migrated (0.1); home-polled async `JobManager` (`job.*` properties, `isocan job ls|status|cancel|retry`) surviving client disconnect and daemon restart (0.2); AES-256-GCM sealed per-user BYOK keys at `/api/me/keys` with `credentialRef` stamping and `isocan keys --mine` (0.3); `@isocan/core/models` manifest + `isocan models` (0.4); `CliModule.tools` wired into `isocan mcp` proven with `stickers_drop` over stdio (0.5); project registration (0.6).

What every later phase needs and isocan does not have:

- **0.1 Module server routes.** A `./server` export on a module registers
  handlers under `/api/m/<module>/<verb>` with key access, rate limits and
  the owner-only-unless-shared spend rule the home already applies to its
  own model routes. Proof: `talk`'s voice token and `mood`'s image route move
  onto the seam with no change to `isocan voice` or `isocan mood`.
- **0.2 Jobs.** A start → poll → abandon protocol for slow generations. The
  job lives on the *item* as `job.*` properties; a placeholder item is added
  first; the result lands as `item.addVersion`; retry re-runs the stored
  request ("try another model"). **The home polls, not the browser** (OS1
  ADR 0016 observability, its `JobRequest`-on-node pattern). Proof: a fake
  thirty-second job survives a page reload and lands as a version.
- **0.3 Per-user keys.** Sealed in the home, overriding home keys per call;
  `isocan keys set <provider>`; a `credentialRef` on generated versions
  saying which key made them. Needed because the hosted 3P home has no
  Gemini key.
- **0.4 Model manifest.** `core/models.ts`: role → checkpoint with
  fallbacks (`chat utility embedding image video music tts live transcribe
  judge`), `providerOf`, `describeModelCatalog` (the shape of OS1's
  `src/models.ts`, populated with isocan's current choices).
- **0.5 Module MCP.** `isocan mcp` reads the module registry so a module's
  verbs reach MCP agents too.
- **0.6 This project** — `journey.md`, this walk, the README row. *Done.*

**Trajectory:** 19 Nov 2026: `CliModule.tools` avoided a third module registry by piggybacking on `CLI_MODULES`, and `test/modules.test.ts` caught module-spec strings even inside JSDoc comments — keep `@isocan/<mod>` strictly inside the three module lists. `KEY_PROVIDERS` stayed at four (`anthropic/openai/gemini/typesafe`) for existing test parity; Phase 3 modules wanting `fal` will extend it cleanly there.

## Phase 1 — Look and feel, and physics

**Status: CLOSED, 20 Nov 2026.** Both waves landed on `main` (`91422617c` physics, `57fb05757` Stitch shell/tabs/Inbox/Hide-UI, `8e02b48` Wave 2 prompt pill/agent dock/settings shell/welcome seed/web gestures/verified camera/bundle trim): entry chunk trimmed below ceiling before P2A (`745,517 → 732,480 B`) and sits at `738,114 B` (`-2,828 B` net from pre-project baseline) with `ISOCAN_REQUIRE_BUNDLE=1` passing and zero new ops. Human browser walk queued for `docs/verify/`.

**1A The shell.** What OS1 ships is "Stitch surfaces" (ADR 0253), not
glass: solid frames, Stitch greys, one radius scale, 40 px blur where there is
blur at all. It arrives as a theme preset over isocan's CSS variables plus
`core/motion.ts` (M3 durations and easings), and the 33 editable tokens in
four groups (surface, outline, type, layout) with four presets in the UI
devtools. Then: the **top nav pill** — Home, closable project **tabs** with
activity marks and persisted order, `+`, ⌘K, and the right cluster (view
toggle, comments jump, Share, Settings); **Home** with 16:9 previews, search,
inline rename, multi-select, "shared with me", and the **Inbox** of what waits
on you across canvases (open threads naming you, `ask`s, answerable inline —
a query over comments and presence, no new op); the **prompt bar chrome**
(480/640 card folding to a 270×42 pill three seconds after submit, chips
above the text, mode pill, mic, three docks — ADR 0214), addressing the main
thread in this phase and the house agent in the next; the **agent dock**
(one top-right anchor, orientation · notifications · roster accordion,
docking opposite a side prompt — ADR 0256); a centred **Settings** dialog
whose sections core and modules register; the **⌘K palette** grown from the
switcher, fed by the shortcuts table and module commands; hide-UI; a welcome
item the home seeds on `canvas.create`.

**1B Physics.** Pure math into core, gestures into `web/src/gestures/*`:
per-kind **size policy** (zoom 1 is reading distance; media at true pixels
to 1280; documents in a 480/640/800 band; "actual size" — ADR 0257);
the **chrome rule** (shed info below 33 %, the title below 56 px of room,
never the kind icon) and hover reveal; **snap v2** (six *screen* pixels,
targets under eight ignored, gap candidates = default · neighbour · equal,
size-match for siblings, the label row counted in vertical gaps); **resize
modifiers** (⇧ proportional, ⌥ from centre, togglable mid-drag, corners
resize and edges move); the **make-room** engine (minimal-motion push, BFS
cascade, protected ids, a grid index) with ⌥-drag and an undoable toast when
an agent pushed (ADR 0288); **auto-layout inference** for ⌘G and **tidy v2**
(ADR 0263/0276); the **group title band** with background auto-naming under
a `titleSource` compare-and-set that never overwrites a person's name (ADR
0265); the **one-toolbar-per-item** rule and the **pure context-menu model**
(hide, never grey; one undo per entry); **press-and-hold pickup**, the
**perimeter grab ring** that works over iframes, and the
`data-node-{drag-handle,perimeter,interactive}` contract with a static test
(ADR 0289); the **verified camera** (320 ms tween, the wheel wins, agents
told `verified` or `interrupted` only after settle — ADR 0304); the
**affordance parity test**.

Verbs: `set --actual-size`, `mv --make-room`, `add --make-room`,
`canvas group --infer`, `rename --source`, `session point --ack`.

**Proof:** the design-auditor persona returns prose findings on a
before/after walk; a non-developer opens Home, makes a canvas from a tab,
drops an image and it lands at reading size beside what is there; `?` and
`--agent-help` both list the verbs; the entry chunk is under 734,500 B.

**Trajectory:** 20 Nov 2026: Wave 1 landed 8 core physics modules, 4 CLI flags, Stitch surfaces theme + M3 motion + lazy Top Nav tabs + Home Inbox + Hide-UI, and `affordance-parity.test.ts` (caught `⌘\` Hide-UI on merge). Wave 2 landed lazy `PromptPill`, `AgentDock`, `SettingsShell`, opt-in `--welcome` seed, `gestures/*`, `cameraAck.ts`, and 7 lazy entry doors (`745,517 → 732,480 B`); adding `"sideEffects": false` to `@isocan/core` saved another 2.35 KB after P2A landed.

## Phase 2 — Agents you can see, and the one you always have

**Status: CLOSED, 20 Nov 2026** (2A merged `1d0184031`; 2B `@isocan/house-agent`, `isocan house`, `serve --house`, `identity --as house`, `HostedHouseRunner` contract, and lazy `ThoughtTrace`/`PlanView` renderers merged `6f1cf7cbf`; ⚑ provision for hosted Cloud Run runner left for Dion). Stands on phase 1.

**2A Agent semantics (core).** Presence **action verbs** — thinking,
reading, writing, generating, coding, verifying, coordinating, idle, done —
and **handles** from a deterministic pool with `@all`; the counter-scaled
`@handle · label` pill, a halo on the targeted item (ADR 0272/0273); this
replaces the working motion the web app currently invents. The **station**:
a group titled `@handle · role` holding the trace as one text item kept
current, a checklist, peer messages and artifact chips; Check, Steer, Stop.
The **work-visible contract**: intent in the future tense, the op, a paint
ack from the web on the presence channel, then exactly one first-person
past-tense summary that CLI output, the card and later speech all reuse (ADR
0018). The **failure object** `{headline, why, next, actions}` from one pure
function (ADR 0017). The **`expect` precondition** on item ops (version or
content hash) so a collaborator's undo never clobbers an intervening edit —
op change one. **Soft leases** (thirty seconds, daemon-held, shown by `ls`
and `get`) and a four-hop mention breaker in `wait` routing (ADR 0274).
**Receipts and proposals** on `comment reply` (from/to version, revertable;
or a patch spec). **Follow me** (viewport and the forty nearest visible ids
to the agent; `wait` wakes on it — ADR 0275). The **context graph**: typed
items with `agentDescription`, provenance edges, selection, view sets,
clusters in reading order, recent activity, batches, and a navigation index
mode — `isocan context --graph`, returned by MCP `read_canvas`. The
**dual-representation** convention: the home writes `agentDescription` on
upload and generation, and a generation's report is held until it lands.

Verbs: `session work <item> --doing <verb>`, `session start --station`,
`edit --expect`, `comment reply --receipt`, `context --graph`,
`context --view`.

**2B The house agent (`packages/house-agent`).** The agent a user always
has is *the agent guaranteed to be parked*, not a harness in the browser.
One package — the harness from `voice-agent`, the model manifest, tools =
CLI verbs and module MCP tools, context = the graph and (phase 5) memory
tiers — in three custodies: **laptop**, where `isocan serve` spawns
`isocan house` when a canvas opens and no `@house` is parked; **hosted**,
a home-owned runner with a budget holding a session the way `rc` holds one
today, summoned by comment or mention (this *is* the `durable-agents`
project); **BYO**, where Antigravity or Gemini CLI claims the `@house` role with
`identity --session --as house`. The prompt bar, `@house` and voice all
address whoever holds the role. The **instant ack** ("I'll …" at zero
milliseconds, never "Thinking…"), the thought trace, the plan view and goal
status are renderers over comment metadata, so any agent writing the same
metadata gets the same UI (ADR 0020/0177/0269).

**⚑ provision:** the hosted runner is a Cloud Run job or sidecar per home
and recurring model spend — asked of Dion before it runs.

**Proof:** two BYO agents and the house agent on one canvas, each visible
with a verb and a station, no clobbering, one receipt per edit; a new user on
isocan.corp.goog types in the bar and has items with honest presence within
five seconds; `isocan context --graph` is what the house agent reads.

**Trajectory:** —

## Phase 3 — Media and models, as modules

**Status: CLOSED, 21 Nov 2026.** All four waves merged on `main` (`ad8f5abc4` `describe` + `video`, `7aa0fa406` `audio` + `model3d`, `59ebec686` `image` + `research` + `media-edit`, `96a9ad0` `design-system` + `workspace` + `clipper` + `prototype`), all lazy behind experiments (0 B entry growth), 47/47 ops. May begin once 0.1–0.4 land; runs beside phases 1
and 2. OS1's media tools are plain routes with the browser as poller, which
is what makes them re-homeable. Each module ships the whole set: kind and
renderer, CLI verb, `/api/m/<name>` route, MCP tool, guide topic, job-on-item
retry.

| module | kinds | verbs | notes |
| --- | --- | --- | --- |
| `image` (from `mood`) | image | `image "<prompt>" [--edit <item>]` | sync; idempotency key; `derived-from` edge |
| `video` | video | `video "<prompt>" [--from <item>] [--extend]` | **a job**; the home polls; twelve-minute budget |
| `audio` | **audio** (new kind) | `music`, `speak`, `transcribe <item>` | |
| `model3d` | **glb** (new kind) | `add x.glb`, `capture-view <item>` | upload only; renders in the sandboxed origin |
| `describe` | — | `describe <item>` | writes `agentDescription`; the home calls it on upload |
| `research` | document, site, image | `research "<q>" [--deep]` | a home job with progress on the item |
| `media-edit` | video, audio, image | `clip trim\|stitch\|mux\|frames` | ffmpeg in the home; laptop homes first |
| `design-system` | sheet, review | `design system\|critique\|mockups` | folds into `critic`/`critique` |
| `workspace` (from `gdoc`) | document, sheet, slides | `gdoc`, `gsheet`, `gslides` | user OAuth |
| `clipper` | web, image | — | extension → `isocan add`; joins `browser-surface` |
| `prototype` | screen | `wire`, `build` | the "app" tier is a phase-4 session, not a route |

Keys: home keys on laptop and corp homes; per-user keys on isocan.io;
owner-only spend unless shared. Vision Share belongs to phase 6.

**Proof:** each module passes `test/modules.test.ts`, is lazy, and its verb
is in `--agent-help`; a video started from the prompt bar survives closing
the tab.

**Trajectory:** —

## Phase 4 — Agent sessions on the canvas

**Status: CLOSED, 20 Nov 2026** (`SessionDriver` + `OpenNodeEnvelope` + removable `@isocan/workbench` with `pty`, `antigravity`, `gemini-cli`, `claude-code` drivers, dev-server `site` auto-preview, `emit`, and driver-generic `debug` merged `3876c3d3b`). Stands on phases 2 and 3. Module `workbench` plus
one core interface.

OS1's Antigravity layer is some twenty-six thousand lines with no driver
abstraction: one module mixes HTTP routing, RPC to Antigravity's language server,
brain-directory scraping, artifact scanning and dev-server heuristics. What
is already generic there: the session kind (dispatching on source), the PTY
terminal, the node envelope and outbox, station groups, the three-layer
memory gate. **The local isocan daemon is the workstation bridge** OS1 had to
build separately: it is already on the laptop, already a replica of hosted
canvases, already has passes and badges — so pairing codes and bearer tokens
in local storage go away.

- A **`SessionDriver`** interface in core (types only): `list`, `start`,
  `send`, `approve`, `cancel`, `tail → events`, `artifacts`, `models`,
  `devServers`; the event vocabulary is OS1's — snapshot, turn, step,
  subagents, interaction, dev_server_ready, status, rewind, artifacts.
- **Drivers** in the module, on laptop daemons: `antigravity` (RPC and the brain
  directory), `gemini-cli`, `claude-code`, `pty`. Approvals normalise to
  `isocan ask` and an approve reply; each driver maps its own permission
  model.
- The **`session`** and **`terminal`** kinds (xterm in the sandboxed origin
  over the daemon's socket). **A session is also an agent**: the driver opens
  a presence session for it, so it has a handle, a cursor, verbs and a
  station — Antigravity on the canvas looks exactly like the house agent on it.
- Artifacts become items with provenance; a dev server the session started
  becomes a live `site` item; an auto-preview toggle.
- The **node envelope** — `isocan add --spec -` — a validated,
  producer-untrusted batch of items, edges and patches; a terminal command
  survives only from the trusted driver.
- The **debug loop** — Plan or Fix-now from an error item, bundling the last
  turns and the context graph — calls `driver.start()` on whichever driver
  the person picks.
- **Not only a software factory:** the same session item runs a deep
  research agent, a planner, a house-agent routine.

**Proof:** one canvas with a Antigravity session, a Claude Code session and a
shell, each with a cursor and a station; a Vite server started in any of them
appears as a live site; a Antigravity workspace is a canvas property, zero
migrations.

**Trajectory:** —

## Phase 5 — Memory, as items

**Status: CLOSED, 21 Nov 2026.** `core/context-budget.ts` (1800/1200/1200) + `core/pointer.ts` + removable `@isocan/memory` (versioned reflection doc, private "About you" canvas, owner-only `pointer` hydration, `/learn`, 3-way RRF `search` merged `2df0276a1`; source-level `POST /api/m/memory/forget` + durable exclusion tombstones returning `410 Gone` on forgotten pointers merged `588429778`, zero new ops). Stands on phase 2. Core conventions plus module
`memory`.

OS1's memory is live in production and better than isocan's: evidence
capture, coalesced workers, a project reflection document with fixed
sections, personal observations in five facets with confidence and proof
counts, recall in three tiers (the canvas graph free; the reflection and
guidance every turn; search only when the model asks), strict context
budgets (1,800 project / 1,200 personal / 1,200 history tokens — ADR 0035,
0139, 0223). It also lives wholly in Postgres beside the canvas, against
OS1's own first decision that nothing stands beside the graph. isocan keeps
the contract and the principle: **memory is items and ops.**

- **Evidence is the oplog.** Every op has an actor, a time and a sequence;
  chat is comments; versions are revisions. Nothing to capture.
- The **reflection** is a `document` item with `role: reflection`, one per
  canvas, versioned, written by the house agent or a home routine, citing
  `#item` and `comment:` — sections as OS1's (current intent, goals, themes,
  canvas state, decisions, open threads, corrections), the `Updated` line
  stamped by the home.
- **Personal memory** is a private "About you" canvas per person in their
  home: observations as items with `facet`, `confidence`, `proofs` and
  citation edges to the canvases they came from.
- **Pointer items** (`kind: pointer`) carry only a reference and hydrate
  only for their owner — OS1's memory-card invariant.
- `/learn` and "learn from this" append to the reflection's guidance or the
  About-you canvas, with a receipt and Undo.
- **Recall tiers:** zero is `context --graph`; one is reflection plus
  guidance, injected by the house agent and asked of BYO agents in a guide
  topic; two is `isocan memory search` over the home's items, with an
  embedding index behind a module route. `core/context-budget.ts` ports
  OS1's budgets nearly verbatim.
- **Forget:** observation-level is delete and prune (exists). Source-level
  is **oplog redaction** — op change two, `op.redact` by the owner leaving a
  tombstone — and OS1 never shipped it either. **Decision for Dion.**

**Proof:** a reflection that cites real items, regenerated after a session
and diffable in version compare; an observation placed on a shared canvas
renders locked for a collaborator; `memory search` answers from two
canvases; the budgets hold in the house agent's prompt.

**Trajectory:** —

## Phase 6 — Voice

**Status: PART-DONE, 20 Nov 2026** (code merged `54f9a7955`: `core/voice-choreography.ts` `PendingCallGate`, `SpeechBudget`, `AgentDisposition`, `detectFollowMeIntent`, `MediaControlController`, `VisionShareFrame`, `isocan voice disposition|control`; the five human voice walks in `docs/verify/` remain owed). Stands on the phase-2 paint ack. Module `talk` and
the house agent.

OS1's live choreography (ADR 0019/0279/0290): a function response is
permission to speak and is held until the work is on screen; a speech budget
and note policy against narrating twice; "follow me" detected in speech;
co-listening — play, pause, seek, find-by-transcript on the item being talked
about — over a controller registry that is never an op; disposition axes;
Vision Share frames as inline function-response data. Then the five human
voice walks owed since September. isocan.io needs per-user keys for Live;
the corp home has one.

**Proof:** the five walks in `docs/verify/` marked done by a person.

**Trajectory:** —

## Deliberately open

- Hosted custody shape (one job per home, or a pool with per-user budgets).
- `op.redact` in or out.
- Per-user keys as the whole 3P answer, or a metered isocan key.
- Driver order: Antigravity and `pty` together first, then Gemini CLI, then
  Claude Code — unless Dion wants the open one first.
- The name.
