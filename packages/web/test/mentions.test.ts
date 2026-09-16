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
    harness: null,
    label,
    cursor: null,
    selection: [],
    status: null,
    statusSource: null,
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

  it("orders a roster that spans a home and a replica the same way", () => {
    // New as of phase 6, and worth pinning in phase 7: the roster a tab
    // receives now mixes sessions living at the home (a person's browser) with
    // sessions RELAYED up from someone's laptop daemon (their parked agent).
    // The picker has no idea which is which and must not — a mirrored session
    // is a session, so the ordering rule stays "here first, then merely
    // remembered", and a parked agent stays PICKABLE, which is the whole point
    // of showing it: Scene 4's Priya mentions Isaac from this menu while he is
    // asleep on her own machine.
    const jordan = { id: "usr_jordan", name: "Jordan" }; // a tab at the home
    const isaac = { id: "usr_isaac", name: "Isaac" }; // relayed from a laptop
    const canvas = emptyCanvas();
    canvas.threads["thr_1"] = {
      id: "thr_1",
      x: 0,
      y: 0,
      anchorItemId: null,
      main: false,
      createdAt: "",
      createdBy: { id: "usr_zoe", name: "Zoe" }, // touched the canvas, long gone
      comments: [],
    };

    const { peers, candidates } = mentionRoster(
      canvas,
      [session(isaac, "Isaac 🤖"), session(jordan)],
      alice.id,
    );
    expect(peers).toEqual([
      { id: isaac.id, name: "Isaac 🤖", online: true },
      { id: jordan.id, name: "Jordan", online: true },
      { id: "usr_zoe", name: "Zoe", online: false },
    ]);
    // And the label a relayed agent wears resolves when the comment is posted,
    // which is what actually wakes it.
    expect(extractMentions("@Isaac 🤖 can you re-cut these?", candidates)).toEqual([isaac.id]);
  });

  /**
   * A stamped name is a log entry, not an identity — and the @-menu is the
   * surface where that costs the most.
   *
   * `PresenceSession.actor.name` is frozen at the moment the session started.
   * The menu used to offer it directly (`session.label ?? session.actor.name`),
   * so somebody who renamed themselves mid-session was still listed under the
   * old name, and picking that entry wrote a mention that reached nobody.
   *
   * `actorsAnswerTo` does not cover this: it walks the actors the CANVAS
   * remembers, and a live session on a canvas this person has not written on
   * yet is not one of them. That is the exact case in the first test in this
   * file.
   */
  it("offers a live agent under the name they answer to NOW, not the one they arrived with", () => {
    const { peers, candidates } = mentionRoster(
      emptyCanvas(),
      [session({ id: "usr_dion", name: "Dion 2" })],
      alice.id,
      { usr_dion: "Di" },
    );
    expect(peers).toEqual([{ id: "usr_dion", name: "Di", online: true }]);
    // …and the name the menu just offered actually reaches them.
    expect(extractMentions("@Di can you look?", candidates)).toEqual(["usr_dion"]);
  });

  it("still lets an explicit --label win over the registry", () => {
    // The label is a deliberate display override for THIS session ("Kenny 🤖"),
    // so a rename of the underlying actor must not overwrite it.
    const { peers } = mentionRoster(
      emptyCanvas(),
      [session({ id: "usr_dion", name: "Dion 2" }, "deploy bot")],
      alice.id,
      { usr_dion: "Di" },
    );
    expect(peers).toEqual([{ id: "usr_dion", name: "deploy bot", online: true }]);
  });

  it("falls through a blank label to the registry rather than offering nobody", () => {
    // An empty chip names no one; `sessionName` treats a blank label as absent
    // for the same reason `actorNameIn` treats a blank registry name as absent.
    const { peers } = mentionRoster(
      emptyCanvas(),
      [session({ id: "usr_dion", name: "Dion 2" }, "   ")],
      alice.id,
      { usr_dion: "Di" },
    );
    expect(peers).toEqual([{ id: "usr_dion", name: "Di", online: true }]);
  });
});

/**
 * **A name you cannot summon is marked, not hidden.**
 *
 * Asked the other way round — *"if you type '@' it shouldn't show you names
 * that you can't control… filter it"* — and argued in
 * `docs/research/2026-09-15-reading-the-facepile.md`. A name that is absent
 * reads as *does not exist*, which makes "no such agent" and "not yours" the
 * same thing to a reader; and the refusal a person currently gets after
 * sending is the most useful sentence in the flow. Saying it before the click
 * is better than saying it after. Saying nothing is worse than both.
 */
describe("the menu marks an agent whose gate is shut to you", () => {
  const scout = { id: "usr_scout", name: "Scout" };
  const shutToAlice = () => ({ canSummon: false, owner: "Admiral One" });

  it("keeps the name, says whose it is, and says it will not answer", () => {
    const { peers } = mentionRoster(emptyCanvas(), [session(scout)], alice.id, undefined, undefined, shutToAlice);
    expect(peers).toEqual([
      { id: scout.id, name: "Scout", online: true, shut: true, note: "won't answer you — Admiral One's" },
    ]);
  });

  it("still RESOLVES it, so a body naming it is a real mention", () => {
    // The gate decides whether a summons is answered, never whether the words
    // point at somebody. A mention that stopped resolving would silently
    // become plain text in the comment.
    const { candidates } = mentionRoster(emptyCanvas(), [session(scout)], alice.id, undefined, undefined, shutToAlice);
    expect(candidates.map((c) => c.name)).toContain("Scout");
  });

  it("ranks it below a name that will answer, however it sorts otherwise", () => {
    // "Alice" sorts before "Scout" alphabetically AND Scout is the live one,
    // so only the shut flag can put Scout last — if it stops being consulted
    // this test fails rather than passing by luck.
    const { peers } = mentionRoster(
      emptyCanvas(),
      [session(scout)],
      kenny.id,
      undefined,
      undefined,
      (id) => (id === scout.id ? shutToAlice() : null),
    );
    // Alice is offline and merely remembered; Scout is live. Shut still loses.
    const withAlice = mentionRoster(
      emptyCanvas(),
      [session(scout), session(alice)],
      kenny.id,
      undefined,
      undefined,
      (id) => (id === scout.id ? shutToAlice() : null),
    );
    expect(peers.map((p) => p.name)).toEqual(["Scout"]);
    expect(withAlice.peers.map((p) => p.name)).toEqual(["Alice", "Scout"]);
  });

  it("marks nothing when no gate is known — silence is not a refusal", () => {
    // Nothing answering for an agent is a different fact from an agent that
    // will not answer YOU, and the menu must not merge them.
    const { peers } = mentionRoster(emptyCanvas(), [session(scout)], alice.id);
    expect(peers).toEqual([{ id: scout.id, name: "Scout", online: true }]);
  });
});
