# Voice on the Isomorphic Canvas — The Implementation Walk

**11 September 2026.** The implementation walk for [design.md](design.md),
guided by the acceptance criteria in [journey.md](journey.md).

**Where we are, 23 Sep 2026: phases 1–5 are PART-DONE (the 18 Sep reconciliation below); phase 6 is CLOSED — the fast path runs in shadow and Jev agrees with the meant act ~95% of the time on scripted commands. Next: voice-agent phase 7**, the fast path acting, starting with `move`.

**Where we are (reconciled 18 Sep 2026): most of this walk is built, and it was
not built in this order.** The system was re-implemented and landed as
`packages/voice-agent` while this page sat on an unmerged branch still saying
"phase 1 in progress", which is the stale-verdict failure this repo has been
burned by twice. The phase structure below is kept as the argument for the
ordering; the score is in the front matter of [journey.md](journey.md), which is
the one place the roadmap reads, and the divergences are named in
[design.md](design.md#reconciled-against-what-shipped-18-september-2026). Two
corrections a reader would otherwise trip on: the package is
`packages/voice-agent`, not `packages/voice`, and there is no `isocan voice`
verb — `isocan rc` reaches the same file with `--acp`.

**Where it said, on 11 Sep: PHASE 1 IN PROGRESS.**
- Project docset authored: `journey.md`, `design.md`, `phases.md`.
- Provider API audit confirmed: Gemini Live API uses stateful bidirectional WebSockets (PCM16 16kHz in, 24kHz out, synchronous function calling); OpenAI Realtime uses WebSockets/WebRTC (PCM16 24kHz).
- Architectural boundaries locked: Subproject inside `isocan`; daemon/CLI process owns cloud sockets and credentials; mic is client-only; exact existing `Operation` vocabulary; `trash.empty` and canvas deletions strictly forbidden.
- Phase 1 focuses on the provider-agnostic interface, keyless simulation backend, fast-tool mapping, and safety verification.

---

## Phase 1 — Architecture, Provider Seam & Keyless Simulation Backend

**Status: PART-DONE, 18 September 2026.** Re-implemented as `packages/voice-agent`; the seam is Gemini Live only — see design.md's reconciliation.

The foundation: define the provider-agnostic abstraction and build an in-memory
simulation engine so the entire operation pipeline can be tested without cloud
credentials, network egress, or financial spend.

### Doors
1. **Where does the voice package live?**
   *Decision:* As `packages/voice` inside the isocan workspace, depending on
   `@isocan/core` and `@isocan/api`.
2. **How are voice tools defined?**
   *Decision:* Transformed directly from `@isocan/core` operation schemas into
   JSON Schema function declarations.

### Steps
1. Create `packages/voice` workspace with `VoiceBackend` interface and types.
2. Implement `KeylessSimulationBackend`:
   - Simulates streaming speech events and transcript emissions.
   - Dispatches synthetic function calls to verify canvas manipulation.
3. Map fast operations (<50ms) to voice tool declarations:
   - `item.move`, `items.move`, `item.resize`, `item.update`, `item.setCurrentVersion`.
   - `thread.create`, `thread.reply`, `thread.setMain`, `thread.setAnchor`.
   - `actor.setColor`, `actor.setMark`.
4. Implement strict safety filter:
   - Explicit unit assertions that `trash.empty`, `project.delete`, and
     `canvas.delete` are rejected and omitted from tool declarations.
5. Unit and integration tests verifying tool calls execute through
   `CanvasHandle` and produce valid `Operation` records in the oplog.

### Acceptance
- Vitest tests in `packages/voice/test/` pass cleanly.
- Replay test passes: oplog replay reproduces all canvas changes made via
  simulated voice tools without requiring audio streams.

---

## Phase 2 — CLI-Started Voice Companion (`isocan voice`)

**Status: PART-DONE, 18 September 2026.** No `isocan voice` verb: one entry point, the standing server or `--acp` under `isocan rc` — see design.md's reconciliation.

Build the CLI entry point that launches the voice agent as a local process.

### Doors
1. **How is the voice agent started?**
   *Decision:* Via `isocan voice` in the CLI. The command resolves the local
   daemon and canvas using `@isocan/api` (`connect()`), identical to `isocan wait`
   and `isocan rc`.
2. **How does the voice agent appear to other clients?**
   *Decision:* As an active actor in presence (`isocan who`), with a voice badge.

### Steps
1. Register `isocan voice` command in `packages/cli/src/main.ts`:
   - Flags: `--as <name>`, `--provider <simulated|gemini|openai>`, `--model <model>`, `--voice <voice>`.
2. Wire connection through `@isocan/api`:
   - Connects to canvas, emits presence heartbeat.
   - Binds transcript output to `session say` (ephemeral presence updates).
3. Connect `KeylessSimulationBackend` to execute simulated interactive sessions.
4. Add CLI help text and update `packages/cli/src/agent-guide.md`.

### Acceptance
- Running `isocan voice --provider simulated` connects to a running local daemon,
  announces presence, and executes test commands without error.
- Verified in `packages/cli/test/voice.test.ts`.

---

## Phase 3 — Live Cloud Provider Adapters (Gemini Live & OpenAI Realtime)

**Status: PART-DONE, 18 September 2026.** Gemini Live built and verified; the OpenAI Realtime half was designed and not built.

Implement the real-time WebSocket adapters for Google Gemini and OpenAI.

### Doors
1. **Where do API keys live?**
   *Decision:* Read from local environment variables (`GEMINI_API_KEY`,
   `OPENAI_API_KEY`) or local secure config by the daemon/CLI process. Never
   sent to the browser, never written to git, and never logged.
2. **When is cloud voice activated?**
   *Decision:* Cloud activation requires explicit owner approval. Code includes
   mock/keyless modes so default tests and builds never require live keys.

### Steps
1. Implement `GeminiLiveBackend` (`packages/voice/src/gemini.ts`):
   - WebSocket connection to Google Multimodal Live API.
   - Client audio chunk packaging (16kHz PCM16).
   - Server audio parsing (24kHz PCM16).
   - Turn-based synchronous function call handling.
2. Implement `OpenAIRealtimeBackend` (`packages/voice/src/openai.ts`):
   - WebSocket connection to OpenAI Realtime API.
   - Event framing for `input_audio_buffer.append` and `conversation.item.create`.
   - Tool response emission.
3. Socket lifetime management:
   - Handle disconnects and session resumption tokens before the 10–15 min timeout.

### Acceptance
- Unit tests verify WebSocket message framing, serialization, and error recovery
  using mock WebSocket fixtures.
- Live provider test runs only when `ISOCAN_LIVE_VOICE_TEST=1` is explicitly set.

---

## Phase 4 — Browser Audio Client & Presence Synchronization

**Status: PART-DONE, 18 September 2026.** Devices, routing and presence built (`packages/modules/talk`); OPFS session store and the browser-capability surface partly built — journey.md's front matter holds the score.

Add browser microphone streaming and audio playback to the web app over local loopback.

### Doors
1. **How does browser audio reach the daemon?**
   *Decision:* Over a local loopback WebSocket (`ws://127.0.0.1:PORT/api/voice/stream`).
   The browser does not connect to Google or OpenAI directly.
2. **How is microphone consent handled?**
   *Decision:* User must explicitly click the microphone button; browser
   requests `getUserMedia` permissions. Prominent visual indicators show when the
   microphone is active, muted, or stopped.

### Steps
1. Daemon endpoint `GET /api/voice/stream` (WebSocket):
   - Validates localhost Origin and session tokens.
   - Relays raw PCM audio between browser and active `VoiceBackend`.
2. Browser `AudioWorklet` for low-latency PCM capture and playback.
3. Web UI presence integration:
   - Microphone indicator on the emissary agent's card.
   - Real-time display of `session say` ephemeral speech transcripts.

### Acceptance
- Playwright/CDP integration test verifies microphone permission prompt,
  audio stream relay, and presence avatar state transitions.

---

## Phase 5 — Thread Delegation & Decision Readback Protocol

**Status: PART-DONE, 18 September 2026.** Cross-session recall of what was decided is still owed — journey.md's front matter holds the score.

Connect the voice agent to the rest of the canvas ecosystem.

### Steps
1. Implement thread delegation:
   - When a user requests complex work, voice agent calls `thread.reply` with
     `@agent` mentions, waking parked workers on `isocan rc`.
2. Implement decision readback confirmation:
   - Decisions require explicit user verbal agreement before committing a
     formal comment to the thread.
3. End-to-end dogfooding walk:
   - Spoken canvas navigation, item arrangement, design convergence, and
     background task delegation.

### Acceptance
- Full multi-agent interaction demonstrated and replayable from the oplog.

## Phase 6 — Jev listens: the fast path in shadow

**Status: CLOSED, 23 September 2026.** The resolver runs in shadow behind an off-by-default switch and never acts (tested behaviourally and on its source); on 197 scripted Acme commands with the real key Jev agreed with the meant act **94–95%** (held-out hard set 94–97%), escalated ~90% of the complex set, p50 latency 121–219 ms, $0.017 a run — the conductor reran it independently and matched. The microphone walk is `docs/verify/2026-09-23-voice-fast-path-shadow.md`.

Designed 23 Sep 2026 in [fast-path.md](fast-path.md), at Dion's ask: Jev does
the simple spoken commands and the model does the rest.

**Outcome:** the resolver — one Jev call per finished user turn through the
home's `POST /api/judgment`, the questions of fast-path.md (`action`,
`subject`, `relation`, `target`, `simple`) generated from the voice tools and
the canvas projection — runs on every command **and never acts**. Each turn
records the utterance, Jev's answers with their probabilities, what the live
model actually did that turn (its tool calls), and whether that act was undone
within a few seconds. A script turns the record into a report: per action,
agreement between Jev and the model's unreverted act, a reliability curve,
and the threshold at which agreement reaches 95% on at least 30 commands.

