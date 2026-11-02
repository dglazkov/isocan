---
status: designed
since: 2026-09-11
see: iso-api, embed
note: roadmap defined — the WebMCP surface is designed against the verified API and the existing @isocan/mcp vocabulary; design and phases follow the census-informed design
---

# WebMCP co-browsing

**11 September 2026.** Roadmap (#isocan-hsr). Registered thin on purpose: the
bounded existence census (2026-09-11) found the vocabulary and the stdio
transport already built, so this registration links rather than restates, and
the deeper design is owed as a follow-on, not drafted twice.

The thesis in one line: **a browser agent and a human share the same live
canvas session with no bridge, because WebMCP tools run inside isocan's own
page — the page already IS the session.**

## What exists (the census)

- **`@isocan/mcp`** — the canvas as an MCP server over stdio
  ([embed phase 2](../embed/phases.md), read half built 9 Sep 2026): six read
  tools over `@isocan/api`, read-only on purpose, identity = whoever the
  machine already is. The write half waits on addressability, not permission.
  MCP Apps is phase 3, unbuilt.
- **The Operation vocabulary** ([iso-api](../iso-api/)): one
  `Operation` type, one reducer, one route surface — the contract every
  surface imports.
- **The embed four-shape analysis**: page (A), MCP server (B), MCP Apps (C),
  native extension (D). This project is shape B's vocabulary moving into the
  page — shape A's session.

## What this project adds

The BROWSER-NATIVE transport of that vocabulary:
[`navigator.modelContext`](https://webmachinelearning.github.io/webmcp/) —
verified experimental (Chrome 149 origin trial, `#enable-webmcp-testing`,
subject to change; Permissions Policy `tools`; no read-only/destructive
annotation in the spec). Tools run inside the isocan page, which already
holds the human's live session — co-presence is by construction, and the
write half's addressability question gets a different answer per transport:
stdio speaks as the machine; the page speaks as an enrolled agent actor over
the human's own session medium.

## What is owed (in order)

1. The existence census findings become the design's ground: the six read
   tools' schemas, the write half's addressability answer (enrolled actor,
   never the human), the reserved-key line (never `approvals` /
   `toolDirectory` / `journal` / `enrolled` / `assets` / `scripts` /
   `agentConfig`), the undoability tier line, deixis via the ephemeral
   presence channel.
2. design.md — the argument, from that ground.
3. phases.md — the walk, with browser acceptance per phase (origin-trial and
   flag detection; graceful degradation documented).
4. A full journey suite — a deeper draft exists in the lane's working notes
   and is preserved uncommitted in this worktree; it becomes journey.md the
   day the design stops arguing with it.

## Sources

- Web-ML CG draft: webmachinelearning.github.io/webmcp (+ /docs/proposal.html).
- Chrome: developer.chrome.com/docs/ai/webmcp (origin trial 149, testing flag,
  Permissions Policy `tools`, discovery = visit the site directly).
- Distinct from MCP Apps (modelcontextprotocol.org/seps/1865).
