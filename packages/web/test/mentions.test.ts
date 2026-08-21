import { describe, expect, it } from "vitest";
import { emptyCanvas, extractMentions } from "@isocan/core";
import type { PresenceSession } from "@isocan/core";
import { mentionRoster } from "../src/lib/mentions.ts";

const kenny = { id: "usr_kenny", name: "Kenny" };
const alice = { id: "usr_alice", name: "Alice" };

function session(
  actor: { id: string; name: string },
  label: string | null = null,
): PresenceSession {
  return {
    sessionId: `ses_${actor.id}`,
    actor,
    kind: "cli",
    label,
    cursor: null,
    selection: [],
    status: null,
    activity: null,
    onThread: null,
    lastSeen: new Date(0).toISOString(),
  };
}

describe("mention roster", () => {
  it("offers a live agent on a canvas nobody has commented on yet", () => {
    // A brand-new canvas: its state names nobody at all, so the roster is
    // fed entirely by presence.
    const { peers, candidates } = mentionRoster(
      emptyCanvas(),
      [session(kenny, "Kenny 🤖")],
      alice.id,
    );
    expect(peers).toEqual([{ id: kenny.id, name: "Kenny 🤖", online: true }]);
    // …and the name the menu offers actually resolves when posted.
    expect(extractMentions("@Kenny 🤖 can you look?", candidates)).toEqual([kenny.id]);
  });

  it("orders the menu: here, then merely remembered", () => {
    const nico = { id: "usr_nico", name: "Nico" };
    const canvas = emptyCanvas();
    canvas.threads["thr_1"] = {
      id: "thr_1",
      x: 0,
      y: 0,
      anchorItemId: null,
      main: false,
      createdAt: "",
      createdBy: nico,
      comments: [],
    };
    const peers = mentionRoster(canvas, [session(kenny)], alice.id).peers;
    expect(peers.map((p) => p.name)).toEqual(["Kenny", "Nico"]);
  });
});
