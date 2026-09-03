import type { CSSProperties } from "react";
import { markOf, type ActorColors, type ActorMarks } from "@isocan/core";
import { actorColorIn } from "./colors.ts";

/**
 * **The colour fills the disc behind an initial, and rings it behind an
 * emoji.** A letter is drawn in white on the actor's colour and reads on any
 * of them. An emoji is not drawn by us — it is a small full-colour picture,
 * and on a saturated disc (the blues especially) its own colours and the
 * disc's fight, so the mark is hard to see. Lightening the palette would
 * have cost the initials their contrast to fix the emojis; a ring keeps the
 * colour on the face without putting anything under the picture.
 *
 * Every face goes through these two, so the rule lives once: the colour is
 * handed to CSS as `--face`, and `.face-mark.ringed` decides what to do with
 * it. A face that later wears or removes a mark changes shape on its own,
 * because the class follows `marks`.
 */
export function faceMarkClass(marks: ActorMarks | undefined, actor: { id: string }, extra?: string): string {
  const ringed = markOf(marks, actor) !== null;
  return [extra, "face-mark", ringed ? "ringed" : null].filter(Boolean).join(" ");
}

export function faceMarkStyle(colors: ActorColors, actor: { id: string }): CSSProperties {
  return { ["--face" as string]: actorColorIn(colors, actor.id) } as CSSProperties;
}
