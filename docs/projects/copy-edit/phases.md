---
status: designed
since: 2026-10-02
see: wireframes, version-diff
note: "the walk: two bugs, the copy deck, copy variants, compare and mix, fit and voice, wire-time voice, evidence."
issue: 377
---

# A deep copy edit — the walk

**2 October 2026.** Held to [journey.md](journey.md); the design is
[the research note](../../research/2026-10-02-copy-edit.md).

**Where we are, 2 Oct 2026: nothing built. Next: copy-edit phase 0, two bugs.**

Rules for every phase, on top of `AGENTS.md`:

- **No new op type.** Variants are `parent=` variations; a pick is the existing
  converge; a mix is one `item.update`/version.
- **Words only.** Anything that changes a variant's markup outside its text is a
  bug, and a test says so byte for byte.
- **Walked.** Each phase from 1 on ends with a journey in `scripts/journeys.mjs`
  or a real-daemon CLI test, named in its proof.
- **Text generation through `TextGenerator`** (`core/src/jev.ts`); the stub in
  tests; never a key in the browser.

## Phase 0 — Two bugs

**Status: NOT STARTED.**

**Outcome:** `wire edit --kind content` calls the text generator and writes
words for the slot, never the instruction itself (`edit.ts:358`); the web
`/wire copy` and `/wire name` reach a configured generator instead of always
the stub (`dialog.tsx:341,356`) — through the daemon/home, no key in the page.

**Proof:** tests that the instruction never lands as text and that a
configured generator is called from the web path; `npm test`, typecheck.

## Phase 1 — The copy deck

**Status: NOT STARTED.**

**Outcome:** a pure core `copyDeck(html)` → strings in reading order with role,
address (wire `data-wf` where present, else the element path the WYSIWYG splice
uses, checked by current text) and, where measured, a budget; `isocan copy
<item> [--json]`; `isocan copy <item> --apply deck.json` splicing text only,
refusing a stale address, one version.

**Proof:** core tests over wire and plain HTML (roles, addresses, a stale
refusal, markup byte-identical outside text); a CLI test of read and apply.

## Phase 2 — Copy variants

**Status: NOT STARTED.**

**Outcome:** `isocan copy vary <item> --n 3 [--brief] [--from voices.json]`
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
