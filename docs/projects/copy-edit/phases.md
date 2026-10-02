---
status: partial
since: 2026-10-02
see: wireframes, version-diff
note: "the walk: two bugs, the copy deck, copy variants, compare and mix, fit and voice, wire-time voice, evidence."
issue: 377
---

# A deep copy edit — the walk

**2 October 2026.** Held to [journey.md](journey.md); the design is
[the research note](../../research/2026-10-02-copy-edit.md).

**Where we are, 2 Oct 2026: phases 0 and 1 are CLOSED; phase 0.5 is PART-DONE — the route is built and refuses in words until isocan.io has a text-model key (Dion's). Next: copy-edit phase 2, copy variants.**

Rules for every phase, on top of `AGENTS.md`:

- **No new op type.** Variants are `parent=` variations; a pick is the existing
  converge; a mix is one `item.update`/version.
- **Words only.** Anything that changes a variant's markup outside its text is a
  bug, and a test says so byte for byte.
- **Walked.** Each phase from 1 on ends with a journey in `scripts/journeys.mjs`
  or a real-daemon CLI test, named in its proof.
- **Text generation through `TextGenerator`** (`core/src/jev.ts`); the stub in
  tests; never a key in the browser.

## Phase 0 — A content edit writes words

**Status: CLOSED, 2 October 2026.** `wire edit --kind content` — from the CLI and from Jev's planner — now sends the instruction to the text generator as a request about one slot's words, validated by the copy schema, and can no longer write the instruction itself as text.

**Outcome:** `wire edit --kind content` calls the text generator and writes
words for the slot, never the instruction itself (`edit.ts:358`).

**Proof:** tests that the instruction never lands as text, that a planned
content edit calls the generator once with a one-slot schema, and that a
greedy answer is refused; `npm test`, typecheck.

### Trajectory

- **2026-10-02** — Re-cut: the plan had the web `/wire copy`/`name` fix in this phase, but the browser has no route to any text model — the home's only door is the Jev judgment route, typed questions only. The fix needs a route, so it became phase 0.5.

## Phase 0.5 — A generator the browser can reach

**Status: PART-DONE, 2 October 2026.** `POST /api/text` is built on the daemon and the home with Claude and OpenAI-shaped providers, every refusal and the key-never-leaks rule proved against a real daemon; it waits on a text-model key on isocan.io, which is Dion's decision.

**Outcome:** `POST /api/text` on the daemon and the home (`TEXT_ROUTE` in
core beside `JUDGMENT_ROUTE`): a JSON-schema text completion for a badge that
may edit the canvas, size-checked and rate-limited per badge, forwarded to the
home when this daemon has no key (as judgment is), refusing in words
(`text-unavailable`) when nobody has one. `TextGenerator` gains a Claude route
beside the OpenAI-shaped one. The wireframe module's web path (`/wire copy`,
`/wire name`, `/wire edit` content) uses it through `DialogHost.generate`, in
the lazy dialog chunk.

**Proof:** a route test with a fake provider (refusal without a key, a
non-editor refused, the key never in a response or error); a dialog test that a
configured `host.generate` is called; `npm test`, typecheck.

⚑ **Provision:** a text-model key on isocan.io (`ISOCAN_TEXT_API_KEY`, and
which provider) is Dion's decision; until then the route refuses in words and
the browser keeps the stub.

### Trajectory

- **2026-10-02** — The route's path lives in a core subpath (`@isocan/core/text`), not beside `JUDGMENT_ROUTE` in modules.ts: there it cost the entry 14 bytes, shared 33; read only by the lazy dialog chunk, the entry stays 701,285.
- **2026-10-02** — `/api/judgment` moved beside `/api/text` in `model-routes.ts`: one more registration line put `registerRoutes` past its agreed size, and the two routes that spend the home's keys belong together.
- **2026-10-02** — Claude is the default when the key is `sk-ant-…` (model `claude-opus-5-5`, `effort: low`, per the claude-api guidance), raw `fetch` rather than the SDK because core loads in the browser and the lockfile is someone else's.
- **2026-10-02** — Open: a text-model key on isocan.io (`ISOCAN_TEXT_API_KEY`, and the provider) — Dion's. Until then the browser fills placeholder words and says so once.
- **2026-10-02** — Open: 30 completions per badge per minute will bind phase 2 (N voices × M screens); batch or raise it with a stated reason there.

