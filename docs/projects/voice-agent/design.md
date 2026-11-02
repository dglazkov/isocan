# Voice on the Isomorphic Canvas — Architecture & Design

**11 September 2026.** Design specification. Companion to [journey.md](journey.md)
(the acceptance criteria) and [phases.md](phases.md) (the implementation walk).

The thesis in one line: **Voice is an input surface over the existing operation
vocabulary, not a second vocabulary or a separate protocol.** Every spoken action
produces the exact same `Operation` a mouse click or CLI command would mint,
reducing through the single engine into the shared replayable oplog.

---

## Reconciled against what shipped, 18 September 2026

**This design was written on 11 Sep and the system was then re-implemented and
landed without it.** The thesis held — voice is an input surface over the
existing operation vocabulary, and every spoken action still mints the same
`Operation` a click would. The mechanisms moved. Section 1 below is left exactly
as it was written, because a dated provider audit is only worth what its date
says; the corrections are here rather than folded into it.

| This document said | What main does | Decided by |
| --- | --- | --- |
| The package is `packages/voice`, a `VoiceBackend` interface with a `KeylessSimulationBackend` | `packages/voice-agent` (`@isocan/voice-agent`), plus a browser module at `packages/modules/talk` (`@isocan/talk`) which carries its own deliberately duplicated copy of `live.ts` | `packages/voice-agent/package.json`; the copy is documented in the header of `packages/modules/talk/src/live.ts` |
| Started with `isocan voice` | There is no such verb. One entry point, two modes: no flags is the standing server, `--acp` is the adapter `isocan rc` spawns. The source comment gives the reason — two entry points would be two things that had to agree about the port, the home, the identity and the page | `packages/voice-agent/src/cli.ts:1-27` |
| Audio up in `realtimeInput.mediaChunks` | `realtimeInput.audio`. `mediaChunks` is marked deprecated in `ai.google.dev/api/live`, and the source says this tree once carried it by accident | `packages/voice-agent/src/voice-harness.ts:1805-1809` |
| Model `gemini-2.0-flash-exp` | `models/gemini-3.8-live`, and the model is a stored preference with a live list plus free text for betas, validated by the provider rather than by membership of the list | `packages/voice-agent/src/live.ts:118` |
| Audio out at 24 kHz | Still 24 kHz from the provider, then resampled to whatever rate the device's `AudioContext` actually runs at — the resampler is not in this design at all, and its absence was a real bug (a 44.1 kHz context answered 98% zeros) | `packages/voice-agent/src/voiceAudio.ts:345,476,496` |
| Phases 1… as the walk | Most of it is built. See the front matter of [journey.md](journey.md) for the score, kept there so it cannot drift from the page the roadmap reads | `docs/projects/voice-agent/journey.md` |

Built and not described here at all, because it was learned while building: the
permission gate and `open_url`; local files and memory asked of the page over the
socket rather than held by the harness, with memory in the page's OPFS store;
input **and** output device selectors with the reply routed through Web Audio; an
editable system prompt behind the same cog; a transcript persisted to
`~/.isocan/voice/log.json` that survives a harness restart; a one-use pass and an
`/open` redirect for bringing somebody else in; and a readiness gate that holds
audio until the provider's own `setupComplete` rather than until the socket is
open, with the frames the gate refuses counted rather than lost in silence.

**Still owed, and tracked:** cross-session recall of what was decided, session
state in OPFS rather than only memory, the browser-capability surface (camera,
screen capture, on-device models), create and rename for actors and projects, the
pass/operator flow stealing focus and performing a destructive action on a GET,
strict whole-versus-chunked resampler equality, and the OpenAI Realtime half of
the provider seam — designed below, never built.

---

## 1. Provider Facts & Official API Audit (Dated: 2026-09-11)

To ensure this architecture rests on verifiable platform reality rather than
historical assumptions or outdated notes, both real-time audio APIs were verified
against current official vendor documentation on 2026-09-11:

### 1.1 Google Gemini Multimodal Live API
- **Official Documentation:**
  - Guide: `https://ai.google.dev/gemini-api/docs/live-api` (retrieved 2026-09-11)
  - WebSocket Protocol: `https://ai.google.dev/gemini-api/docs/live-api/get-started-websocket` (retrieved 2026-09-11)
- **Models:** `gemini-2.0-flash-exp` (supporting real-time bidirectional multimodal audio, video, and text).
- **Transport:** Stateful, bidirectional **WebSocket** over TLS.
  `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent`
