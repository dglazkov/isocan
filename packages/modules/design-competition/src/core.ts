import type { ContributionPoint, CoreModule, ModuleKind, SlashCommand } from "@isocan/core";
import { FIGHTER_MIME, PROPERTY_KEYS, boutRounds } from "./bout.ts";
import { DEFAULT_PACKS } from "./packdata.ts";
import { FIGHTERS_POINT, packProblems } from "./packs.ts";

/**
 * **The design competition** (`docs/projects/design-competition/`) — *choose
 * your fighter*: pick designers, give them one brief, watch an agent per
 * designer build a rival design in its own lane, and vote.
 *
 * Built as a module on purpose, because it is the module system's hardest
 * test: it ships content (nine packs, as assets), declares a point other
 * modules add fighters to, opens a dialog, scopes a design system to each
 * lane, casts agents through a template, and curtains its own vote. Every
 * one of those is a platform change any module can use; none is a door made
 * for this one.
 *
 * And it adds no operation. A bout is areas and items, a ballot is
 * reactions, a fighter is an enrolled agent — take the module away and every
 * arena is still a set of files and every vote is still in the log.
 */

/** The fighter card: the one new kind, and only because a portrait needs a
 *  renderer. Without the module it is a small JSON file. */
export const FIGHTER_KIND: ModuleKind = {
  id: "fighter",
  mimes: [FIGHTER_MIME],
  extensions: ["fighter"],
  label: "Fighters",
  noun: "fighter card",
  icon: "document",
};

/**
 * **`/design-competition`** — local on the web (it opens the picker), a skill
 * on the terminal: an agent reading it from the Chat lays the arena and starts
 * the bout with the verbs, and never picks the winner.
 */
export const COMPETITION_COMMAND: SlashCommand = {
  name: "design-competition",
  description: "Choose your fighters — rival designers build one brief, the room votes",
  usage: "<what to design>",
  source: "module",
  opens: "fighters",
  body: `Run a design competition on this canvas: famous designers' philosophies,
as agents, building rival designs of one brief, side by side — and the room
votes. You set it up; you never vote and never decide.

1. Read the roster: \`isocan competition fighters\`. Every fighter is an HOMAGE
   named for its principle — never refer to an agent as the person.
2. If the brief is missing or one word, ask ONE question in the thread and
   stop: what are we designing, and for whom.
3. Pick three fighters whose philosophies will disagree about THIS brief
   (a dense tool: Fast Is a Feature vs Less but Better vs Show the Data; a
   first-run screen: Road Signs vs Inevitable vs Build to Think), unless the
   person named them. Say why in one line.
4. \`isocan competition new "<brief>" --fighters a,b,c\` lays the arena (add
   \`--attach <item>\` when the message was about a screen, and
   \`--decider <person>\` naming who asked).
5. \`isocan competition start\` enrols one agent per fighter on the rc and
   hands each its brief in its lane. It refuses with a sentence when no rc is
   parked — say that sentence to the person; do not work around it.
6. Post ONE comment: the arena is laid, who is fighting and why, the clock,
   and that people rank 🥇🥈🥉 by *which best answers the brief*.

Never build an entry yourself, never rank one, never place a 🏆.`,
};

/** **The point fighters are added to** — declared here, validated by the same
 *  function that holds the nine this module ships. */
export const FIGHTERS: ContributionPoint = {
  id: FIGHTERS_POINT,
  describe: "designer packs the picker offers as fighters — data: a pack.json shape and a directory of files",
  validate: packProblems,
};

/**
 * The record. `contributes` offers the module's own nine to its own point —
 * so the roster has ONE reader (`contributions`) whether a fighter came from
 * here or from a data-only module somebody added later.
 */
export const competitionCore: CoreModule = {
  name: "@isocan/design-competition",
  propertyKeys: PROPERTY_KEYS,
  kinds: [FIGHTER_KIND],
  commands: [COMPETITION_COMMAND],
  points: [FIGHTERS],
  contributes: { [FIGHTERS_POINT]: DEFAULT_PACKS },
  rounds: boutRounds,
};

/** The runtime loader reads `mod.default`; a named export alone builds and
 *  loads nothing. */
export default competitionCore;
