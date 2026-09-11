---
status: designed
since: 2026-09-11
issue: 250
see: design-competition, sprint, modules, personas, evals
note: asked for an epic — a "choose your fighter" design competition between famous designers, as a module that tests the module system. Found the competition needs zero new ops (areas, desks, curtain, dots, split tally, prefer, DESIGN.md items and the rc's message-wake all exist) and that its whole cost is the cast, every piece of which the module system cannot say — assets, contribution points, a dialog slot, a scoped design system (without which a lane's DESIGN.md hijacks the canvas's), enrolment templates, and a curtain outside the sprint. Designed as docs/projects/design-competition/; phase 0, a bout by hand measuring distinctiveness and cost, is next
---
# A design competition, and what it asks of the module system

**11 September 2026.** Research, and the design it led to in
[`../projects/design-competition/`](../projects/design-competition/). Nothing
built.

The ask: *an epic feature, "Design Competition" — maybe as a skill entry,
`/design-competition`, built as a module to test the module system and extend
it to pull this off. Set up WHO the designers are — defaults like Jony Ive and
Apple, frog design, IDEO, and a few other famous software product designers —
each a package with a name, a fun profile picture, a `DESIGN.md` with their
philosophy, and examples of their work to pick as input context. Starting a
competition opens a "choose your fighter" popup; an agent for each designer
builds a design in its own area of the canvas; and a voting system.*

Four questions were carried in: **what of this already exists** (a lot was
suspected — the sprint is a week old); **what the module system lacks**,
since that is half the point; **who the default fighters should be and what
their packs can honestly contain**; and **what the prior art for AI design
contests does about voting**.

## 1. What already exists — nearly all of it, and zero new ops

Read from the tree on 11 Sep (`origin/main` at `ed1520a6`):

| A competition needs | Already built | Where |
| --- | --- | --- |
| a lane per fighter | **areas** — a markdown item with `kind=area`, membership by geometry, `--in` on `add`, `text`, `copy`, `ls`, `mv`, `tidy` | `core/area.ts`; `isocan area new` |
| an arena laid in one gesture | the sprint **board** — `SPRINT_BOARD` as data, laid in one grouped write, idempotent by key | `core/sprint.ts:107`, `isocan sprint board` |
| private building for a blind bout | **desks** — a canvas per sketcher, link off, one pass; hand-in across canvases with `copy --to --in --handin` | `isocan sprint desk` |
| votes | `item.react` — actor, emoji, on/off, an optional `at` point (heat-map dots) | `core/ops.ts:229` |
| a curtain | `hidesVotes` + `wallFor` — counts and bylines hidden by the lens while a vote phase's clock runs; the record stays public | `core/sprint.ts:454,532`; `web/src/lib/sprint.ts` |
| people and agents counted apart | `tally(items, mark, agentIds)` | `core/sprint.ts:503` |
| an A/B eye test | `isocan prefer <winner> --over …`, `standings()` | `core/preference.ts` |
| a designer's philosophy as a design system | `DESIGN.md` as an item with the design-system role; `design --css`; the audit; the slop floor | `core/designsystem.ts`, `designaudit.ts`, `slop.ts` |
| an agent per fighter | `agent.enroll` as an op; `isocan rc add --dir --harness`; a summons that wakes on a message addressed to the agent | `core/ops.ts:365`, `cli/src/rc.ts` |
| a skill entry | slash commands, including module-contributed ones (`CoreModule.commands`) | `core/commands.ts`, `core/modules.ts` |

**The finding: the competition is a sprint with one phase, cast by a picker.**
It needs no operation. Everything it does to a canvas is `item.add`,
`item.update`, `item.react`, `thread.*` and `agent.enroll`/`withdraw`.

Two things that look reusable are not, and it is worth saying why:

- **`choose` is the wrong converge.** `convergePlan` (`core/converge.ts:64`)
  folds a child into its parent *and trashes every sibling* — and the siblings
  of a winning entry are the other entries, which are the record of why it
  won. A competition converges by copying the winner's bytes as a new version
  of the target.
- **`prefer` is not per-voter.** `preferPatch` records a pair on the winner
  and returns `null` when the pair is already recorded — correct for one
  person's eye test, but the second voter who agrees produces no op, so a
  multi-voter tally cannot be read from it. A ranked ballot of reactions (🥇🥈🥉,
  one per voter, attributable) can; the eye test becomes a way to *arrive at*
  your ranking.

## 2. What the module system lacks — six things, each a platform change

The four modules so far (mind map, Mermaid, documents, stickers) each needed
a subset of the seven slots. The competition is the first to need things no
slot provides. Each is written up with a proposal in
[`module-gaps.md`](../projects/design-competition/module-gaps.md); the causes,
measured:

1. **Assets.** `scripts/module-build.mjs` copies `dist/` and `agent-guide.md`
   and nothing else, so a runtime module cannot ship a picture or a markdown
   file — though `/modules/:slug/*` would serve one (`server/http.ts:1386`).
   `STATIC_TYPES` has no `.md` or `.json`.
2. **Contribution points.** Modules contribute to core's registries; nothing
   contributes to a module's. A second package adding a fighter would have to
   import the competition, which `test/modules.test.ts` forbids.
3. **A dialog.** Overlays are edges and pages are cover routes; `Modal` is the
   shell's. A module's slash command cannot be `local` — *"only built-ins can
   be local"* — so `/design-competition` in the composer goes to the Chat.
4. **A scoped design system — and a latent bug.** `designSystem(canvas)`
   returns the most recently updated design-system item on the whole canvas.
   Three lanes with three `DESIGN.md`s silently replace the canvas's own
   system with whichever lane was touched last.
5. **Casting.** `CliHost` has no enrol; the web enrols only through
   `AddAgent`'s ask to a parked rc; the summons carries no persona
   (`summonsPrompt` is fixed), and `AddAgent.tsx` records that persona
   templates were *"deliberately absent (decided 2026-08-30)… rather than a
   picker that decorates without deciding."* A fighter pack is the first
   template that decides something.
6. **The curtain and `wait --in`.** `hidesVotes` knows only sprint phases and
   the Vote sheet; `wait` has no `--in`, which the sprint journey asked for
   in Scene 4 and nobody built.

None needs an operation, a protocol message or a route.

## 3. The fighters

See [`packs.md`](../projects/design-competition/packs.md) for the format and
the roster with each pack's philosophy, rules and sources. What the research
settled about *what a pack may contain*:

- **No photographs, no likeness.** A portrait photo is somebody else's
  copyright, and a real person's face on an agent's card is the thing
  AGENTS.md's *presence is honest* rule forbids in spirit. Avatars are
  illustrated **emblems** drawn for the pack — an idea of the work, not a
  face.
- **No bundled pictures of the work** unless the licence travels. The repo is
  MIT; almost none of the work is. References ship as a title, a year, what
  to learn from it and a canonical link; a picture only with CC0, CC-BY or
  public-domain terms and attribution. Share-alike (CC BY-SA) cannot be
  relicensed as MIT, so it is linked, not bundled.
- **Homage, never endorsement.** Every card carries a line saying the pack is
  an homage to publicly documented work and is not affiliated with or
  endorsed by the designer. **The principle leads and the person is a
  credit** (decided 11 Sep): the card reads *Less, but better — after Dieter
  Rams*, and the agent is *Less but Better*, never the person's name.
- **The philosophy is paraphrase with sources**, not quotation. At most one
  short attributed quote per pack.

**The survey's sharpest finding about the roster: all nine defaults are
living people.** Products draw their line exactly there — OpenAI refused
images "in the style of individual living artists" from March 2025 while
allowing studio styles; Adobe Stock bans *in the style of* and *inspired by*
wording from contributors. The open-source precedent is `awesome-design-md`
(MIT, 100k+ stars), whose brand `DESIGN.md` files ship "as is" with an
explicit disclaimer of any claim to the brands' visual identity. Style is not
copyrightable (17 U.S.C. §102(b)); implied endorsement (Lanham Act §43(a)),
the right of publicity, and trademarks are the exposure. Hence the rules in
[`packs.md`](../projects/design-competition/packs.md#homage-not-impersonation),
including a principle-first title beside every credit so a pack can be
renamed on request without losing what it is.

Three avatar traps it found (the first was in this project's own first
sketch): a *happy Mac* for Kare reproduces Apple's artwork (a Commons SVG tagged
CC BY-SA by its uploader does not change that); a frog for frog is their
logo; a circle of diagonal lines for Linear is theirs.

And one format finding: **`DESIGN.md` is an open spec** (Google Labs, alpha —
YAML tokens, then Overview, Colors, Typography, Layout, Elevation & Depth,
Shapes, Components, Do's and Don'ts; unknown sections kept). isocan already
imports, lints and exports it, so a pack's `DESIGN.md` is useful on any
canvas, and the existing linter is half the pack validator.

## 4. Prior art

Every AI design contest found runs the same brief past hidden identities and
asks people to compare. What they learned is what the vote here copies:

| Prior art | Shape | What it teaches |
| --- | --- | --- |
| [Design Arena](https://www.designarena.ai/about) | four models, one prompt, live; blind duels in a **five-vote bracket** that yields a full 1st–4th order; Bradley–Terry, models under 15 comparisons hidden | a total order from five taps — which is what the eye test becomes; a minimum before a rating is shown |
| [LMArena WebDev Arena](https://arena.ai/blog/webdev-arena) | two anonymous models build a web app, run in microVMs; vote A / B / **tie / both bad** | **18% of votes were "both bad"**, mostly broken builds — hence ⛔ *misses the brief*; repeated prompts deduplicated (103k votes → 61k) |
| [Chatbot Arena style control](https://www.lmsys.org/blog/2024-08-28-style-control/) | a regression separating length and markdown from substance | voters reward polish — hence *rank by the brief*, with the floor check shown beside, not mixed in |
| ["The Leaderboard Illusion"](https://arxiv.org/abs/2504.20879) (2025) | ~2M battles analysed | private reruns and unequal sampling distort ranks — hence every entry and retry stays on the canvas |
| [Windsurf Arena Mode](https://www.infoq.com/news/2026/02/windsurf-arena-mode/) (Feb 2026) | two hidden agents on your real task; personal and global Elo | a **personal** leaderboard of your own taste — standings per voter are one filter away in the log |
| [Cursor multi-agent judging](https://forum.cursor.com/t/cursor-2-2-multi-agent-judging/145826) | up to eight agents in parallel worktrees, an AI judge picks with a rationale | agent judgement with written reasons is useful as a *second row*, never the result — the sprint's rule |
| [Cut&Paste Digital Design Tournament](https://www.core77.com/posts/17196/Compete-live-at-the-Cut-n-Paste-Digital-Design-Tournament-2010) (2005–) | people designing live on projected desktops, a clock, a crowd | the spectacle is watching them build — the exhibition bout |
| [Dribbble Warm-Up](https://dribbble.com/stories/2019/09/03/introducing-dribbble-s-weekly-warm-up) | a shared prompt, entries "rebound" it; explicitly *not* a contest | the low-stakes version — a rematch with no vote is a warm-up |
| [IDEO's GPT-3 brainstorm](https://www.ideo.com/journal/the-rules-of-brainstorming-change-when-artificial-intelligence-gets-involved-heres-how) (2020) | a model as a brainstorm participant | machines diverged well and converged badly — people choose |

What none of them has, and this does: **the entries land where the work
already is**, next to the screen they would replace, with the room's own
design system and the ballots in the same log as everything else. An arena is
a website you visit; this is a Tuesday on your own canvas, and the winner can
become the next version of `#Checkout` in one gesture.

## 5. What was decided

Recorded in full in the [design](../projects/design-competition/design.md);
the short list: a sprint with one phase; a module on purpose; homage not
impersonation; fighters on the person's own rc; the first turn a message on
the canvas; exhibition by default and blind as a separate bout on desks;
ballots as reactions, Borda, people and fighters apart, a person decides;
take-it copies rather than `choose`; standings derived, handed to evals; packs
are not personas. Phase 0 — a bout by hand — goes first, because the one
thing nobody knows is whether a `DESIGN.md` makes an agent's work
recognisably *somebody's*.

**Three questions the note left open, answered by Dion the same day:**

- **Naming: the principle leads, the person is a credit.** *Less, but better*
  over *after Dieter Rams*; the agent is *Less but Better*. This went further
  than the note's own first answer (*Rams Bot*), and it is the better one: it
  keeps a living person's name off every op an agent makes, and it names the
  thing that actually fought.
- **Exhibition is the default bout.** Blind stays a separate bout on desks.
- **It ships on isocan.io**, as a build-time module whose web half is one lazy
  chunk. Fighters still run on the person's own rc; bring-your-own on the
  hosted home waits for the shared question of who may add a module there.
