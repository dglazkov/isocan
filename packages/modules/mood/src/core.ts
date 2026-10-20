import type { CoreModule, SlashCommand } from "@isocan/core";
import { MOOD_PROPS } from "@isocan/core/mood";

const MOODBOARD_COMMAND: SlashCommand = {
  name: "moodboard",
  description: "Explore a look — generate mood-board pictures before drawing screens",
  usage: "<what it should feel like>",
  source: "module",
  opens: "mood-explore",
  body: [
    "Explore how this product should feel by generating mood-board pictures on the canvas.",
    "",
    "1. Run `isocan mood explore \"<the person's words>\" --yes` to generate 9 candidate tiles across axes (light, material, texture, colour field, era, density, place, lettering-as-object).",
    "2. To branch from an existing tile, run `isocan mood more <item> [--push <dial>] --yes` (dials: warmer, cooler, quieter, louder, older, newer, rougher, finer).",
    "3. Never run `isocan mood keep` — keeping is a person's taste, not an agent's.",
  ].join("\n"),
};

/**
 * **The record both surfaces register** (moodboard phases 0–1). A tile is an
 * ordinary image item, so the module owns no kind — only the provenance keys
 * the home writes onto each one (`docs/projects/moodboard/design.md` §1) and
 * the `/moodboard` command that opens the Explore dialog.
 */
export const moodModule: CoreModule = {
  name: "@isocan/mood",
  propertyKeys: Object.values(MOOD_PROPS),
  itemReferenceProperties: [MOOD_PROPS.parent],
  commands: [MOODBOARD_COMMAND],
};

export default moodModule;
