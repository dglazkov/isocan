---
status: built
since: 2026-09-29
issue: 364
see: embed, harnesses, bench, design-competition
note: all five phases (0–4) built and closed 28–29 Sep 2026, walked inside real Jetski. `isocan embed` frames a canvas chat-free (`?embed=1`, every Chat entrance closed) and speaks the selection bridge; `--model` pins a standing agent's model through the doors its harness has (`ANTHROPIC_MODEL`, `CODEX_CONFIG`, `{model}` in `acpAdapters`); `plugins/jetski/` ships the SessionStart hook, the Isocan Canvas AuxPane with `/skill` menu, selection composer, model-pinned Agents bar, open-asks inbox, fan-out across Jetski tiers, `/isocan` and `/fan-out` chat skills, and the live canvas-to-chat relay.
---

# Jetski — the walk

**28 September 2026.** The order of work for [design.md](design.md), held to
[journey.md](journey.md). Each phase ends with **Trajectory**: only what the
phase discovered that changes the project's course.

**Where we are:** all five phases (0–4) are CLOSED as of 29 Sep 2026 — walked
in headless Chrome and end to end inside real Jetski
([`docs/verify/2026-09-28-jetski-plugin.md`](../../verify/2026-09-28-jetski-plugin.md)).

---

## Phase 0 — Chat-free embed and the host bridge

**Status: CLOSED.** 2026-09-28 — a canvas opened with `?embed=1` has no Chat
and no way in to one, and tells the pane that framed it what is selected,
proved in headless Chrome against a daemon from this checkout.

**Outcome:** `embedCanvasUrl`, `isEmbedded` and `isEmbeddedChatHidden` in
`packages/core/src/address.ts`; `isocan embed` writes `?embed=1` by default
and `--chat` keeps the dock. `packages/web/src/lib/panels.ts` latches the
switch at load; the dock, the rail button, ⌘J, the palette's *Open Chat* and
slash rows, the chrome menu row and the module workspace button all ask
`chatHiddenNow()`, and `openPanel(…, "main")` folds to closed and stores
nothing. `packages/web/src/lib/hostbridge.ts` is the ready → hello →
selection / focus-item handshake (design.md §3).

**Proof:**
1. `npx vitest run packages/core/test/address.test.ts packages/web/test/embed-chat.test.ts`
   — the one spelling, the latch through the app's own navigation, the fold
   that stores nothing, every Chat entrance gated (a new ungated one fails
   *"leaves no way in to a Chat that is not there"*), and the bridge's
   handshake and refusals.
2. `npm run build && node scripts/journey-jetski-pane.mjs` — Chrome's own
   input throughout: the frame has no Chat dock and no rail button and keeps
   the Agents door; ⌘J and the palette open no Chat while a tab of the same
   canvas offers *Open Chat*; pressing an item in the frame reaches the pane,
   Escape clears it there too, the pane's focus-item comes back as the
   selection, and a message not from the frame is ignored. 17 of 17 on 28 Sep.
3. `npm test` and `npm run typecheck`.

### Trajectory

- **2026-09-28** — Hiding the dock did not hide the Chat: ⌘J, the palette's
  *Open Chat* and slash rows, the chrome menu and the module workspace button
  still opened it inside a pane. Each now asks `chatHiddenNow()`, and
  `embed-chat.test.ts` fails on the next one that does not.
- **2026-09-28** — The switch is read once, at load: the app's own routes
  drop the query, and the Chat came back the moment an item opened full
  screen inside the pane.
- **2026-09-28** — The design's `postMessage(…, "*")` would hand item titles
  to whoever framed the page. The canvas now posts selections only to the
  origin that answered its `isocan:ready` with `isocan:hello`.

---

## Phase 1 — Model-pinned agents (`--model`)

**Status: CLOSED.** 2026-09-29 — a pin rides the row into the adapter's
arguments and environment through the real binary, and a real turn on the
`jetski` ACP adapter (`-model {model}`) ran the pinned model and recorded the
session.

**Outcome:** `model` on `RcAgentRow` and `BenchAgent`; `--model <id>` on
`isocan agent add` (which also gained `--harness`), `isocan rc add` and
`isocan bench add`; `adapterFor` lays `ISOCAN_MODEL` always and reaches the
harness only through a door it has — `ANTHROPIC_MODEL`, `model` in Codex's
`CODEX_CONFIG`, `{model}` in a declared adapter's arguments — and
`isocan harness` says which (`model: pins|own`, `pinsModel`).

