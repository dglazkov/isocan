# Research

Findings that took longer to reach than they take to read — surveys, format
evaluations, and readiness assessments. Each one is a markdown file here (the
durable, greppable copy) and a designed write-up behind a link (the version to
send someone).

The rule for this directory: **write down what was measured, not what was
assumed.** Every number in here came from an API, a converter, or a test run on
the day it is dated. Where something is inference rather than evidence, it says
so.

| Date | Research | What it found |
| --- | --- | --- |
| 24 Aug 2026 | [Design systems and tokens](2026-08-24-design-systems-and-tokens.md) | Nobody renders DESIGN.md — not Google, whose format it is, and not the 110k-star library of DESIGN.md files, which ships 74 files and no viewer — so `DesignSystemView` sits in an empty spot. But measured against the official 2025.10 JSON Schema and Google's own reference exporter, `isocan design --tokens` does not emit what its help text promises: colours must be `{colorSpace, components}` objects and dimensions `{value, unit}`, and isocan's hex strings pass the schema only because the published schema never applies a group's `$type` to its leaves. `fromDtcg` reads 0 of 20 colours back out of a real W3C file and turns spacing into `[object Object]`; it is also unreachable from either surface. And the 74-file corpus run through `design check` gives 308 errors across 42 files, of which 295 are isocan rejecting valid input — compound references, YAML block scalars, `rgba()`. All of it is pure functions in core: zero operations, both surfaces at once. |
| 23 Aug 2026 | [Agents on the canvas](2026-08-23-agents-on-the-canvas.md) | A year of canvas releases (Figma, Miro Canvas 26, tldraw fairies, Framer 3.0, MagicPath 2.0, Excalidraw+) all shipped the same thing — the canvas as a surface agents read and write, via MCP plus a skill — and all shipped divergence without convergence. isocan already has the going-wide half (`/variation` makes named sibling alternatives with `parent`, and says which it would keep); what it has no operation for is *this one won*. Edges stay unrecommended: the answer to diagrams is a Mermaid item, which costs zero ops, and the only edge model worth the cost is execution semantics, which `wait --item/--op` already provides. |
| 22 Aug 2026 | [JSON Canvas](json-canvas.md) · [full](https://claude.ai/code/artifact/e764ed1d-0d76-426f-8667-8aff6b648ef2) | The open canvas format's coordinate model is ours exactly, and a real conversion of a working canvas keeps 12 of 12 rectangles while dropping 26 versions, 6 threads, 48 comments and 5 actors — 2,173 bytes against 54KB of state and 94KB of history. A good export, a bad storage format. Underneath it: whether we want edges at all, which is a product decision and not a format one. |
| 22 Aug 2026 | [Agent skills](agent-skills.md) · [full](https://claude.ai/code/artifact/a380ba2c-2cbe-44dc-b3b4-ef0a3ae2b38b) | A survey of the most-starred skill repositories. Four worth importing today (all MIT, one line each), four worth reading, and the directories worth pointing `/skill find` at rather than installing. The official set — 171k stars — has no licence file at all. And the observation underneath: every repo on that leaderboard is a file that changes agent behaviour, and not one has anywhere for the work to land. |
| 21 Aug 2026 | [Feature readiness](feature-readiness.md) · [full](https://claude.ai/code/artifact/2754aec1-01e6-4543-bcda-657ff925ed5a) | Eighteen proposed features graded by what blocks them. Ten need nothing from authentication; three are blocked entirely by it. The finding that reorders the list: the multiuser era was built and wound back (`ae3d227..b2b9f6e`, reverted by `cba0a78`), and the property that design could not escape is that a shared canvas only exists while one laptop is open. |

Day-to-day work is not research: what shipped and why lives in
[`docs/changelog/`](../changelog/), a page per day.

## Adding to this

Date it, say what was measured and how, and link the full version if there is
one. Research that cannot be checked a month later is an opinion with a
timestamp.
