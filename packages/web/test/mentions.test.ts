import { describe, expect, it } from "vitest";
import { emptyCanvas, extractMentions } from "@isocan/core";
import type { PresenceSession } from "@isocan/core";
import { mentionRoster } from "../src/lib/mentions.ts";

const kenny = { id: "usr_kenny", name: "Kenny" };
const alice = { id: "usr_alice", name: "Alice" };

function session(
  actor: { id: string; name: string },
  scope: "project" | "home",
  label: string | null = null,
): PresenceSession {
  return {
    sessionId: `ses_${actor.id}_${scope}`,
    actor,
    kind: "cli",
    scope,
    label,
    cursor: null,
    selection: [],
    status: null,
    activity: null,
    lastSeen: new Date(0).toISOString(),
  };
}

describe("mention roster", () => {
  it("offers an on-call agent on a canvas nobody has touched yet", () => {
    // The issue's canvas: brand new, so its state names nobody at all.
    const { peers, candidates } = mentionRoster(
      emptyCanvas(),
      [session(kenny, "home", "Kenny 🤖")],
      alice.id,
    );
    expect(peers).toEqual([{ id: kenny.id, name: "Kenny 🤖", online: true, onCall: true }]);
    // …and the name the menu offers actually resolves when posted.
    expect(extractMentions("@Kenny 🤖 can you look?", candidates)).toEqual([kenny.id]);
  });

  it("orders the menu: here, then on call, then merely remembered", () => {
    const bob = { id: "usr_bob", name: "Bob" };
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
    const peers = mentionRoster(
      canvas,
      [session(kenny, "home"), session(bob, "project")],
      alice.id,
    ).peers;
    expect(peers.map((p) => p.name)).toEqual(["Bob", "Kenny", "Nico"]);
  });
});