- **Audio Inbound:** Raw Linear PCM, 16-bit little-endian, mono, **16 kHz** (`audio/pcm;rate=16000`), packaged as base64 in `realtimeInput.mediaChunks`.
- **Audio Outbound:** Raw Linear PCM, 16-bit little-endian, mono, **24 kHz** (`audio/pcm;rate=24000`) in `serverContent.modelTurn.parts`.
- **Session Duration & Resumption:** Active connection limit is ~10–15 minutes of continuous audio. Session resumption tokens (`sessionResumptionToken`) issued by the server allow reconnecting without losing conversational context within a 2-hour window.
- **Function Calling:** **Synchronous within the turn.** The model halts audio generation upon emitting a `toolCall` (`functionCalls: [{ id, name, args }]`) and waits for a corresponding client `toolResponse` (`functionResponses: [{ id, name, response }]`) before generating its vocal response.
- **Correction on WebRTC:** Gemini Multimodal Live API uses **WebSockets**, not WebRTC. Assertions assuming native Gemini WebRTC media tracks in the browser are incorrect for the Live API.

### 1.2 OpenAI Realtime API
- **Official Documentation:**
  - Realtime Guide: `https://platform.openai.com/docs/guides/realtime` (retrieved 2026-09-11)
  - WebSocket API: `https://platform.openai.com/docs/guides/realtime-websocket` (retrieved 2026-09-11)
  - WebRTC API: `https://platform.openai.com/docs/guides/realtime-webrtc` (retrieved 2026-09-11)
- **Models:** `gpt-4o-realtime-preview` and `gpt-4o-mini-realtime-preview`.
- **Transport:** Stateful, bidirectional **WebSocket** (`wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview`) for server-side integration; optional client-side WebRTC via ephemeral tokens minted by a backend server via `POST /v1/realtime/sessions`.
- **Audio Inbound & Outbound:** Raw Linear PCM, 16-bit little-endian, mono, **24 kHz** (`audio/pcm;rate=24000`), packaged as base64 in JSON event frames (`input_audio_buffer.append`). Also supports G.711 (PCMU/PCMA) at 8 kHz.
- **Function Calling:** Event-driven function calling (`response.function_call_arguments.done` triggering client `conversation.item.create` with `function_call_output`, followed by `response.create` to prompt speech).
- **Session Lifetime:** Connection is persistent while active; configured dynamically via `session.update` events.

### 1.3 Keyless Simulation Provider
- **Transport:** In-memory loopback and synthetic audio/event generator.
- **Purpose:** Full functional verification of operation minting, presence updates, and thread dispatch without cloud dependencies, API keys, or financial spend.

---

## 2. Core Architectural Principles

