# Anatomy port: implementation phases

Plan completed 11 September 2026 before implementation, on branch `anatomy`.
Read [analysis.md](analysis.md), then [design.md](design.md).

**Where we are:** phases 1–5 built and verified, 11 September 2026, on branch `anatomy`.
The plan below was completed before implementation; acceptance evidence is
collected in [verification.md](verification.md).

## 1. Built — File model and portable graph

Build the module package, strict import/body validation, canonical field
mapping, graph reconstruction, deterministic non-overlapping layout, native
edge contribution and core context. Support fresh projects and prototype JSON
import/export, including checkpoints, optional assessments, historical
comments and mocks. Add CLI create/import/export/list/show/layout.

Gate: synthetic round trip preserves graph content; duplicate/dangling/cyclic
graphs are rejected before writes; two imports cannot cross-link; unrelated
canvas items survive. Native rename/move and removal fallback work.

## 2. Built — Workspace API and native Blueprint

Add proposed workspace registration, routing/launcher integration, host read
and navigation capabilities, native selection facts, optional item renderer
facts, and stage bounds measured from the workspace's native canvas slot.
Build concept/project cards and hierarchy/inspector chrome with collapse,
search, focus and native comments. Keep one canvas and one socket.

Gate: browser-driven tree→card and card→inspector selection, drag, pan/zoom,
sidebar collapse, Back, input shortcuts, and read-only handling. Existing
module pages/renderers remain compatible. Runtime build declares proposals.

## 3. Built — Exploration lenses and edits

Build Overview, Open Decisions and Coverage; goal/brief editing, concept
creation/editing, resolution options, evidence preview and explicit source
attachment. Add matching CLI verbs and shared write helpers. Unknown discipline
assessment remains unknown. Preserve source snippets when source bytes have
not been attached.

Gate: CLI edits update the live UI; UI edits read identically through CLI;
one Undo reverses each edit; coverage does not invent reviews; user-provided
text is escaped and arbitrary source URIs do not execute.

## 4. Built — Evolution and proposals

Checkpoint save, preview/export and explicit project-scoped restore. Mock
proposal, sandboxed preview, promotion to an ordinary source item. Native
discussion in the inspector, imported discussion labelled historical. Complete
CLI parity and agent guide, reusing normal wait/history/presence rather than
another notification protocol.

Gate: restore leaves unrelated items intact and can be undone; a proposal
cannot escape its frame; promotion updates source coverage and is undoable;
no imported activity is shown as current agent presence.

## 5. Verified — Integration and handoff

Run meaningful reducer/round-trip and CLI integration tests, runtime module
build, the complete `npm test` and `npm run typecheck`, production web build,
and a real-browser journey on a disposable canvas using synthetic data. Check
small-window layout, text overflow, empty state, and module removal boundary.
Update README, module authoring docs, project index and the day's changelog.

Gate: report the commands and browser interactions actually verified; leave a
reviewable branch and working preview, with limitations stated precisely.
