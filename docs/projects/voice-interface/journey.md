---
status: designed
since: 2026-09-11
see: standing-agents, on-demand, agent-custody
note: registration seed — the full voice-interface docset is drafted on the track branch and pending its own review; no voice implementation exists
---

# Voice interface

**11 September 2026.** Track registration (xsh). Thin on purpose: the full
docset (journey, design, phases) is drafted on the track branch and lands
after its review; this seed registers the project in the roadmap and records
the shape.

The thesis in one line: **ambient, always-connected voice control over the
same workspace operations every other surface speaks.**

## What it is

Voice on the isomorphic canvas: the person talks, the canvas changes — through
the existing Operation vocabulary, not a parallel one. The daemon owns the
provider socket and credentials; the microphone is a client capability; fast
operations run as fast tools, slow work wakes parked agents through the
standing-agents channel.

## Boundaries already decided

- `trash.empty` and canvas deletion are out of the voice vocabulary entirely.
- The provider seam is agnostic (Gemini Live, OpenAI Realtime, and a
  keyless simulation adapter for zero-spend testing).
- The authority rules are [agent-custody](../agent-custody/)'s and
  [standing-agents](../standing-agents/)': the voice surface speaks as the
  actor it is enrolled as, never as the person.

## What is owed

The full docset's review and landing; then the walk. Nothing is built.