```
┌─────────────────────────────────────────────────────────────────────────┐
│ BROWSER (Client Audio Terminal)                                         │
│ • Captures microphone input (PCM16 16kHz/24kHz via AudioWorklet).       │
│ • Explicit user gesture for mic start; prominent LIVE / MUTE / STOP UI. │
│ • Streams raw audio to local daemon over loopback WebSocket.            │
│ • Plays synthesized agent speech received from local daemon.            │
│ • ZERO provider credentials; ZERO direct cloud WebSocket connections.   │
└────────────────────────────────────▲────────────────────────────────────┘
                                     │ local ws://127.0.0.1:PORT/api/voice/stream
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ LOCAL DAEMON / CLI PROCESS (The Host & Authority)                       │
│ • Holds cloud credentials (GEMINI_API_KEY / OPENAI_API_KEY).            │
│ • Maintains stateful provider WebSocket (Gemini Live / OpenAI Realtime).│
│ • Normalizes audio frames (resampling 16kHz ↔ 24kHz).                   │
│ • Evaluates Function Calls directly via @isocan/api CanvasHandle.       │
│ • Executes Operations (engineering target: <50ms) into daemon engine.   │
│ • Dispatches slow work to parked agents via thread comments.            │
└────────────────────────────────────▲────────────────────────────────────┘
                                     │ TLS WebSocket wss://...
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ MODEL PROVIDER (Gemini Live / OpenAI Realtime)                          │
│ • Streaming Speech-to-Speech + Realtime Voice Activity Detection (VAD). │
│ • Emits toolCall with operation parameters.                             │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Subproject Location: Inside isocan, CLI-Started
- The voice interface lives as a subproject inside the isocan repository (`packages/voice` or `packages/cli/src/voice`), reusing `@isocan/core` and `@isocan/api`.
- It is launched as a process by the user (`isocan voice`), **never** automatically started by a website. The user owns process lifetime, port bindings, and audio floor control.

### 2.2 The Socket Belongs to the Daemon, Not the Browser
- Putting the provider WebSocket in the browser would violate isocan's isomorphism: it would make voice a web-only feature and bypass the daemon's single-writer architecture.
- In this design, the daemon (or CLI process) holds the cloud WebSocket connection and manages API keys securely.
- Microphones and speakers are client capabilities. The browser (or terminal audio client) streams raw PCM chunks over loopback to the daemon.
- **Security & Privacy:** API keys never cross into browser JavaScript, browser storage, or console logs. The loopback WebSocket enforces localhost origin and CSRF validation.

### 2.3 Operation Integrity: No Second Vocabulary
- Spoken instructions must translate into the exact same `Operation`s defined in `@isocan/core/ops.ts`.
- **Replay Invariant:** A voice session must be completely reconstructible from its oplog without audio recordings. If an action cannot be expressed as an `Operation`, it does not belong on the canvas.

### 2.4 The Fast-Tool vs. Slow-Thread Split
Function calling in real-time voice models pauses conversation audio until the client sends a response. Therefore:
- **Fast Tools (Engineering Target: <50ms local execution):** Actions that execute
  instantaneously in the local engine run as synchronous function calls.
  - `item.move`, `items.move`, `item.resize`, `item.update` (retitle, star, properties).
  - `item.setCurrentVersion` (instant spoken convergence).
  - `item.delete`, `item.restore` (soft trash transitions).
  - `thread.create`, `thread.reply`, `thread.setMain`, `thread.setAnchor`.
  - `actor.setColor`, `actor.setMark`.
- **Slow Tasks (Background Compute):** Tasks that require seconds or minutes (e.g. generating a screen, running a build, executing tests) are **never** synchronous tool calls.
  - The voice agent acknowledges immediately: *"Asking Gina to build the checkout screen."*
  - The voice agent posts a comment to the relevant card thread: `thread.reply(threadId, "@Gina please build...")`.
  - Parked agents listening on `isocan wait` or `isocan rc` wake up and execute asynchronously.
  - The voice conversation remains completely unblocked.

### 2.5 Strict Safety Fences
To prevent voice-prompt injection or accidental destructive acts:
- **`trash.empty` is NEVER exposed** as a voice tool (it is irreversible).
- **`project.delete` and `canvas delete` are NEVER exposed** as voice tools.
- Any attempt to invoke destructive deletions receives an explicit refusal directing the user to the CLI or authenticated dashboard.

### 2.6 Three-Tier Trace Policy
Raw conversation transcripts must never flood the project's permanent thread:
1. **Live Utterances (Ephemeral):** Streamed into Presence as `session say` under the speaker's avatar. Visible to the room in real time, leaves zero operations in history, and evaporates when speech stops.
2. **Decisions (Read-back first):** Important decisions are read back by the voice agent (*"So we are choosing Option B; should I record that?"*). Only upon verbal confirmation does the agent write a single summary comment to the thread.
3. **Actions (Durable):** Every mutation is recorded as an `Operation` in the canvas oplog.

### 2.7 One Microphone, One Floor
- Multiple agents listening to one microphone simultaneously creates competing voice-activity detection (VAD), billing race conditions, and unsteerable audio output.
- **Exactly one voice emissary holds the floor** per room at any time. Other personas stay parked on `wait` and are invoked via thread mentions.

---

## 3. The Provider-Agnostic Interface

A thin abstraction seam decouples the canvas operation logic from provider specifics:

```typescript
export interface VoiceMessage {
  type: "text" | "audio" | "tool_call" | "tool_response" | "interrupt";
  data?: unknown;
}

export interface VoiceToolDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface VoiceBackend {
  readonly id: "gemini" | "openai" | "simulated";
  connect(options: {
    voiceName?: string;
    systemInstruction?: string;
    tools: VoiceToolDeclaration[];
    onAudioOut: (pcm24k: Uint8Array) => void;
    onTranscript: (speaker: "user" | "agent", text: string) => void;
    onToolCall: (call: { id: string; name: string; args: Record<string, unknown> }) => Promise<Record<string, unknown>>;
    onInterrupt?: () => void;
  }): Promise<void>;

  sendAudioChunk(pcm16k: Uint8Array): void;
  sendTextMessage(text: string): void;
  disconnect(): Promise<void>;
}
```

- **`GeminiLiveBackend`:** Wraps Google's BidiGenerateContent WebSocket. Converts incoming PCM 24kHz to client output and packages 16kHz client audio into media chunks.
- **`OpenAIRealtimeBackend`:** Wraps OpenAI's Realtime WebSocket. Maps `session.update` tools and handles `input_audio_buffer.append`.
- **`KeylessSimulationBackend`:** Generates deterministic synthetic events and audio frames, permitting comprehensive end-to-end integration testing in CI without API keys.
