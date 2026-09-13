import { describe, expect, it } from "vitest";
import type { RcAsk } from "@isocan/core";
import { RcHolds } from "../src/rc-holds.ts";

/**
 * The rc hold registry (agent-custody mechanisms 1 and 2), pinned at the
 * unit: the connection is the fact (a hold's agents are answerable exactly
 * while it is open), a mirror lives exactly as long as the socket that
 * asserted it, and an ask reaches whoever is parked — an open hold, the
 * brief queue between back-to-back holds, or a mirror's socket — and is
 * refused when nobody is. The wire around this (the `rc-relay`/`rc-ask`
 * messages, the routes) is exercised where wires are; this is the arithmetic
 * they depend on.
 */

const ask = (name: string): RcAsk => ({
  askId: `ask_${name}`,
  name,
  from: { id: "usr_asker", name: "Avery" },
});

const ids = (...actorIds: string[]) => new Set(actorIds);

describe("local holds: the connection is the fact", () => {
  it("nobody is parked until a hold is open, and nobody again when it times out", async () => {
    const rc = new RcHolds();
    expect(rc.answering("prj_1").parked).toBe(false);
    const hold = rc.hold("prj_1", ids("agt_a"), 20);
    expect(rc.answering("prj_1")).toEqual({ parked: true, actorIds: ["agt_a"], owners: [], policies: {} });
    await hold.done;
    // The flap window keeps the CHANGE notification quiet for a beat, but
    // the answer itself never lies: the hold is gone, so is the fact.
    expect(rc.answering("prj_1").parked).toBe(false);
  });

  it("a released hold (the socket died) stops answering at once", () => {
    const rc = new RcHolds();
    const hold = rc.hold("prj_1", ids("agt_a"), 60_000);
    hold.release();
    expect(rc.answering("prj_1").parked).toBe(false);
  });

  it("two holds union their agents", () => {
    const rc = new RcHolds();
    rc.hold("prj_1", ids("agt_a"), 60_000);
    rc.hold("prj_1", ids("agt_b"), 60_000);
    expect(new Set(rc.answering("prj_1").actorIds)).toEqual(ids("agt_a", "agt_b"));
  });
});

describe("asks reach whoever is parked", () => {
  it("an open hold gets the ask and resolves with it", async () => {
    const rc = new RcHolds();
    const hold = rc.hold("prj_1", ids(), 60_000);
    expect(rc.ask("prj_1", ask("Sian"))).toBe(true);
    expect((await hold.done).map((a) => a.name)).toEqual(["Sian"]);
  });

  it("the microsecond gap between back-to-back holds does not lose an ask", async () => {
    const rc = new RcHolds();
    // A hold ends (the rc is about to re-issue)…
    (await rc.hold("prj_1", ids("agt_a"), 5).done).length;
    // …the ask lands in the gap…
    expect(rc.ask("prj_1", ask("Sian"))).toBe(true);
    // …and the re-issued hold carries it.
    const next = rc.hold("prj_1", ids("agt_a"), 60_000);
    expect((await next.done).map((a) => a.name)).toEqual(["Sian"]);
  });

  it("a dead socket's release does not eat a queued ask", async () => {
    const rc = new RcHolds();
    const first = rc.hold("prj_1", ids(), 60_000);
    first.release();
    // Released with nothing: the asks that never reached it are not lost
    // because they were never handed to it.
    expect(await first.done).toEqual([]);
  });

  it("nobody parked, nobody mirrored: the ask is refused", () => {
    const rc = new RcHolds();
    expect(rc.ask("prj_1", ask("Sian"))).toBe(false);
  });
});

describe("mirrors: what a member machine relayed, alive as long as its socket", () => {
  it("a mirror's parked rc counts, and dies with dropMirror", () => {
    const rc = new RcHolds();
    rc.mirror("socket-1", "prj_1", { parked: true, actorIds: ids("agt_a"), sendAsk: () => true });
    expect(rc.answering("prj_1")).toEqual({ parked: true, actorIds: ["agt_a"], owners: [], policies: {} });
    rc.dropMirror("socket-1");
    expect(rc.answering("prj_1").parked).toBe(false);
  });

  it("an ask with only a mirror parked goes down that mirror's socket", () => {
    const rc = new RcHolds();
    const sent: RcAsk[] = [];
    rc.mirror("socket-1", "prj_1", {
      parked: true,
      actorIds: ids(),
      sendAsk: (a) => {
        sent.push(a);
        return true;
      },
    });
    expect(rc.ask("prj_1", ask("Sian"))).toBe(true);
    expect(sent.map((a) => a.name)).toEqual(["Sian"]);
  });

  it("a mirror that says nothing is parked is not asked", () => {
    const rc = new RcHolds();
    rc.mirror("socket-1", "prj_1", { parked: false, actorIds: ids(), sendAsk: () => true });
    expect(rc.ask("prj_1", ask("Sian"))).toBe(false);
  });

  it("a replaced relay replaces, never accumulates", () => {
    const rc = new RcHolds();
    rc.mirror("socket-1", "prj_1", { parked: true, actorIds: ids("agt_a"), sendAsk: () => true });
    rc.mirror("socket-1", "prj_1", { parked: true, actorIds: ids("agt_b"), sendAsk: () => true });
    expect(rc.answering("prj_1").actorIds).toEqual(["agt_b"]);
  });

  it("local answering never launders a mirror", () => {
    const rc = new RcHolds();
    rc.mirror("socket-1", "prj_1", { parked: true, actorIds: ids("agt_a"), sendAsk: () => true });
    expect(rc.answeringLocal("prj_1").parked).toBe(false);
  });
});