**Proof:**
1. `npx vitest run packages/cli/test/harnesses.test.ts packages/core/test/bench.test.ts`
   — each door, `{model}` and its flag left out when nothing is pinned,
   `CODEX_CONFIG` merged and refused when it is not an object, nothing
   invented for a harness with no door, `pinsModel` per harness, and the
   bench row's `model`.
2. `npx vitest run packages/cli/test/acp.test.ts` — through the real binary
   and a scripted adapter: `rc add --model` keeps the pin on the row and in
   `--json`, `rc turn` hands it over as `{model}` and `ISOCAN_MODEL`, and an
   unpinned agent on the same declaration gets neither.
3. `packages/cli/test/surface.test.ts` — every new flag is in the agent guide.
4. Walked live (29 Sep): `acpAdapters.jetski` declared with `-model {model}`
   reports `pinsModel: true`; `isocan rc add Fen --harness jetski --model flash`
   followed by `isocan rc turn Fen "Reply with one short word: PONG"` spawned
   `jetski_acp -model flash`, started session `2f635daa-b8ca-4114-8630-570fa9f20e28`,
   answered `PONG`, and ended `end_turn`.

### Trajectory

- **2026-09-28** — Only Claude Code's model variable is known
  (`ANTHROPIC_MODEL`); `OPENAI_MODEL`, `GEMINI_MODEL` and `PI_MODEL` were
  guesses, and a guessed door is a pin that silently does nothing. They were
  dropped, and `pinsModel` makes an unpinned "pinned" agent visible before
  anyone compares it.
- **2026-09-29** — `jetski_acp` accepts `-model <tier>`, so declaring
  `[".../jetski_acp", "-model", "{model}"]` in `acpAdapters` gives the
  default `jetski` harness `pinsModel: true` and passes the pinned tier on
  every turn.

---

## Phase 2 — The plugin bundle and the SessionStart hook

**Status: CLOSED.** 2026-09-29 — the bundle is complete, its hook runs from a
symlinked install in real Jetski, names the conversation on its bound canvas,
and injects the orientation step.

**Outcome:** `plugins/jetski/` — `plugin.json` (named `isocan`, so the pane's
pill is `sidecar://isocan/canvas/`), `mcp_config.json` (`isocan mcp`),
`hooks.json` (SessionStart only, guarded on `node`), `scripts/session-start.mjs`,
`rules/AGENTS.md`, the `canvas-builder` and `visual-arena` agents, the
`isocan` and `fan-out` chat skills, and `skills/isocan-collab` as a relative
symlink to the one skill. `isocan setup --jetski` (or
`node scripts/install-jetski-plugin.mjs` in a checkout) links it into
`~/.gemini/config/plugins/isocan`. `#release` carries `plugins/jetski/`
alongside the bundled CLI and daemon, and `unresolvedImports` allows
`sidecar_sdk` inside `plugins/jetski/` because the Jetski host provides it on
`NODE_PATH`.

**Proof:**
1. `npx vitest run test/jetski-plugin.test.ts` — the marker is found exactly
   as `packages/server`'s `findBinding` finds it; the person's and the
   conversation's environments against `packages/api`'s own harness
   variables; every SessionStart branch (joined, switched off, unnamed,
   naming failed, presence failed, a call carrying `invocationNum`, an
   unbound or relative folder); `hooks.json`'s own command run through
   `sh -c` from a symlinked install, printing exactly the hook result; the
   bundle's invariants; the installer's link, re-link, refusal and removal.
2. Walked in real Jetski (29 Sep): `SessionStart` named the conversation on
   its bound canvas (`Kenny 8`, `usr_2u2TRlSjwo`), started its presence
   session, wrote `~/.isocan/jetski-conversations.json`, and injected
   `EPHEMERAL_MESSAGE` in the session transcript.
3. `npm test` and `npm run typecheck`.

### Trajectory

- **2026-09-28** — `PreInvocation` fires before every model call, and Jetski
   keeps the `hooks.json` it loaded until a restart: an early wiring re-joined
   per turn and put a conversation on this repository's own canvas unasked.
   The hook is SessionStart only, and ignores any call carrying
   `invocationNum`.
- **2026-09-28** — The host runs hooks from the plugin directory and parses
   their output strictly, so a relative workspace path would have resolved
   inside this bound repository. Only absolute paths and `file:` URIs are
   read.

---

## Phase 3 — The Isocan Canvas pane and its Agents bar

**Status: CLOSED.** 2026-09-29 — the pane binds, frames, bridges and enrols,
walked standalone in headless Chrome and live inside Jetski's AuxPane under
the Sidecar SDK.

