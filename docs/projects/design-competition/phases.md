# The design competition — the walk

Each phase ends with something a person can do, or remove and watch
disappear. Ordered by what settles the most with the least: **a bout by hand
before any module**, because the thing nobody knows yet is whether a
`DESIGN.md` makes an agent's work recognisably *somebody's* — and if it does
not, the picker is a costume shop. Then the platform changes that are useful
without the competition, then the module on the terminal, then the picker.

**Where we are:** designed 11 Sep 2026. Nothing built. Phase 0 is next.

The epic is [#250](https://github.com/dglazkov/isocan/issues/250); each phase
names its issue.

## Phase 0 — a bout by hand, and two numbers

*No module, no new code.* Three packs written by hand from
[`packs.md`](packs.md) — Kare, Rams, Linear — each a directory with an
`AGENTS.md` and a `DESIGN.md`. On a scratch canvas: three areas by hand
(`isocan area new`), three agents by hand (`isocan rc add "Kare Bot" --dir
<pack>`), a brief posted in each lane addressed to its fighter, ballots as
reactions (`isocan react 🥇 <entry>`), counted by hand.

What it measures, because everything later is priced on it:

1. **Distinctiveness.** Show the three entries, unlabelled and shuffled, to
   three people who know the roster. How often do they match entry to
   fighter? Chance is one in three. If people cannot tell *Kare Bot* from
   *Rams Bot*, the packs are adjectives and phase 2's content work is the
   whole project. Run it on three briefs.
2. **Cost.** Turns and tokens for a three-fighter, twenty-minute bout, from
   the rc's own accounting. The picker will state it before Fight; it has to
   be a number somebody measured.

And three things to watch for: whether fighters stay in their lanes when
asked (and what they read if not), what the design-system hijack
([module-gaps §4](module-gaps.md#4-a-design-system-scoped-to-an-area)) does
to the canvas's own `design --css` on the day, and whether a critique in a
rival's lane wakes the rival.

**Acceptance:** a page in this directory, `phase-0.md`, with the two numbers,
the three briefs, and what changed in the packs because of them.

## Phase 1 — the platform changes nothing else needs to wait for

*Core and CLI only. Useful without the competition.*

- **The scoped design system** ([§4](module-gaps.md#4-a-design-system-scoped-to-an-area),
  #253): `designSystem(canvas, { at })`, the canvas-wide pick ignoring scoped
  systems, `design --css --in` and `design check --in`, the audit asking at
  the screen's centre. Fixes the hijack for anybody with two systems on one
  canvas.
- **`wait --in <area>`** ([§6](module-gaps.md#6-smaller-a-curtain-that-is-not-the-sprints-and-wait---in),
  #256): owed to the sprint journey since 2 Sep.

**Acceptance:** two `DESIGN.md` items in two areas; `design --css --in A` and
`--in B` print different tokens and bare `design --css` prints the canvas's;
an agent parked with `wait --in A` is not woken by a comment in B.

## Phase 2 — packs and assets: the module exists, on the terminal

- **Module assets** ([§1](module-gaps.md#1-assets), #251): the `assets/`
  convention, `module-build.mjs` copying it, the manifest listing it, the
  bound, `.md`/`.json` in `STATIC_TYPES`, `assets/styles.css`.
- **The pack format** ([`packs.md`](packs.md), #258): `pack.json`, the
  validator in the module's `core.ts` (homage line, `agentName` rule, licence
  on every picture, `DESIGN.md` through the existing linter), and the nine
  default packs as assets — the content work, informed by phase 0.
- **`@isocan/design-competition`**, CLI half and core only: the fighter-card
  kind (`application/vnd.isocan.fighter+json`), `isocan competition
  fighters`, and `isocan competition new <brief> --fighters a,b,c` laying the
  arena — Brief area, lanes, cards, scoped `DESIGN.md`s, reference shelves —
  in one grouped write.
- The web half's first slot is the smallest: a **renderer** for the fighter
  card, so the arena looks like a line-up.

**Acceptance:** `competition new` lays an arena on a scratch canvas; `isocan
ls --in "Kare Bot"` lists the card, the system and the shelf; the runtime
build of the module carries its avatars and they draw from
`/modules/design-competition/assets/`.

## Phase 3 — casting: the fighters walk in

- **Templates and `enrol`** ([§5](module-gaps.md#5-casting-agents), #255):
  `CliModule.templates`, `CliHost.enrol`/`withdraw` promoted from `rc add` and
  `rc rm`, the rc honouring template ids from installed modules only.
- **`competition start`**: enrols one fighter per lane with the
  `design-competition.fighter` template (working directory: `AGENTS.md` with
  the homage and the rules, the pack's `DESIGN.md` and references), posts
  the brief in each lane addressed to its fighter, starts the clock line in
  the Chat. **`competition status`** and **`competition handin`**.
- The bell: at the clock, a line in the Chat; fighters hand in; the floor
  check (`design check --in` per lane) writes one line under each entry.

**Acceptance:** Scenes 1–3 play from the terminal: three cursors in three
lanes, three entries stamped at the bell, the floor under each.

## Phase 4 — the vote and the result

- **The curtain's `rounds`** ([§6](module-gaps.md#6-smaller-a-curtain-that-is-not-the-sprints-and-wait---in),
  #256): the sprint becomes the curtain's first caller, the competition its
  second.
- **Ballots** (#260): `competition vote <entry> --rank n` (moving a medal is
  one group), `competition dot <entry> --at x,y`, fighter critiques in voice
  after the bell, the self-rank refusal, `competitionTally` in the module's
  core read by both surfaces, `competition result`, the Decider's 🏆.
- **Withdrawal** at the result.

**Acceptance:** Scenes 4 (exhibition) and 5 play from the terminal; the tally
shows people and fighters apart; a fighter's rank of its own entry is refused
by the verb and dropped by the tally with a sentence.

## Phase 5 — the picker

- **The dialog slot** ([§3](module-gaps.md#3-a-dialog-slot), #254):
  `WebModule.dialogs`, `DialogFacts`, `opens` on actions and module commands,
  the shell's `Modal` as the box.
- **`WebHost.enrol`** ([§5](module-gaps.md#5-casting-agents), #255): the web
  half of casting, through the parked rc's ask.
- **The fighter select** (#261): the grid, the flip-card hover, P1–P4, Random,
  the four settings with defaults, Fight disabled-with-a-sentence when no rc
  is parked, the cost line. The live side of the arena: lane states, the
  winner card.

**Acceptance:** Scene 0 plays from the Chat and from ⌘K; the dialog is the
module's and disappears when the module is removed.

## Phase 6 — bring your own fighter

- **Contribution points and data-only modules** ([§2](module-gaps.md#2-contribution-points),
  #252): `points`, `contributes`, `contributions()`, manifests carrying data,
  `module add` saying *data only — runs nothing*.
- **`competition fighter new | add | rm`** (#263): a pack from a `DESIGN.md`,
  references and an avatar; built as a data-only module; added from a
  directory or a git spec. The picker lists every fighter with where it came
  from. *Your emissaries* in the picker: any enrolled persona can take a slot.

**Acceptance:** Scene 6 plays: a teammate's pack from a git spec appears as a
tenth portrait and fights.

## Phase 7 — blind bouts, the converge half, and standings

- **Blind** (#262): fighters on desks (`sprint desk`), shuffled hand-in to a
  Wall area as *Entry A, B, C*, coaching refused with a sentence, names on the
  wall at the tally.
- **Take it / Remix / Rematch** (#262): `item.addVersion` on the target (not
  `choose`); a one-fighter bout with a generated brief of dots and critique
  ideas; a new arena beside the last.
- **Standings** (#262): `competition standings`, derived; the ballots handed to
  the evals project as preference pairs.

**Acceptance:** Scenes 4 (blind), 5 and 7's first half play.

## Phase 8 — take it away

The removal proof, for the largest module yet, by hand and recorded here: a
home with three finished arenas; the module removed from both lists and the
build; `isocan ls` files fighter cards under `other`, the `DESIGN.md` items
and entries are files, every ballot is a reaction in the log, `--help` has no
`competition`, the picker is gone from ⌘K, and the oplog is untouched. Then
the runtime build added back with `isocan module add`, and everything draws
again.

**Acceptance:** Scene 7's second half, played and written down.
