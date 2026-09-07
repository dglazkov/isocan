import { GROUND_SCRIM } from "@isocan/core";
import { blobUrl } from "../../lib/api.ts";

/**
 * **A ground somebody supplied** (#204 phase 2).
 *
 * > "For the background feature… there should be a 'custom' setting where the
 * > user can set a tile and cursor and then it takes on its own?"
 *
 * The three seeded grounds are generated, cost nothing and tile forever by
 * construction. This one is a picture, and the two things that follow are the
 * whole of the component.
 *
 * ## Pinned, so there is no seam
 *
 * A world-anchored ground repeats, and a photograph that is not seamless
 * repeats as a grid of its own edges — the one failure a person cannot debug
 * and did not cause. A pinned ground never repeats, so it is drawn once,
 * `cover`, centred: the picture behind the glass while the work travels
 * across it. `core/theme.ts`'s `groundPatch` pins it rather than this
 * component assuming it, so `isocan canvas background --ground` gets the same
 * default without a second decision. World-anchored custom grounds are phase
 * 4, for somebody who has actually made a tile.
 *
 * ## The scrim, which is what makes any picture safe
 *
 * Every seeded ground is dark on purpose so white item cards read as objects
 * standing on them. Somebody's holiday photograph will not be. The overlay
 * below is one rule the app applies rather than a judgement it asks a person
 * to make, and its opacity is derived in `GROUND_SCRIM` rather than picked by
 * eye: at 0.7 even a pure white image leaves a white card 3:1 against the
 * ground, which is what "reads as an object standing on it" means.
 *
 * It is a second element rather than a `linear-gradient` layered over the
 * image in one `background` shorthand, because the two want different
 * `background-size` values — `cover` for the picture, nothing for a flat fill
 * — and a shorthand that has to say `cover, auto` is a place for the two to
 * fall out of step.
 *
 * No `Suspense` boundary of its own, no fade-in: `CanvasThemeLayer` already
 * lazily loads this, and a ground arriving a frame late is invisible in a way
 * a missing item never would be.
 */
export function CustomGround({ canvasId, hash }: { canvasId: string; hash: string }) {
  return (
    <div className="canvas-theme canvas-theme-custom">
      <div
        className="canvas-ground-picture"
        style={{ backgroundImage: `url(${blobUrl(canvasId, hash)})` }}
      />
      <div className="canvas-ground-scrim" style={{ opacity: GROUND_SCRIM }} />
    </div>
  );
}
