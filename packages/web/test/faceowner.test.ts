import { describe, expect, it } from "vitest";
import type { Actor, PresenceSession } from "@isocan/core";
import { facesFor } from "../src/lib/facepile.ts";
import { faceMarkClass, faceMarkStyle } from "../src/lib/face.ts";
import { actorColorIn } from "../src/lib/colors.ts";

/**
 * **An agent wears its owner's colour, and that is how you know it is one.**
 *
 * `docs/research/2026-09-15-reading-the-facepile.md`. The pile used to answer
 * one question — who is this — and a canvas holding two people, four agents,
 * two rcs and a sheep drew a row of near-identical discs. The two questions it
 * could not answer are *"is that a human?"* and *"whose agent is that?"*, and
 * one field answers both: a face with an owner is an agent, and the owner is
 * whose it is.
 *
 * The guard matters because the two halves live in different files — the
 * derivation in `lib/facepile.ts`, the drawing in `lib/face.ts` — and the
 * failure mode is silent: an agent that loses its owner does not error, it
 * just quietly renders as a person.
 */

const dion: Actor = { id: "usr_dion", name: "Dion Almaer" };
const dolly: Actor = { id: "usr_dolly", name: "Dolly" };
const scout: Actor = { id: "usr_scout", name: "Scout" };

const noUnread = new Map<string, { actor: Actor; count: number }>();

function session(actor: Actor, sessionId: string): PresenceSession {
  return {
    sessionId,
    actor,
    kind: "web",
    label: null,
    cursor: null,
    selection: [],
    activity: null,
    lastSeen: new Date().toISOString(),
  } as unknown as PresenceSession;
}

/** Dion owns Dolly; Scout belongs to somebody else; Dion is nobody's. */
const ownerOf = (id: string) =>
  id === dolly.id
    ? { id: dion.id, name: dion.name }
    : id === scout.id
      ? { id: "usr_admiral", name: "Admiral One" }
      : null;

describe("a face says whether it is an agent, and whose", () => {
  it("carries the owner onto a standing agent and leaves a person's null", () => {
    const faces = facesFor([session(dion, "ses_web")], noUnread, dion, [dolly], ownerOf);
    const byId = new Map(faces.map((f) => [f.actor.id, f]));
    expect(byId.get(dolly.id)?.owner).toEqual({ id: dion.id, name: dion.name });
    expect(byId.get(dion.id)?.owner).toBeNull();
  });

  /**
   * The owner is asked once inside `push`, not at the four places a face is
   * made. This is the assertion that keeps it that way: a fifth state added
   * later gets an owner for free, and cannot be the one that forgot.
   */
  it("asks for every face, whichever state it arrived in", () => {
    const unread = new Map([[scout.id, { actor: scout, count: 2 }]]);
    const faces = facesFor([session(dion, "ses_web")], unread, dion, [dolly], ownerOf);
    // here (Dion), available (Dolly), away-with-unread (Scout) — three
    // different pushes, three owners resolved.
    expect(faces.map((f) => [f.actor.name, f.owner?.name ?? null])).toEqual(
      expect.arrayContaining([
        ["Dion Almaer", null],
        ["Dolly", "Dion Almaer"],
        ["Scout", "Admiral One"],
      ]),
    );
  });

  /** An owner nothing knows must not become a wrong owner. Drawing it as a
   * person is the honest failure: it is what the pile did before owners
   * existed, rather than a guess at whose it is. */
  it("leaves the owner null when neither the rc nor the enrolment says", () => {
    const faces = facesFor([], noUnread, dion, [dolly], () => null);
    expect(faces.find((f) => f.actor.id === dolly.id)?.owner).toBeNull();
  });
});

describe("the ring is the agent's shape, and the owner's colour", () => {
  it("rings an agent that wears no mark at all", () => {
    // Without this an unmarked agent falls back to a filled disc, which is
    // exactly what a person looks like.
    expect(faceMarkClass({}, dolly, undefined, true)).toBe("face-mark ringed");
    expect(faceMarkClass({}, dolly, undefined, false)).toBe("face-mark");
  });

  it("still rings a marked person, so the emoji rule is untouched", () => {
    expect(faceMarkClass({ usr_dion: "⚓" }, dion)).toBe("face-mark ringed");
  });

  it("hands the OWNER's colour to CSS for an agent, and its own for a person", () => {
    const colors = {};
    const mine = actorColorIn(colors, dion.id);
    const hers = actorColorIn(colors, dolly.id);
    // The test is only meaningful if the two differ; if the palette ever
    // collapses them this says so rather than passing vacuously.
    expect(mine).not.toBe(hers);
    expect(faceMarkStyle(colors, dolly, { id: dion.id })).toEqual({ "--face": mine });
    expect(faceMarkStyle(colors, dolly, null)).toEqual({ "--face": hers });
    expect(faceMarkStyle(colors, dolly)).toEqual({ "--face": hers });
  });
});
