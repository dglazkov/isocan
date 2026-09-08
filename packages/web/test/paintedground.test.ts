import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { THEMES, themeLabel } from "@isocan/core";

import { PAINTED } from "../src/components/themes/PaintedGround.tsx";
import { rules, selectorsOf } from "./cssrules.ts";

/**
 * **A ground is a file now, and a name with no file is a blank canvas.**
 *
 * The art for #195 arrived on 8 Sep 2026 and the shape of the feature changed
 * with it: for a fortnight, adding a ground meant writing a component, and the
 * comment on `THEMES` held farm back on exactly that ground — *"a canvas
 * wearing a name nothing can draw shows the dot grid with no way to explain
 * itself"*. Adding one is now a line in `THEMES`, a line in `PAINTED` and a
 * JPEG, which is three places to get right instead of one, and only the first
 * of them fails loudly on its own.
 *
 * So this is the check the old comment was doing by hand: every name in
 * `THEMES` can actually be drawn — by the starfield, or by a picture that
 * exists on disk, is served with a type the server knows, and has a holding
 * colour behind it for the moment before it loads.
 *
 * The last part is not fussiness. A tile is 139–663KB and arrives after the
 * first paint; whatever `background-color` sits under it is what a person sees
 * for that moment and what the top fade is drawn from. Get it wrong and every
 * cold load flashes a different ground.
 */

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));

/** The ground drawn in code rather than painted. Its own guard is
 *  `galaxy.test.ts`; here it is the one name allowed to have no file. */
const GENERATED = "galaxy";

describe("every ground this build offers can actually be drawn", () => {
  it("has a picture on disk for every painted name", () => {
    for (const theme of THEMES) {
      if (theme === GENERATED) continue;
      const art = PAINTED[theme];
      expect(art, `${theme} is offered in the picker and has no art`).toBeTruthy();
      const file = `${publicDir}grounds/${art!.file}.jpg`;
      expect(existsSync(file), `${theme} names ${art!.file}.jpg, which is not in public/grounds/`).toBe(
        true,
      );
    }
  });

  it("offers no art for a ground nobody can choose", () => {
    /* The other direction, and the cheaper mistake: a tile shipped for a name
       that was renamed or removed is bytes in the image nothing can ever
       fetch. Neither half of this pair is visible from the other. */
    for (const name of Object.keys(PAINTED)) {
      expect(THEMES as readonly string[], `${name} has art and is not a ground`).toContain(name);
    }
  });

  it("keeps every tile under the size a person is allowed to upload", () => {
    /**
     * `GROUND_MAX` caps a picture somebody supplies at 2MB, and the reason it
     * gives is about everybody else: *"a picture is downloaded by everybody on
     * that canvas, on every cold load, forever"*. That is exactly as true of a
     * seeded ground, which is downloaded by more people rather than fewer — so
     * shipping a tile heavier than a person is allowed to upload would be the
     * app breaking its own rule while enforcing it.
     *
     * As delivered, two of the four were over: 5.3MB and 4.7MB at 2048².
     */
    for (const [theme, art] of Object.entries(PAINTED)) {
      const bytes = statSync(`${publicDir}grounds/${art.file}.jpg`).size;
      expect(bytes, `${theme} is ${(bytes / 1024 / 1024).toFixed(1)}MB`).toBeLessThan(2 * 1024 * 1024);
    }
  });

  it("gives every painted ground a holding colour of its own", () => {
    /* What shows before the JPEG arrives, and what `groundtone.ts` draws the
       top fade from. Its own rule, not the shared one: the tile behaviour is
       `.canvas-theme-painted` and this is the half that differs. */
    for (const theme of Object.keys(PAINTED)) {
      const rule = rules().find((r) => selectorsOf(r).includes(`.canvas-theme-${theme}`));
      expect(rule, `.canvas-theme-${theme} must have a rule`).toBeTruthy();
      expect(rule!.body, `${theme} must hold a colour while its picture loads`).toMatch(
        /background-color:\s*var\(--[a-z-]+\)/,
      );
    }
  });

  it("says a real word for every ground, on both surfaces", () => {
    /* `themeLabel` is a switch, so a new name compiles only once it is added —
       but a label that is the id with a capital letter is the menu showing you
       its variable, which is what that function exists to prevent. */
    for (const theme of THEMES) {
      const label = themeLabel(theme);
      expect(label.length, `${theme} has no label`).toBeGreaterThan(0);
      expect(label).not.toBe(theme);
    }
  });

  it("sizes each tile in world units, not screen pixels", () => {
    /**
     * The whole point of a world-space ground: a field stays under whatever is
     * standing in it. A number small enough to be a pixel count would be a
     * ground that tiles dozens of times across one screen and slides under the
     * items — the failure `Galaxy.tsx` describes as "nothing is ever *in* a
     * place". Every tile here is hundreds of canvas units on a side.
     */
    for (const [theme, art] of Object.entries(PAINTED)) {
      expect(art.world, `${theme}'s tile is sized like a sprite`).toBeGreaterThan(500);
      expect(art.world, `${theme}'s tile is bigger than most canvases`).toBeLessThan(10000);
    }
  });
});