## Phase 1 — The copy deck

**Status: CLOSED, 2 October 2026.** `isocan words <item>` reads any screen's strings with roles and stable addresses, and `--apply` changes words only as one version, refusing a stale string by name — proved byte for byte in core and against a real daemon for plain HTML and wireframes, with undo.

**Outcome:** a pure core `copyDeck(html)` → strings in reading order with role,
address (wire `data-wf` where present, else the element path the WYSIWYG splice
uses, checked by current text) and, where measured, a budget; `isocan words
<item> [--json]`; `isocan words <item> --apply deck.json` splicing text only,
refusing a stale address, one version.

**Proof:** core tests over wire and plain HTML (roles, addresses, a stale
refusal, markup byte-identical outside text); a CLI test of read and apply.

### Trajectory

- **2026-10-02** — `isocan copy` was taken ("copy items"), so the deck shipped as `isocan words`; phase 2 is `isocan words vary`. The docs were renamed with it.
- **2026-10-02** — A wireframe's rendered text is not its words (one row draws three words joined by " · "), so a wire deck is addressed by `wire copy` word paths from the embedded spec and written by the module (`writeWireCopy`), never spliced. Plain HTML uses the WYSIWYG splice's ordinals; a test holds the two walks equal.
- **2026-10-02** — The CLI gained a per-kind copy writer hook (`CliModule.copy`, beside `templates`): plain HTML is spliced by the CLI, a wire deck routed to its module.
- **2026-10-02** — Open: the web's WYSIWYG text edit splices a wire screen's HTML without updating its embedded spec, so the next re-render (restyle, flesh) silently reverts it. A bug beside this phase, not in it.
- **2026-10-02** — Open: `--by` on plain HTML has nowhere to live (a version has only `createdBy`); it is said in the receipt only.

## Phase 2 — Copy variants

**Status: NOT STARTED.**

**Outcome:** `isocan words vary <item> --n 3 [--brief] [--from voices.json]`
and *Vary the copy…* on a screen produce N variants, each a `parent=` variation
titled with its stance and carrying its reason; words only.

**Proof:** CLI test with the stub generator and with `--from`; a journey that
varies a screen from the web and chooses one (one undo).

## Phase 3 — Compare and mix

**Status: NOT STARTED.**

**Outcome:** an N-up compare of a screen's copy variants, live, with a
per-string picker and *Use this mix* folding one version of the source and
removing the variants, one undo.

**Proof:** a journey that mixes two variants and checks the source's words.

## Phase 4 — Fit and voice

**Status: NOT STARTED.**

**Outcome:** a renderer-side fit check marking strings that overflow or wrap
past their role's lines; a Voice section in DESIGN.md (tone, use, avoid,
glossary) read by variants; a copy lint for glossary and one-name-per-thing
across a flow and the slop tells on canvas screens.

**Proof:** tests of the lint and the Voice section's parse; a journey showing a
non-fitting variant marked.

## Phase 5 — A voice for the flow

**Status: NOT STARTED.**

**Outcome:** after `wire flesh`, *Choose a voice* / `isocan wire voice <flow>
--n 3` writes N voices for the whole flow (one generation per voice), previews
them, and applies the chosen one to every screen in one group; intents
untouched.

**Proof:** CLI test with the stub; a journey choosing a voice for a flow.

## Phase 6 — Evidence

**Status: NOT STARTED.**

**Outcome:** every copy pick records a labelled preference pair (stance as the
label); the judge corpus gains a copy kind.

**Proof:** tests that a pick writes the pair and that `evals pairs` lists it.