/**
 * **Owner-only summons** (11 Sep 2026): each hold says whose rc it is and
 * whose word each agent takes. This registry enforces no policy — the rc
 * does, at dispatch — but it says them, and it routes an ask to add an agent
 * only to an rc its asker owns.
 */
describe("whose rc, and whose word — owner-only summons", () => {
  const nico = { id: "usr_nico", name: "Nico" };
  const priya = { id: "usr_priya", name: "Priya" };
  const from = (actor: { id: string; name: string }, name = "Sian"): RcAsk => ({ askId: `ask_${name}`, name, from: actor });
  const same = (owner: { id: string }, askerId: string) => owner.id === askerId;

  it("answering says the owners and each agent's policy, local and mirrored alike", () => {
    const rc = new RcHolds();
    rc.hold("prj_1", ids("agt_a"), 60_000, { owner: nico, policies: { agt_a: { owner: nico, listen: [] } } });
    rc.mirror("socket-1", "prj_1", {
      parked: true,
      actorIds: ids("agt_b"),
      owners: [priya],
      policies: { agt_b: { owner: priya, listen: ["*"] }, agt_stray: { owner: priya, listen: ["*"] } },
      sendAsk: () => true,
    });
    const now = rc.answering("prj_1");
    expect(now.owners).toEqual([nico, priya]);
    // Only for agents the same relay actually holds — a stray policy is noise.
    expect(now.policies).toEqual({
      agt_a: { owner: nico, listen: [] },
      agt_b: { owner: priya, listen: ["*"] },
    });
    // What a daemon relays up is its own holds only, owners included.
    expect(rc.answeringLocal("prj_1").owners).toEqual([nico]);
  });

  it("an ask goes to the asker's own rc — never to somebody else's", async () => {
    const rc = new RcHolds();
    const nicos = rc.hold("prj_1", ids(), 60_000, { owner: nico });
    const priyas = rc.hold("prj_1", ids(), 60_000, { owner: priya });
    expect(rc.ask("prj_1", from(priya), same)).toBe(true);
    expect((await priyas.done).map((a) => a.from.id)).toEqual([priya.id]);
    nicos.release();
    expect(await nicos.done).toEqual([]);
  });

  it("only somebody else's rc parked: the ask is refused, and the owners are there to name", () => {
    const rc = new RcHolds();
    rc.hold("prj_1", ids(), 60_000, { owner: nico });
    expect(rc.ask("prj_1", from(priya), same)).toBe(false);
    expect(rc.answering("prj_1").owners).toEqual([nico]);
    const sent: RcAsk[] = [];
    rc.mirror("socket-1", "prj_2", { parked: true, actorIds: ids(), owners: [nico], sendAsk: (a) => (sent.push(a), true) });
    expect(rc.ask("prj_2", from(priya), same)).toBe(false);
    expect(sent).toEqual([]);
  });

  it("the gap between one owner's holds is that owner's — another's re-issue does not carry the ask off", async () => {
    const rc = new RcHolds();
    await rc.hold("prj_1", ids(), 5, { owner: nico }).done;
    expect(rc.ask("prj_1", from(nico), same)).toBe(true);
    const priyas = rc.hold("prj_1", ids(), 30, { owner: priya });
    expect(await priyas.done).toEqual([]);
    const nicos = rc.hold("prj_1", ids(), 60_000, { owner: nico });
    expect((await nicos.done).map((a) => a.from.id)).toEqual([nico.id]);
  });

  it("an rc too old to say whose it is takes anyone's ask, as every rc did before", async () => {
    const rc = new RcHolds();
    const legacy = rc.hold("prj_1", ids(), 60_000);
    expect(rc.ask("prj_1", from(priya), same)).toBe(true);
    expect((await legacy.done).map((a) => a.from.id)).toEqual([priya.id]);
  });
});

describe("the change signal the relay schedules on", () => {
  it("fires when a hold opens", () => {
    const rc = new RcHolds();
    const fired: string[] = [];
    rc.onChange((canvasId) => fired.push(canvasId));
    rc.hold("prj_1", ids("agt_a"), 60_000);
    expect(fired).toContain("prj_1");
  });

  it("says a canvas went down only after the flap window — a re-issue stays quiet", async () => {
    const rc = new RcHolds();
    const fired: string[] = [];
    const first = rc.hold("prj_1", ids("agt_a"), 5);
    rc.onChange((canvasId) => fired.push(canvasId));
    await first.done;
    rc.hold("prj_1", ids("agt_a"), 60_000); // the back-to-back re-issue
    await new Promise((r) => setTimeout(r, 400)); // outwait the flap window
    // One change for the re-issued hold; no down-and-up flap around the gap.
    expect(fired).toEqual(["prj_1"]);
  });

  it("a hold that ends and stays ended is announced down", async () => {
    const rc = new RcHolds();
    const fired: string[] = [];
    const hold = rc.hold("prj_1", ids("agt_a"), 5);
    rc.onChange((canvasId) => fired.push(canvasId));
    await hold.done;
    await new Promise((r) => setTimeout(r, 400));
    expect(fired).toEqual(["prj_1"]);
    expect(rc.answering("prj_1").parked).toBe(false);
  });
});
