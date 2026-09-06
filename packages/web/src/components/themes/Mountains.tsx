import type { ThemeAnchor } from "@isocan/core";
import { useUiStore } from "../../stores/uiStore.ts";

/**
 * **Terrain from above** (#195).
 *
 * The awkward one to generate, and the reason is worth writing down: what
 * people picture when they hear "mountains" is a SKYLINE — peaks against a
 * sky — and a skyline is the one thing an infinite canvas cannot have,
 * because a horizon repeats absurdly the moment it tiles. So this is what
 * mountains look like on a map rather than from a valley: ridgelines running
 * across the ground, light on one flank and shadow on the other.
 *
 * That reframing is what makes it generable at all. A ridge in plan view is a
 * band with a bright side and a dark side, which is two gradients; a peak
 * against a sky is a picture.
 *
 * ## Relief is a lit side and a shadowed side
 *
 * Each band carries white then black across its width, always in the same
 * order, so every ridge appears lit from one consistent direction. Getting
 * that order wrong on one layer is what makes terrain look like fabric —
 * relief is a claim about where the light is, and the eye rejects it
 * instantly when two layers disagree.
 *
 * Two ridge systems at different angles, because real terrain has a grain and
 * a cross-grain, plus one long, very faint band suggesting the larger
 * valleys the smaller ridges sit inside.
 *
 * ## The limits, stated
 *
 * There is no snow, no rock, no erosion and no drainage — this is relief as
 * pattern. A painted tile would beat it and the switch takes one without
 * rework (#195, 6 Sep). What it buys is a ground today that tiles infinitely,
 * costs no download, and stays quiet enough to work on.
 */
export function Mountains({ anchor }: { anchor: ThemeAnchor }) {
  const scale = useUiStore((s) => s.viewport.scale);
  const tx = useUiStore((s) => s.viewport.tx);
  const ty = useUiStore((s) => s.viewport.ty);
  const pinned = anchor === "window";

  /**
   * Angle, period in world units, and how hard the light and shadow fall.
   *
   * The first draft was half these values and read as a dark textured surface
   * rather than as terrain — relief you have to be told is there is not
   * relief. Doubled on the dominant ridge and left faint on the third, which
   * is the one suggesting the larger valleys the others sit inside. Shadow
   * carries roughly twice the light, because that is how a lit slope reads.
   */
  const ridges = [
    { deg: 24, size: 520, light: 0.085, dark: 0.19 },
    { deg: -37, size: 310, light: 0.05, dark: 0.12 },
    { deg: 71, size: 1150, light: 0.03, dark: 0.075 },
  ];

  const fade = pinned ? 1 : Math.max(0, Math.min(1, (scale - 0.1) / 0.4));
  const at = (n: number) => (pinned ? n / 3 : n * scale);

  return (
    <div
      className="canvas-theme canvas-theme-mountains"
      style={
        {
          "--ridge-fade": String(fade),
          // Light then shadow, in that order, on every layer — the direction
          // the sun comes from, and the thing that must not disagree.
          "--ridge": ridges
            .map(
              (r) =>
                `repeating-linear-gradient(${r.deg}deg, rgba(255,255,255,${r.light}) 0px, rgba(0,0,0,0) ${at(r.size) * 0.28}px, rgba(0,0,0,${r.dark}) ${at(r.size) * 0.52}px, rgba(0,0,0,0) ${at(r.size) * 0.78}px, rgba(255,255,255,${r.light}) ${at(r.size)}px)`,
            )
            .join(", "),
          "--ridge-pos": ridges.map(() => (pinned ? "0 0" : `${tx}px ${ty}px`)).join(", "),
        } as React.CSSProperties
      }
    />
  );
}
