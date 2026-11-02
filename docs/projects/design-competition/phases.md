# The design competition — the walk

Each phase ends with something a person can do, or remove and watch
disappear. Ordered by what settles the most with the least: **a bout by hand
before any module**, because the thing nobody knows yet is whether a
`DESIGN.md` makes an agent's work recognisably *somebody's* — and if it does
not, the picker is a costume shop. Then the platform changes that are useful
without the competition, then the module on the terminal, then the picker.

**Where we are:** technical integration from PR #264 is built on main,
13 September 2026. Phases 1 and 2 are CLOSED. The local mechanics of phases
3–7 are implemented, including the lazy picker and runtime packaging, but
those phases retain the real-fighter, human or hosted acceptances below.
Phase 8 passes source/runtime removal and restoration; its image walk remains.
**Design-competition phase 0 is next:** the human measurement is still owed.
Technical work proceeded in parallel at Dion's request; synthetic entries do
not settle distinctiveness or cost. Blind bouts remain deferred and refused.

The [integration contract](groups-integration.md) governs new arenas:
explicit groups, one bounded creation and preserved legacy behavior.
[The verification record](verification-2026-09-13.md) distinguishes the real
CLI/browser checks from the remaining human, hosted and image walks.

Decided the same day: principle-first names (*Less but Better*, after Dieter
Rams), exhibition as the default bout, and shipping on isocan.io — which is
phase 5.5 below.

The epic is [#250](https://github.com/dglazkov/isocan/issues/250); each phase
names its issue.

## Phase 0 — a bout by hand, and two numbers

**Status: NOT STARTED.** 2026-09-13 — the human distinctiveness and real-model cost measurement remains the next acceptance.

*No module, no new code.* Three packs written by hand from
[`packs.md`](packs.md) — Kare, Rams, Linear — each a directory with an
`AGENTS.md` and a `DESIGN.md`. On a scratch canvas: three areas by hand
(`isocan area new`), three agents by hand (`isocan rc add "Road Signs" --dir
<pack>`), a brief posted in each lane addressed to its fighter, ballots as
reactions (`isocan react 🥇 <entry>`), counted by hand.

What it measures, because everything later is priced on it:

1. **Distinctiveness.** Show the three entries, unlabelled and shuffled, to
   three people who know the roster. How often do they match entry to
   fighter? Chance is one in three. If people cannot tell *Road Signs* from
   *Less but Better*, the packs are adjectives and phase 2's content work is the
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

**Status: CLOSED.** 2026-09-13 — the conductor’s real CLI probe returned distinct root/A/B systems and only lane A’s comment from a wait scoped to A.

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

**Status: CLOSED.** 2026-09-13 — real CLI arena creation, explicit membership, runtime assets and browser fighter rendering passed.

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
ls --in "Road Signs"` lists the card, the system and the shelf; the runtime
build of the module carries its avatars and they draw from
`/modules/design-competition/assets/`.

## Phase 3 — casting: the fighters walk in

**Status: PART-DONE.** 2026-09-13 — casting/templates, hand-in and bell are verified with synthetic entries; actual model-built entries remain.

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

**Status: PART-DONE.** 2026-09-13 — CLI voting, split tally, self-rank refusal and withdrawal pass; the real room’s bout remains.

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

**Status: PART-DONE.** 2026-09-13 — Chat and keyboard palette open the same lazy picker and lay a native arena; the measured cost and live fighter walk remain.

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

## Phase 5.5 — on isocan.io

**Status: PART-DONE.** 2026-09-13 — build lists, assets, lazy loading and the unchanged bundle ceiling pass locally; the dev/prod bout remains.

*Decided 11 Sep 2026: it ships on the hosted home.* The first phase in which
anybody who is not on this repo can play a bout, so it waits for the picker —
a competition you can only start from a terminal is not the thing to put in
front of people.

- **Build-time on the hosted home**: the module in both lists and the
  Dockerfile's manifest layer (the `COPY` line a new module needs, or the image
  builds without it and dev and prod sit still with no GitHub signal); the nine
  default packs in the image as assets.
- **One lazy chunk**: the picker, the avatars and the arena's web half are
  fetched when somebody opens the picker or a canvas holds a fighter card, and
  never on a first visit — `test/bundle-budget.test.ts` is the guard that
  refuses the stickers module's first mistake.
- **Fighters on the person's rc, parked against isocan.io**: the Fight button
  reads the same parked-rc fact `AddAgent` does there. No hosted spawning.
- **Walked on dev.isocan.io first** (the `green` ref), then prod: a bout from
  the Chat, three fighters on one laptop's rc, the vote from two browsers, the
  winner taken as `#Checkout`'s next version.
- **Not in this phase**: bring-your-own on the hosted home, which waits for the
  shared question of who may add a module there. Data-only modules are the
  likely first answer; it is not this project's to give alone.

**Acceptance:** the walk above, recorded; the first-visit bytes on isocan.io
unchanged within the ratchet.

## Phase 6 — bring your own fighter

**Status: PART-DONE.** 2026-09-13 — data contributions and BYO commands pass synthetic runtime checks; a teammate’s actual pack fighting from a git install remains.

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

**Status: PART-DONE.** 2026-09-13 — take/remix/rematch and standings pass synthetic CLI checks; blind remains outside this continuation and explicitly refuses.

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

**Status: PART-DONE.** 2026-09-13 — removing and restoring the source/runtime module leaves the snapshot and log intact; the required container-image walk remains.

The removal proof, for the largest module yet, by hand and recorded here —
on a build of the hosted home's own image, since that is where it ships: a
home with three finished arenas; the module removed from both lists and the
build; `isocan ls` files fighter cards under `other`, the `DESIGN.md` items
and entries are files, every ballot is a reaction in the log, `--help` has no
`competition`, the picker is gone from ⌘K, and the oplog is untouched. Then
the runtime build added back with `isocan module add`, and everything draws
again.

**Acceptance:** Scene 7's second half, played and written down.

## Trajectory and remaining hands

- **2026-09-13** — The current canvas model makes the arena an explicit
  forest, not a geometric stack of areas. Shared preparation uses the existing
  bounded group resolver so CLI and picker create one undoable act.
- **2026-09-13** — Enrolment publishes work another process can immediately
  start. Prepare the directory and rc configuration before that publication;
  a preparation token and serialized file writes protect refusal rollback.
- **2026-09-13** — A host captured before its first snapshot can retain a
  false legacy mode. Refresh the host when mode or admission changes, while
  each pending action retains the destination it captured before awaiting IO.
- **2026-09-13** — Open: phase 0 needs three people, three briefs, real
  fighter runs and measured token/turn costs. No paid fighter run was started.
  Pack tuning and the picker’s honest measured-cost line depend on this.
- **2026-09-13** — Open: phases 3–6 and the non-blind part of phase 7 need
  the actual fighter/teammate room walk. Phase 5.5 additionally needs a parked
  laptop rc against dev, two browser voters, winner versioning, then prod.
- **2026-09-13** — Open: blind bouts are deferred beyond the authorized
  integration. They need their own implementation and desk/shuffle proof;
  the current verb refuses rather than simulating anonymity.
- **2026-09-13** — Open: phase 8 requires a working container engine.
  Docker Desktop’s local administrator setup prevented the image walk here;
  the source/runtime removal proof cannot close that named requirement.
