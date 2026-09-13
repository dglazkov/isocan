import { FIGHTER_KIND } from "./activation.ts";
import { COMPETITION_COMMAND } from "./command.ts";
export { FIGHTER_KIND } from "./activation.ts";
export { COMPETITION_COMMAND } from "./command.ts";
import type { ContributionPoint, CoreModule } from "@isocan/core";
import { PROPERTY_KEYS, boutRounds } from "./bout.ts";
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
