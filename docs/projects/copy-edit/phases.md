---
status: built
since: 2026-10-02
see: wireframes, version-diff
note: "the walk: two bugs, the copy deck, copy variants, compare and mix, fit and voice, wire-time voice, evidence — all seven phases closed 2–7 Oct 2026."
issue: 377
---

# A deep copy edit — the walk

**2 October 2026.** Held to [journey.md](journey.md); the design is
[the research note](../../research/2026-10-02-copy-edit.md).

**Where we are, 7 Oct 2026: every phase (0, 0.5, 1–6) is CLOSED.** Every copy pick records a stance-labelled preference pair and feeds `@isocan/judge`'s `copy` corpus kind; the remaining Open entries are optional polish items, not phases.

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

**Status: CLOSED, 6 October 2026.** `POST /api/text` is built on the daemon and the home with Claude and OpenAI-shaped providers, every refusal and the key-never-leaks rule proved against a real daemon. On 6 Oct Dion put an Anthropic key in isocan-io-prod's Secret Manager (`text-api-key`) from Cloud Shell — the first paste was the key's id, version 2 is the key, version 1 disabled — and the service took it as `ISOCAN_TEXT_API_KEY` with `ISOCAN_TEXT_PROVIDER=anthropic` (revision `isocan-00198-55d`); `infra/70-cloud-run.sh` carries both when the secret exists, so a re-provision keeps them. Dion ran `/wire copy` on an isocan.io canvas and it wrote real words through the home.

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

⚑ **Provision:** done 6 Oct 2026 — `text-api-key` in isocan-io-prod, Anthropic. Dev has none yet and deploys as before.

### Trajectory

- **2026-10-02** — The route's path lives in a core subpath (`@isocan/core/text`), not beside `JUDGMENT_ROUTE` in modules.ts: there it cost the entry 14 bytes, shared 33; read only by the lazy dialog chunk, the entry stays 701,285.
- **2026-10-02** — `/api/judgment` moved beside `/api/text` in `model-routes.ts`: one more registration line put `registerRoutes` past its agreed size, and the two routes that spend the home's keys belong together.
- **2026-10-02** — Claude is the default when the key is `sk-ant-…` (model `claude-opus-5-5`, `effort: low`, per the claude-api guidance), raw `fetch` rather than the SDK because core loads in the browser and the lockfile is someone else's.
- **2026-10-02** — Open: a text-model key on isocan.io (`ISOCAN_TEXT_API_KEY`, and the provider) — Dion's. Until then the browser fills placeholder words and says so once.
- **2026-10-06** — Provisioned from Cloud Shell: this machine's `gcloud` is behind Context-Aware Access and cannot reach the project at all, which is also why the agent could not do it. `70-cloud-run.sh` attaches the secret only when `gcloud secrets describe text-api-key` finds one, and puts `ISOCAN_TEXT_PROVIDER` in `ENV_VARS` because `--set-env-vars` replaces the whole environment — a hand-attached variable would not have survived the next deploy.
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
- **2026-10-02** — Fixed (`d01ed53a`): the web's inline text edit on a wire screen now writes the spec through the wireframe module (`WebModule.copy.at`/`apply`, the mapping in `@isocan/core/wire-words`), so a re-render keeps it; ambiguous nodes are refused in words. It also found every inline text save had been refused since stage 2 — the frame counted its own marker `<style>` when numbering text nodes.
- **2026-10-02** — Open: `--by` on plain HTML has nowhere to live (a version has only `createdBy`); it is said in the receipt only.

## Phase 2 — Copy variants

**Status: CLOSED, 2 October 2026.** *Vary the copy…* and `isocan words vary` write N distinct voices in one generation call and land each as a `parent=` variation, words only — the `copy-vary` journey made three from the web and chose one, and the CLI test proved byte-identical markup, choose, and one undo.

**Outcome:** `isocan words vary <item> --n 3 [--brief] [--from voices.json]`
and *Vary the copy…* on a screen produce N variants, each a `parent=` variation
titled with its stance and carrying its reason; words only.

**Proof:** CLI test with the stub generator and with `--from`; a journey that
varies a screen from the web and chooses one (one undo).

### Trajectory