**Proof:**

1. Tests of question generation (options from the tools and the canvas; a
   canvas over 255 items escalates) and of the record.
2. **A scripted command set**, since this phase needs no microphone: 120+
   synthetic commands on a synthetic "Acme" canvas — simple moves, aligns,
   resizes, deletes, undo, and deliberately complex ones that must escalate
   ("add a screen that explains returns", "move the red one and then make it
   bigger") — each with the act a person meant, run through the resolver with
   the real key. The report: accuracy per action, the escalation rate on the
   complex set, the reliability curve, measured latency and cost.
3. A `docs/verify/` walk for a person with a microphone, so the shadow record
   also fills from real speech.

### Trajectory

- **2026-09-23** — On commands Jev is *under*-confident (ECE ~0.19; right 98–100% above p 0.7) — the opposite of the wireframe archetypes, so calibration is per question, never borrowed. `move` meets 95%-on-30 at p ≥ 0.60 today; `delete`, `shrink`, `select`, `show` are at 100% but short of n = 30.
- **2026-09-23** — `resize` split into `grow`/`shrink` (Jev chooses, it does not count); numbers and single axes ("300 pixels", "400 by 800") must escalate. Never fast-path: aligns, multi-item acts, "into a group", colour words the canvas does not name, version switches.
- **2026-09-23** — The Jev client moved to `@isocan/core/jev` (a subpath) for its second caller; the wireframe answerer re-exports it.
- **2026-09-23** — Open: the entry chunk grew 79 bytes (two lazy-chunk file names in the entry's preload list), to 728,446 — now 646 over CEILING, joining wireframes phase 5's 567 in the one answer owed to Dion.
- **2026-09-23** — Open: phase 7 must first read, from a real record, whether the transcript finishes before the model's first tool call; if not, it holds the model's calls until Jev answers rather than racing it. The browser `undo` tool is still refused (no web retract) — the fast path's own undo needs that first.

## Phase 7 — The fast path acts

**Status: NOT STARTED.**

**Outcome:** for each action whose phase-6 threshold exists, a command whose
answers all clear it is executed at once through the same tool implementation
the model's call uses (one `Operation`, one undo, the same presence), announced
("moved Login left of Home — say undo"), and the live session told so the model
does not do it again; everything else escalates to the model unchanged. The
thresholds live in data beside the resolver, with the phase-6 numbers that set
them.

**Proof:**

1. Tests: act vs escalate at the thresholds; one op per fast act; the model's
   duplicate tool call dropped; "undo" as a fast act.
2. The scripted set end to end on a local daemon: the canvas after each
   command equals the intended act, escalations untouched, latency of the fast
   path against the model path measured.
3. A `docs/verify/` walk: a person says ten commands out loud and reports
   which felt instant, which escalated, and whether any acted wrongly.
