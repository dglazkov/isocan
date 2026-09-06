import type { ThemeAnchor } from "@isocan/core";
import { useUiStore } from "../../stores/uiStore.ts";

/**
 * **Open water, seen from above** (#195).
 *
 * The second generated ground, and it is a plan view for the same reason the
 * starfield has no edges: a canvas is infinite, so anything with a horizon in
 * it cannot tile. Looking straight down at open water has no horizon, no
 * shore and no focal point — which is exactly the constraint, and also what
 * makes it restful to work on.
 *
 * ## Three swells, not one
 *
 * A single repeating band reads as corduroy. Three at different angles and
 * periods — the long one carrying most of the movement, the short one
 * breaking it up — interfere with each other, and interference is what stops
 * the eye finding the repeat. The angles are deliberately not multiples of
 * each other for the same reason the starfield's spacings are co-prime-ish.
 *
 * ## Why it is so faint
 *
 * Items sit ON this. A ground that competes is a ground somebody turns off,
 * and the contrast bounds this project holds on the front door mean the same
 * thing here. The swell is a few per cent of white over a deep teal; at
 * reading zoom it is texture you notice when you look for it, which is the
 * right amount of ocean for a work surface.
 *
 * ## The limits, stated
 *
 * This is water as pattern, not as picture — no caustics, no foam, no light.
 * A painted tile would beat it, and the theme switch takes one without
 * rework: the door is deliberately left open (#195, 6 Sep). What this buys is
 * a ground today, at no download and no artist, that tiles infinitely by
 * construction.
 */
export function Ocean({ anchor }: { anchor: ThemeAnchor }) {
  const scale = useUiStore((s) => s.viewport.scale);
  const tx = useUiStore((s) => s.viewport.tx);
  const ty = useUiStore((s) => s.viewport.ty);
  const pinned = anchor === "window";

  /** Angle, period in world units, and how much white the crest carries. */
  const swells = [
    { deg: 8, size: 460, light: 0.05 },
    { deg: -13, size: 270, light: 0.035 },
    { deg: 31, size: 130, light: 0.022 },
  ];

  // Same trade as the starfield: a world-space pattern turns into fabric when
  // you zoom out past it, so it fades where the canvas is being read as a map.
  // A pinned ocean never changes density, so it never needs protecting.
  const fade = pinned ? 1 : Math.max(0, Math.min(1, (scale - 0.1) / 0.4));
  const at = (n: number) => (pinned ? n / 3 : n * scale);

  return (
    <div
      className="canvas-theme canvas-theme-ocean"
      style={
        {
          "--swell-fade": String(fade),
          "--swell": swells
            .map(
              (s) =>
                `repeating-linear-gradient(${s.deg}deg, rgba(255,255,255,0) 0px, rgba(255,255,255,${s.light}) ${at(s.size) * 0.34}px, rgba(255,255,255,0) ${at(s.size) * 0.62}px, rgba(255,255,255,0) ${at(s.size)}px)`,
            )
            .join(", "),
          "--swell-pos": swells.map(() => (pinned ? "0 0" : `${tx}px ${ty}px`)).join(", "),
        } as React.CSSProperties
      }
    />
  );
}