- **2026-10-02** — One generation call writes all N voices: the schema makes every edit's address an enum of the deck's own, and one validator (`checkCopyVariants`) judges a model's answer and an agent's `--from` file alike — distinct stances, real addresses, a role's shape kept, something changed.
- **2026-10-02** — A wire variant's spec carries `variantOf`, so after `choose` folds it the source said `variantOf` itself; `wiresOn` now reads a self-reference as no variation rather than teaching `choose` about wires.
- **2026-10-02** — A second lazy importer of `@isocan/core/jev` reached half the core barrel through one constant import and split the CLI's startup chunk (`--version` 39 → 40 modules); `jev.ts` now spells the code locally, a test holding it equal.
- **2026-10-02** — With no text model the variants are placeholders, named and said once; `words vary` reads a key stored with `isocan keys` (keys phase 1).

## Phase 3 — Compare and mix

**Status: CLOSED, 2 October 2026.** *Compare the copy…* shows a screen and its voices side by side, live, with one row per string that any voice says differently; *Use this mix* (and `isocan words mix <source> --pick addr=variant`) writes one version of the source from the picked strings and trashes the voices in the same group — the `copy-mix` journey took the heading from one voice and the button from another, checked the words, and ⌘Z brought back the original and all three voices.

**Outcome:** an N-up compare of a screen's copy variants, live, with a
per-string picker and *Use this mix* folding one version of the source and
removing the variants, one undo.

**Proof:** a journey that mixes two variants and checks the source's words.

### Trajectory

- **2026-10-02** — A mix is `convergeOps`'s shape with a new file in place of the winner's: one `item.addVersion` of the source spliced from the picked strings, then each voice deleted, one group. No new op; the web and `words mix` land the same blob hash for the same picks (a test holds them equal).
- **2026-10-02** — A wire screen's mix goes through the module's pure `copy.variant` writer, not `apply`: `apply` sends its own group and could not share an undo with the deletes, and the variant file folds home exactly as `choose` folds one.
- **2026-10-02** — A mix trashes only stance-bearing voices, not every `parent=` child as `choose` does: a layout variation is not in the compare, so the mix leaves it alone.
- **2026-10-02** — `copyMixRows` refuses, by name, a voice that no longer lines up with its source string for string — the guard against a source edited after it was varied; phase 5's flow-wide voice should reuse it.
- **2026-10-02** — *Compare the copy…* shares *Vary the copy…*'s lazy import; the entry chunk stayed at 701,285. After a vary the offer is words in the notice, not a button (notices are strings).
- **2026-10-02** — Open: the picks are preference evidence (which stance won each string) recorded nowhere yet — phase 6's. `words mix` records "agent" as the version's author and has no `--by`.

## Phase 4 — Fit and voice

**Status: CLOSED, 2 October 2026.** *Compare the copy…* marks a string that does not fit its role — the frame measures its own line boxes and overflow, core's `copyFit` judges ("five lines in a two-line heading"), and the row cell and the frame both show it. A `## Voice` section in DESIGN.md (tone, use, avoid, glossary) reaches the generation prompt, and a variant that adds a banned form or avoided word is refused by name, on the web and in `words vary`. `isocan words lint [items…] [--flow]` reports glossary, one-name-per-thing, the slop tells (8 of `SLOP_RULES`' 9) and length by character count. The `copy-fit` journey marked exactly the long heading, in the cell and inside the frame.

**Outcome:** a renderer-side fit check marking strings that overflow or wrap
past their role's lines; a Voice section in DESIGN.md (tone, use, avoid,
glossary) read by variants; a copy lint for glossary and one-name-per-thing
across a flow and the slop tells on canvas screens.

**Proof:** tests of the lint and the Voice section's parse; a journey showing a
non-fitting variant marked.

### Trajectory

- **2026-10-02** — A frame measures its own strings and the panel judges them: the compare's sandboxed frames are out of process, so a probe posts line boxes and overflow up, core decides, and marks are posted back. The CLI has no renderer and says its fit is a character count.
- **2026-10-02** — `copy-lint` takes `SLOP_RULES` as an argument: importing `slop.ts` split it into a chunk of its own and put `isocan --version` at 40 modules.
- **2026-10-02** — A variant is refused only for a voice slip it adds (`newVoiceSlips`): keeping the source's "Log in" is not writing it; writing "Log in" over "Continue" is.
- **2026-10-02** — The deck's `budget` is now the role's (`lines`, `chars`, `oneLine`); phase 2's `ROLE_SHAPE` folded into it — one table for the variant check, the count and the rendered fit.
- **2026-10-02** — Open: a slip refuses the whole vary, with no retry; attribute strings and wire-screen fit are unmeasured in a browser; `design check` does not report Voice problems.

