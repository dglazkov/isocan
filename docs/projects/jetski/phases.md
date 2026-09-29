---
status: partial
since: 2026-09-28
issue: 364
see: embed, harnesses, bench, design-competition
note: all four phases built 28 Sep 2026; phase 0 closed, phases 1–3 part-done, each waiting on one walk only a person can do. `isocan embed` frames a canvas chat-free (`?embed=1`, every Chat entrance closed) and a framed canvas tells its pane what is selected, only after the pane says hello; `--model` pins a standing agent's model through the doors its harness really has; `plugins/jetski/` is the plugin — a SessionStart hook that names a new conversation and puts it on the workspace's canvas, and the Isocan Canvas pane with an Agents bar of model-pinned presets. Owed: a summoned turn on a pinned model, and the hook and the pane inside real Jetski.
---

# Jetski — the walk

**28 September 2026.** The order of work for [design.md](design.md), held to
[journey.md](journey.md). Each phase ends with **Trajectory**: only what the
phase discovered that changes the project's course.

**Where we are:** all four phases built 28 Sep 2026. Phase 0 is closed,
walked in a real browser. Phases 1–3 are PART-DONE, each waiting on a person
for one walk no fixture can stand in for: a summoned turn on a pinned model
(phase 1), and the hook and the pane inside a restarted Jetski (phases 2 and
3) — [`docs/verify/2026-09-28-jetski-plugin.md`](../../verify/2026-09-28-jetski-plugin.md)
is that walk, step by step. Nothing waits on work.

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

**Status: PART-DONE.** 2026-09-28 — a pin rides the row into the adapter's
arguments and environment through the real binary; a turn on a real harness
showing it ran that model waits on a person.

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

### Trajectory

- **2026-09-28** — Only Claude Code's model variable is known
  (`ANTHROPIC_MODEL`); `OPENAI_MODEL`, `GEMINI_MODEL` and `PI_MODEL` were
  guesses, and a guessed door is a pin that silently does nothing. They were
  dropped, and `pinsModel` makes an unpinned "pinned" agent visible before
  anyone compares it.
- **2026-09-28** — Open: a summoned turn through each door — Claude Code,
  Codex, a declared adapter — whose harness's own session record names the
  pinned model. Waits on a person with those harnesses signed in; it spends
  tokens.

---

## Phase 2 — The plugin bundle and the SessionStart hook

**Status: PART-DONE.** 2026-09-28 — the bundle is complete and its hook runs
from a symlinked install exactly as the host runs it; a conversation in real
Jetski arriving on its canvas waits on a person, after a Jetski restart.

**Outcome:** `plugins/jetski/` — `plugin.json` (named `isocan`, so the pane's
pill is `sidecar://isocan/canvas/`), `mcp_config.json` (`isocan mcp`),
`hooks.json` (SessionStart only, guarded on `node`), `scripts/session-start.mjs`,
`rules/AGENTS.md`, the `canvas-builder` and `visual-arena` agents, and
`skills/isocan-collab` as a relative symlink to the one skill.
`isocan setup --jetski` (or `node scripts/install-jetski-plugin.mjs` in a
checkout) links it into `~/.gemini/config/plugins/isocan`. `#release` carries
`plugins/jetski/` alongside the bundled CLI and daemon, and
`unresolvedImports` allows `sidecar_sdk` inside `plugins/jetski/` because the
Jetski host provides it on `NODE_PATH`.

**Proof:**
1. `npx vitest run test/jetski-plugin.test.ts` — the marker is found exactly
   as `packages/server`'s `findBinding` finds it; the person's and the
   conversation's environments against `packages/api`'s own harness
   variables; every SessionStart branch (joined, switched off, unnamed,
   naming failed, presence failed, a call carrying `invocationNum`, an
   unbound or relative folder); `hooks.json`'s own command run through
   `sh -c` from a symlinked install, printing exactly the hook result; the
   bundle's invariants; the installer's link, re-link, refusal and removal.
2. `npm test` and `npm run typecheck`.

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
- **2026-09-28** — Open: in a restarted Jetski, a new conversation in a bound
  workspace gets the message, answers `isocan whoami` with its own name and
  shows its face on the canvas; one in an unbound workspace gets nothing.
  Waits on the person
  ([verify](../../verify/2026-09-28-jetski-plugin.md), steps 1–4).

---

## Phase 3 — The Isocan Canvas pane and its Agents bar

**Status: PART-DONE.** 2026-09-28 — the pane binds, frames, bridges and
enrols, walked standalone in a real browser; inside Jetski's AuxPane under
the Sidecar SDK it waits on a person.

**Outcome:** `plugins/jetski/sidecars/canvas/` — `sidecar.json` (AuxPane),
`main.mjs` (four routes, each one or two CLI commands run as the person, on
the SDK under Jetski and on a loopback fallback anywhere else) and
`public/index.html`: the unbound card, the chat-free frame with a fresh pass
per load, *Open ↗* as a plain tab address, selection chips and *Ask* into the
conversation, and the Agents bar from `presets.json` with each preset's
real reach.

**Proof:**
1. `npx vitest run test/jetski-plugin.test.ts` — the routes through an
   injected CLI (the Agents bar as it would really run, a failed or too-old
   harness scan, the embed and tab addresses, binding by address, title or a
   new canvas and refusing a bound folder, enrolment from a preset or
   outright) and over a real loopback server with the SDK's token rule.
2. `npm run build && node scripts/journey-jetski-pane.mjs` — the unbound card,
   *Create*, the frame, *Reload* minting a fresh pass, and the bridge both
   ways (phase 0's proof 2).
3. `npm test` and `npm run typecheck`.

### Trajectory

- **2026-09-28** — `isocan embed --json`'s `canvas` keeps `?embed=1`, because
  it is where an admitted frame goes back to — so *Open ↗* opened a tab with
  its Chat hidden. The pane derives a plain `tab` address instead.
- **2026-09-28** — Model presets enrol standing agents (`rc add --model`)
  rather than launching agentapi conversations: one mechanism for every
  harness, answering @mentions while the person's `isocan rc` runs, instead
  of a second, Jetski-only way to start an agent.
- **2026-09-28** — Open: inside a restarted Jetski, the pill opens the pane,
  the frame loads without a Chat, a selection lights the chips, *Ask* lands
  in the conversation, and a preset enrols with `isocan rc` running. Waits on
  the person ([verify](../../verify/2026-09-28-jetski-plugin.md), steps 5–9).
