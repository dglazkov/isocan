# Talk to the canvas (`@isocan/talk`)

A web module that puts a voice on the canvas: a **floating mic button** that
opens a Gemini Live session from this browser with **your own API key**, and
turns spoken requests into the same operations a click sends — wearing your
identity, your undo, and the same oplog everything else writes.

It is an experiment: off until you switch it on in **Settings → Experiments →
"Talk to the canvas"** (`modules.talk`).

## The two doors

- **The floating mic** (bottom right of the canvas) is the *talking*. One press
  starts a session when a key is stored, one press ends it. While live, the
  button pulses, two level bars show your voice and the model's, and the last
  words float above it — and all of it is gone when the turn is. Nothing pops
  up.
- **⌘K → "Configure voice"** is the *configuration*: the API key, the model
  name, and a test listen with the full captions. It only needs to open on
  first run, or when you want to change something.

**Ctrl-click** (or ⌘-click) on the floating mic opens the configuration even
when a key is stored — the way to switch models without losing the key.

`isocan voice` is the terminal half: it prints where the button is and where
this canvas lives. It writes nothing and holds no key.

## How it works

1. **The key lives in this browser** — `localStorage` under `isocan:voice:key`,
   per origin. It is never sent to the daemon, never written to the canvas,
   never logged. You are billed for what you say, and the key travels nowhere
   you did not put it.
2. **The browser opens the Live socket itself** — `wss://generativelanguage.
   googleapis.com/…/BidiGenerateContent`, direct from the page. The dev server
   and the daemon are not in the loop.
3. **The session is handed the canvas it is standing on** — the setup message
   carries the snapshot ("items with their ids — echo them in tool calls")
   plus the 47 tool declarations, in the one wording the standing voice
   harness sends.
4. **A tool call becomes ordinary operations** — the planner (shared with the
   harness) maps each tool to ops; the module resolves refs against the live
   canvas, mints ids, uploads content through the shell's `host.putBlob`, and
   sends through `host.send` — so the spoken change is exactly a clicked one:
   same identity, same undo group, same daemon.
5. **The read tools answer from the facts the shell handed over** —
   `read_canvas`, `read_item`, `read_threads` never round-trip a server; the
   shell's snapshot already had the answer.

## What is wired

Add notes and pages, rename/update items, move (including "move it right
50"), resize, delete, restore **from the trash**, react, switch versions
(`first`, `last`, a filename, an id), comment on an item, say/ask/notify on
the main thread, draw with the pen tool, and the read tools.

## What is not wired (yet)

`item.addVersion`, the multi-item batch tools, thread anchor/rename/delete
verbs, agent enrolment and the actor/selection tools. A call to any of those
is refused in words — the model is told what happened, and the caption shows
it. Nothing is faked.

## The module rule, honoured exactly

A module may never add an operation, a protocol message, a server route, a
hidden store, or a read of the identity desk. Talk adds none of them: the key
is a string in the browser, tool calls are ordinary ops, and uninstalling the
module leaves nothing that is not already a file or a comment.

## Duplicated, deliberately

`src/live.ts` and `src/audio.ts` are copies of
`packages/voice-agent/src/live.ts` and `voiceAudio.ts` (Paul, 16 Sep 2026) —
the module carries no dependency on the harness package. The harness files
remain the owners; **when either changes, reconcile the copies by hand**.
Both copies say so in their headers.

## Testing

`test/talk.test.ts` drives the tool executor with a fake host: refs resolved
against the canvas (and the trash, for restore), relative moves to absolute
coordinates, version refs to version ids, anchored threads at the item's
spot, `item.add` shaped for a groups canvas, the read tools answered from
facts, and the Blob/ArrayBuffer frame decoder (the bug that once parsed
"[object Blob]").
