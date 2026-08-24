import type { Actor } from "@isocan/core";
import { sendOp } from "./api.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";

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