**Outcome:** `plugins/jetski/sidecars/canvas/` — `sidecar.json` (AuxPane),
`main.mjs` (routes run as the person, on the SDK under Jetski and on a
loopback fallback anywhere else) and `public/index.html`: the unbound card,
the chat-free frame with a fresh pass per load, the clickable header title
(`#where`) and *Open ↗* with instant CSS `[data-tip]` popovers, selection
chips and *Send to chat* into the conversation, and the collapsible Agents
bar from `presets.json` with each preset's real reach.

**Proof:**
1. `npx vitest run test/jetski-plugin.test.ts` — the routes through an
   injected CLI (the Agents bar as it would really run, a failed or too-old
   harness scan, the embed and tab addresses, binding by address, title or a
   new canvas and refusing a bound folder, enrolment from a preset or
   outright) and over a real loopback server with the SDK's token rule.
2. `npm run build && node scripts/journey-jetski-pane.mjs` — the unbound card,
   *Create*, the frame, and the bridge both ways (phase 0's proof 2).
3. Walked inside Jetski's AuxPane (29 Sep): `[Isocan Canvas](sidecar://isocan/canvas/)`
   opens the pane beside the chat, frames `[isocan] History` chat-free,
   lights up selection chips, sends questions to the active chat, and shows
   the conversation's own face (`this chat`) and presets in the Agents bar.
4. `npm test` and `npm run typecheck`.

### Trajectory

- **2026-09-28** — `isocan embed --json`'s `canvas` keeps `?embed=1`, because
  it is where an admitted frame goes back to — so *Open ↗* opened a tab with
  its Chat hidden. The pane derives a plain `tab` address instead.
- **2026-09-28** — Model presets enrol standing agents (`rc add --model`)
  rather than launching agentapi conversations: one mechanism for every
  harness, answering @mentions while the person's `isocan rc` runs, instead
  of a second, Jetski-only way to start an agent.

---

## Phase 4 — The tie: skills, the relay, fan-out, the inbox

**Status: CLOSED.** 2026-09-29 — built, walked in a real browser against the
real routes, and verified live inside Jetski against a real daemon and real
conversation.

**Outcome:** journey scenes 5–8. `plugins/jetski/lib/jetski.mjs` (the
conversations record, `agentapi`, every message the pane hands a
conversation), `lib/relay.mjs` (the relay), the hook writing the record and
telling the agent about skills and the relay, five routes in `main.mjs`
(`/api/skills`, `/api/asks`, `/api/send`, `/api/handoff`, `/api/fanout`) and
`/api/workspace` joining faces to conversations, and the page's composer,
`/` menu, starters, target menu, inbox and 💬.

**Proof:**
1. `npx vitest run test/jetski-tie.test.ts` — the record (merge, sweep,
   malformed), every message, the hook's record and its failure, each route
   through an injected CLI and `agentapi`, the relay lap by lap (deliver,
   stand back on 3, drop on 4 and on *not found*, never an unnamed
   conversation, the newest six), the lock, and the page calling only routes
   the server has.
2. The pane in a real browser (29 Sep): `/` listed six skills without
   `/help` and marked `/acme-brand`'s source; ↓/Enter took `/variation`;
   *Ask* sent `/variation n=2 …` with both selected ids to `send-message`;
   *@Orla* posted `/design-audit @Orla spacing only` on the first item and
   the frame received `isocan:open-thread`; *Fan out* started `flash` and
   `pro` conversations with tier titles; *Answer with Jetski* sent the ask
   with its reply command; 💬 called `toggleConversation` for the other
   conversation and the own face read *this chat*; at 420 px nothing
   scrolled sideways.
3. Walked live in Jetski (29 Sep): `isocan ask` surfaced **Asks 1** in
   `/api/asks`, and a canvas comment replying `@Kenny 8` on `thr_gzEc4b_2Zm`
   woke the live sidecar relay (`~/.isocan/jetski-relay.lock`, parked at
   `park_73ee5e8ce105dc9c`), which delivered the wake into the active Jetski
   conversation via `agentapi send-message`.

### Trajectory

- **2026-09-29** — A Jetski conversation on the canvas could not be reached
  from it: told not to park, it had a face and no ear. The relay parks as
  the conversation from the sidecar, which lives as long as Jetski does —
  the daemon's wake rule and the conversation's own cursor, so it adds no
  vocabulary.
- **2026-09-29** — Phase 3 chose standing agents over agentapi
  conversations for presets. Fan-out goes the other way on purpose and
  stays narrow (design §12): Jetski's own tiers, now, without `rc`. If the
  two ever compete for the same button, the Agents bar wins.
- **2026-09-29** — No `isocan comment show` exists; the thread message
  names `comment ls --open`, which lists exactly the questions it hands
  over.

