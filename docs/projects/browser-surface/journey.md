---
status: designed
since: 2026-09-11
see: embed, multiuser, standing-agents, inception
note: registration seed — the full browser-surface docset is drafted on the track branch (8973ae18) and pending its own review; roadmap defined, nothing built
---

# Browser surface

**11 September 2026.** Track registration (isocan-chf.1). Thin on purpose:
the full docset is drafted on the track branch (8973ae18), pending its
review; this seed registers the project and its ground, with the three
calibrations the full docset carries stated here too.

The thesis in one line: **isocan as a Chrome extension — a bidirectional
spatial tab strip and a browser agent sharing one trusted session, driven
through the ACP control loopback.**

## What it is

The browser becomes a canvas surface: tabs as items, the agent driving a
real Chrome through the ACP control loopback, and trusted multiplayer
co-browsing. Three calibrations from the full docset, stated here so the
seed and the docset agree:

- **The browser-side ACP server adapter is [PROPOSED and
  unimplemented](https://github.com/dglazkov/isocan/blob/main/packages/cli/src/acp.ts).**
  The census confirms the ACP 1 client in
  [`packages/cli/src/acp.ts`](https://github.com/dglazkov/isocan/blob/main/packages/cli/src/acp.ts)
  is built (`session/new`, `session/prompt`, `session/update`,
  `session/load`, resumable sessions) — but the adapter that would vend
  browser control sessions to standing agents does not exist yet.
- **The sharing design must not replicate the owner's cookie jar or
  credentials to guests.** Guests can still see sensitive rendered or DOM
  content and cause authenticated actions through the owner's browser;
  explicit tab/action grants and revocation are separate from isocan's
  existing CHIPS badge partitioning
  ([`packages/server/src/badges.ts:117–154`](https://github.com/dglazkov/isocan/blob/main/packages/server/src/badges.ts),
  `SameSite=None; Secure; Partitioned`, built for [embed](../embed/phases.md)
  iframes).
- **Nested canvases are already implemented** —
  [`packages/core/src/canvasitem.ts`](https://github.com/dglazkov/isocan/blob/main/packages/core/src/canvasitem.ts)
  via `properties.kind === "canvas"` and `canvasitemOf`, partly built in the
  [inception](../inception/) project. The design extends that mechanism
  rather than inventing a fresh kind.

## What is owed

The full docset's review and landing; then the design's deep pass. Nothing
is built.
