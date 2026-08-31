import type { Actor } from "@isocan/core";
import { sendOp } from "./api.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { rememberMark } from "./marks.ts";

/**
 * Choose the color you wear. `actor.setColor` is home-scoped — it changes the
 * actor registry, not a canvas — so it is sent with a null canvasId and lands
 * in the home's actors log beside your name.
 *
 * The daemon pushes the new map to every open canvas on the next roster; the
 * local echo here is only so YOUR menu answers the click immediately.
 */
export async function setActorColor(actor: Actor, color: string | null): Promise<void> {
  await sendOp(null, actor, { type: "actor.setColor", actorId: actor.id, color });
  const colors = { ...useCanvasStore.getState().actorColors };
  if (color === null) delete colors[actor.id];
  else colors[actor.id] = color;
  useCanvasStore.setState({ actorColors: colors });
}

/**
 * Choose the mark you wear instead of your initial. `actor.setMark` is
 * home-scoped for the same reason the colour is, and takes the same route.
 *
 * **Where it differs, said plainly:** a colour is pushed to every open canvas
 * on the next roster, so other people see it at once. A mark is not in the
 * roster — it is read from `/api/marks` — so somebody else's new emoji reaches
 * your screen on your next load rather than instantly. The local echo below
 * is what makes YOUR own face change under your hand.
 */
export async function setActorMark(actor: Actor, mark: string | null): Promise<void> {
  await sendOp(null, actor, { type: "actor.setMark", actorId: actor.id, mark });
  rememberMark(actor.id, mark);
}
