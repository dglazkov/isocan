import type { Actor, PresenceSession } from "@isocan/core";
import { mainThread, newThreadId } from "@isocan/core";

import { screenToWorld } from "./viewport.ts";
import { sendEchoed, useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { makeComment } from "../components/CommentLayer.tsx";

/**
 * Post a message to this canvas's main thread — the user's direct channel to
 * their emissary. Anything landing here wakes a parked agent's `isocan wait`
 * with no @-mention needed, on whatever canvas it is parked on. Shared by the
 * docked panel and the ⌘K command bar so there is exactly one way to reach the
 * agent, and both create the thread the same way on a virgin canvas.
 */
export async function postToMain(
  canvasId: string,
  actor: Actor,
  body: string,
  /** Items the message is about — the selection, carried as ids so an agent
   * can act on exactly what was on screen rather than guess from the words. */
  attached: string[] = [],
): Promise<void> {
  const withItems = (text: string) => {
    const comment = makeComment(text);
    if (attached.length === 0) return comment;
    return { ...comment, items: [...new Set([...(comment.items ?? []), ...attached])] };
  };
  const existing = mainThread(useCanvasStore.getState().canvas!);
  if (existing) {
    await sendEchoed(canvasId, actor, {
      type: "thread.reply",
      threadId: existing.id,
      comment: withItems(body),
    });
    return;
  }
  // First message births the thread. Its coordinates are where the pin would
  // land if the channel is ever demoted — the middle of the current view.
  const ui = useUiStore.getState();
  const center = screenToWorld(ui.viewport, window.innerWidth / 2, window.innerHeight / 2);
  try {
    await sendEchoed(canvasId, actor, {
      type: "thread.create",
      threadId: newThreadId(),
      x: Math.round(center.x),
      y: Math.round(center.y),
      anchorItemId: null,
      main: true,
      comment: withItems(body),
    });
  } catch {
    // Lost a birth race ("main-exists") — the winner's thread is the channel
    // now; deliver the message there.
    const winner = mainThread(useCanvasStore.getState().canvas!);
    if (winner) {
      await sendEchoed(canvasId, actor, {
        type: "thread.reply",
        threadId: winner.id,
        comment: withItems(body),
      });
    }
  }
}

/**
 * Which agents (CLI sessions) can hear a main-thread post right now — the
 * ones standing on this canvas. Web sessions are humans, so they are left
 * out. Used to tell the user whether their emissary is actually listening
 * before they hit enter.
 */
function listeningAgents(sessions: PresenceSession[]): PresenceSession[] {
  return sessions.filter((s) => s.kind === "cli");
}
