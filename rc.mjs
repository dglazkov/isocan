/**
 * **`import { … } from "isocan/rc"`** — the room module's entry
 * (docs/projects/room/design.md, "packages/rc, exported as isocan/rc").
 *
 * A mirror of `index.mjs`, for the same reason: the release branch ships
 * TypeScript sources, so this registers tsx and the workspace loader and then
 * hands back `@isocan/rc`'s surface. The re-export is dynamic and NAMED,
 * because a static `export *` would look for `@isocan/rc` while the module
 * graph links, before the loader that knows where it lives is registered
 * (iso-api phase 4). `packages/rc/test/entry.test.ts` holds the name list
 * equal to the package's runtime surface.
 *
 * Types come from the manifest's `types` condition, not from here.
 */
import { register as registerLoader } from "node:module";
import { register } from "tsx/esm/api";
register();
registerLoader("./packages/cli/bin/workspace-loader.mjs", import.meta.url);

const rc = await import("@isocan/rc");

export const {
  // guards.ts — the dispatch guards
  gateTurn,
  // helpers.ts — the pure helpers the room speaks with
  actorNamesOn,
  enrolmentKey,
  itemCenter,
  nameResolver,
  summonsPrompt,
  threadLocus,
  // room.ts — the room itself, over what a host hands it
  mapState,
  runRoom,
  // skill.ts — the collab skill's text, generated
  COLLAB_SKILL,
} = rc;
