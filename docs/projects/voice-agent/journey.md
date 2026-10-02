---
status: partial
since: 2026-09-11
see: iso-api, on-demand, modules
note: Designed 11 Sep as `voice-interface`, shipped as `packages/voice-agent` plus the browser module `packages/modules/talk`, and reconciled against the shipped source 18 Sep. These journeys were the acceptance criteria. Built and verified — join by pasted address or pass, the stored daemon preference, the model selector with free text and provider validation, input and output device selectors with Web Audio routing, local files and memory over a granted directory. Partly built — history and recall, OPFS as the session store, the browser-capability surface, actor and project management. Open — the pass/operator focus and destructive GET, strict resampler equality, and the browser-driven evidence capture. The provider seam is Gemini Live only; the OpenAI Realtime half was designed and not built. 30 Sep: the fast path acts — Jev carries out a simple spoken move at once, through the same executor as the model, behind an off-by-default switch, and saying "undo" in the browser now retracts; the microphone walk is owed.
---
# Voice on the Isomorphic Canvas — the journeys

> **Reconciled 18 September 2026, and still the acceptance criteria.** This page
> was written on 11 Sep for a package that was then called `packages/voice` and
> started with `isocan voice`. What shipped is `packages/voice-agent`
> (`@isocan/voice-agent`), reached by `isocan rc` through the harness registry,
> plus a browser module at `packages/modules/talk`. The journeys below were kept
> as written — a journey says what a person experiences, and that did not change
> — but the mechanism each one implies moved, and
> [design.md](design.md#reconciled-against-what-shipped-18-september-2026) names
> every divergence with the file and line that decides it. Read the journeys as
> the acceptance suite and the front matter as the score.

**11 September 2026.** The ideal, written as user journeys.
[design.md](design.md) argues the mechanism; [phases.md](phases.md) orders
the work and parks its decisions. Each journey here is an acceptance test:
a phase that claims one closes only when you can walk it, for real, on a
real canvas. Journeys describe what you experience, not how it works —
where a journey seems to force a mechanism, the mechanism is what bends.

**You** are a designer or engineer working on an isocan canvas. **Charlie**
is the active voice emissary in the room — an enrolled agent whose voice
holds the floor. **Gina** is an implementation agent parked on `isocan rc`.

**`isocan voice`** is the command-line companion you launch: a long-running
process running on your machine, connected to the local daemon and the
canvas over the existing operation and presence channels. The daemon holds
the provider connection and credentials; your microphone and speaker are
local client capabilities.

---

## Journey 1 — Bring a voice agent onto the canvas

*One command in the terminal; a voice appears in the room and on the canvas.*

1. In your project directory, with your local daemon running:
   ```bash
   isocan voice --as Charlie
   ```
   Or explicitly selecting the provider backend:
   ```bash
   isocan voice --as Charlie --provider gemini
   ```
2. In the web app, Charlie's avatar lights up in the presence bar with an
   active microphone badge (`isocan who` in another terminal shows
   `Charlie (voice, live)`).
3. Charlie speaks a brief greeting through your speaker: *"I'm on the canvas.
   What are we looking at?"*
4. No browser extension, no third-party plugin, and no API keys pasted into a
   web form. The process runs locally under your control.

---

## Journey 2 — Direct canvas manipulation without touching the mouse

*Fast, spoken manipulation that produces ordinary, undoable operations.*

1. You speak naturally: *"Move the checkout card to position two hundred, four hundred."*
2. Under Charlie's face in the web app, a transient presence status appears:
   `session say: "moving #Checkout…"` — ephemeral text that costs no operation
   and leaves no clutter in the permanent log.
3. The checkout card glides to `(200, 400)` on the screen.
4. On your screen or CLI, hit `⌘Z` or type `isocan undo`. The card returns to
   its previous position. Spoken acts produce standard `Operation`s
   (`item.move`); they are indistinguishable from clicks or CLI commands.
5. Charlie responds concisely: *"Moved."*

---

## Journey 3 — The spoken convergence gesture

*Resolving design divergence in a single sentence.*

1. An agent has explored three alternative navigation cards on the canvas
   (`item.addVersion` created v1, v2, and v3).
2. You look at the second version: *"Keep the second version of the nav card."*
3. Charlie immediately executes `item.setCurrentVersion`.
4. The canvas updates instantly to display v2 as the canonical version.
5. What previously required opening an item drawer, inspecting versions, and
   clicking through confirmation dialogs happened as a one-second spoken
   sentence.

---

## Journey 4 — Deictic referencing using shared presence and selection

*Talking about "this" and "that" without naming filenames or coordinates.*

1. You click and drag across three screen cards on the canvas. Your selection
   is published as shared presence state (`PresenceSession.selection`).
2. You speak: *"Align these along the top edge."*
3. Charlie resolves *"these"* directly from your active selection:
   reads the bounding boxes of the three selected items, computes the minimum
   `y` coordinate, and submits an `items.move` operation.
4. All three cards align cleanly along the top edge in under 100 milliseconds.
5. Charlie: *"Aligned to top."*

---

## Journey 5 — Delegating heavy work without blocking the voice floor

*Slow tasks are dispatched to parked agents via threads, keeping voice responsive.*

1. You: *"Ask Gina to rebuild the payment card to include Apple Pay."*
2. Building a full interactive screen is slow work (dozens of seconds of code
   generation and test execution). Charlie does **not** stall the audio
   stream on a blocking tool call.
3. Charlie replies immediately: *"I've asked Gina to update the payment card."*
4. Under the hood, Charlie creates a comment on the payment card's thread:
   `thread.reply(threadId, "@Gina please update this screen to support Apple Pay")`.
5. Gina (parked on `isocan rc`) wakes up via the standard inbox mechanism,
   announces her presence on the thread, and begins building in the background.
6. Meanwhile, your voice session with Charlie remains live and uninterrupted.
   You continue discussing copy and layout while Gina's work lands as a new
   version branch.

---

## Journey 6 — Consensus, read-back, and durable records

*Conversation is ephemeral; decisions are verified before they become comments.*

1. You and Charlie discuss typography options for ten minutes.
2. Charlie does not pollute the canvas thread with transcripts of every utterance.
3. When the discussion resolves, Charlie initiates a read-back:
   *"So to confirm: we're switching the primary heading to the slab serif,
   and moving all data labels to the monospace font. Shall I post that to the
   spec thread?"*
4. You say: *"Yes, post that."*
5. Charlie posts a single, structured summary comment to the canvas thread:
   `thread.reply(threadId, "Decision: heading to slab serif, data labels to monospace.")`.
6. A teammate checking the canvas tomorrow reads one clear decision comment,
   rather than wading through two hundred lines of raw chat transcripts.

---

## Journey 7 — Safety boundaries and excluded verbs

*Destructive operations are refused by construction.*

1. You say: *"Empty the trash and delete this project."*
2. The voice agent's tool declaration deliberately omits `trash.empty`,
   `project.delete`, and `canvas delete`. The model has no tool definition for
   irreversible actions.
3. Charlie responds: *"Irreversible deletions cannot be commanded by voice.
   Please use the CLI or project dashboard with explicit confirmation."*
4. The canvas state remains completely protected.

---

## Journey 8 — Keyless simulation and multi-provider selection

*Developing and verifying voice interaction without cloud credentials or material spend.*

1. On a machine without active cloud billing credentials or during automated CI:
   ```bash
   isocan voice --provider simulated
   ```
2. The simulation engine connects to the canvas, provides synthetic audio
   loopback, parses test speech fixtures, and verifies that operations,
   transcripts, and presence updates execute with 100% fidelity.
3. When authorized with valid local credentials (`GEMINI_API_KEY` or
   `OPENAI_API_KEY`), switching to live cloud voice is a single flag:
   ```bash
   isocan voice --provider gemini --model gemini-2.0-flash-exp
   ```
   Or:
   ```bash
   isocan voice --provider openai --model gpt-4o-realtime-preview
   ```
4. Keys are read securely from local environment variables or credential stores
   by the daemon process and are never logged, committed, or transmitted to the
   browser.
