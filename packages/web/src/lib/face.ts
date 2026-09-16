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
 *
 * **An agent is ringed whether or not it wears a mark** (reading the facepile,
 * 15 Sep 2026). The ring was the emoji's accommodation; it is also the shape
 * that can carry somebody ELSE's colour, which is what an agent needs. An
 * agent with no mark keeps its initial on that ringed disc — still legibly an
 * agent, just a duller one — rather than reverting to a filled disc and
 * reading as a person.
 */
export function faceMarkClass(
  marks: ActorMarks | undefined,
  actor: { id: string },
  extra?: string,
  agent = false,
): string {
  const ringed = agent || markOf(marks, actor) !== null;
  return [extra, "face-mark", ringed ? "ringed" : null].filter(Boolean).join(" ");
}

/**
 * **Whose colour a face wears: its own, or its owner's.**
 *
 * A person wears their own — the letter in white on a solid disc, which is
 * what identity has always meant here. An agent wears its OWNER's, as a ring,
 * so "whose agent is that" is answered by the same face that says what it is
 * (Dion, 15 Sep 2026: *"agents be emoji inside the color of the person who
 * owns it, and humans being the letter with the solid color"*).
 *
 * The colour goes on the ring rather than the fill because of what this file
 * already learned about emoji on saturated discs — see above. Passing no
 * owner is the old behaviour exactly, which is what an agent whose owner
 * nothing knows should get.
 */
export function faceMarkStyle(
  colors: ActorColors,
  actor: { id: string },
  owner?: { id: string } | null,
): CSSProperties {
  return { ["--face" as string]: actorColorIn(colors, owner?.id ?? actor.id) } as CSSProperties;
}