## Phase 5 — A voice for the flow

**Status: CLOSED, 5 October 2026.** Both halves. `isocan wire voice` was
proved against a real model the same morning (three voices for an 11-screen
flow from one call, one undo restoring every word). *Choose a voice…* on a
fleshed flow's screen or prototype asks for N voices in the same one call,
previews each on the flow's first two screens with the compare's marks, and
*Use this voice* lands every screen and the prototype rebuild as one group:
the `copy-voice` journey chose voice 2 on a 14-screen stub flow, saw every
screen's words change, and one ⌘Z restored all 14. A web test holds the web's
landing equal, op for op and file for file, to `wire voice --from --pick`.

**Outcome:** after `wire flesh`, *Choose a voice* / `isocan wire voice <flow>
--n 3` writes N voices for the whole flow, previews them, and applies the
chosen one to every screen in one group; intents untouched.

**Proof:** CLI test with the stub (`flesh-cli.test.ts`, "isocan wire voice");
a journey choosing a voice for a flow — owed with the web half.

### Trajectory

- **2026-10-05** — ONE call for the whole flow, not one per voice as the
  outcome first said: the flow's screens become one deck (`flowCopyDeck`,
  addresses `<screen>::<address>`), so phase 2's argument holds at flow scale
  — asked per screen a model writes eleven slightly different voices — and
  the one validator (`checkCopyVariants`) and one request shape serve a flow
  exactly as they serve a screen. The prompt adds one sentence: one voice is
  one voice on every screen, and a button that goes to the same place says
  the same words everywhere.
- **2026-10-05** — Two steps, because a model's answer is not reproducible:
  the preview saves the voices to a file named in the receipt, and
  `--from <file> --pick <k|stance>` applies one. The file records who wrote
  them, so the pick's versions name the model, not "agent". Applied, the file
  is stale for that voice and the next pick of it is refused ("changes no
  words") rather than written twice.
- **2026-10-05** — `writeWireCopy` gained `{ group, rebuild }` so eleven
  screens land in one group with the prototype rebuilt once, not eleven
  times; nothing else about the writer changed.
- **2026-10-05** — The web reaches the module through `WebCopyWriter.flow`
  (module API 0.2.6); both surfaces call `flow-voice.ts`'s `readFlowVoice`
  and `applyFlowVoice`, so the CLI's own copy of that logic is gone. The
  preview draws each voice with the pure `copy.variant`; *Use this voice*
  lands through the writer, never through the preview's files.
- **2026-10-05** — Placeholder voices on a flow deck now change two loud
  strings on every screen: changing only the first four strings of the flow
  would have been a stub that lied about the whole-flow path.
- **2026-10-05** — Open: no ⌘K action, only the item-menu row; the panel has
  been checked by the journey's DOM assertions, not by eye; `--brief` is the
  only steer, and a Voice slip still refuses the whole answer with no retry
  (phase 4's open item).

## Phase 6 — Evidence

**Status: CLOSED, 7 October 2026.** Every copy pick — *Choose this variation* / `isocan choose` over copy variants, *Use this mix* / `isocan words mix`, and *Choose a voice…* / `isocan wire voice --pick` — records its winner, loser stances and per-string mix on `item.update` inside the pick's own group (`copyPreference` + `preferredOver`), read by `harvestPreferences` (`isocan evals pairs`) and by `isocan judge corpus` as a `copy` kind with synthetic shape rows (module API 0.2.7).

**Outcome:** every copy pick records a labelled preference pair (stance as the
label); the judge corpus gains a copy kind.

**Proof:** tests that a pick writes the pair and that `evals pairs` lists it.

### Trajectory

- **2026-10-07** — Copy picks carry their stances on the existing `item.update` op inside the pick's own group (`copyPreference` + `preferredOver`), so no new `Operation` is added, one undo retracts the preference with the pick, and `harvestPreferences` reads stances without inspecting trashed variant blobs.
- **2026-10-07** — A mix records one pairwise row per losing stance against the winning mix (`A + B`), with per-string winner stances preserved on `copyPreference` for `@isocan/judge`'s `copy` corpus kind.
- **2026-10-07** — `WebFlowVoice["apply"]` gained an optional `choice` (`{ stance, against }`, module API 0.2.7) so *Use this voice* in the browser and `wire voice --pick` in the CLI write the identical `copyPreference` record on the flow's first changed screen.
