import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Grant, GrantSubject } from "@isocan/core";
import { LINK } from "@isocan/core";
import { FileDesk } from "../src/file-desk.ts";
import { admittingGrant } from "../src/grants.ts";
import { killAndSweep, sweepCanvas } from "../src/sweep.ts";
import type { Provenance } from "../src/desk.ts";
import { mintBadge } from "../src/badges.ts";

/**
 * **The provenance sweep, and what it must not do** (identity desk, mechanism
 * 4; phase 9).
 *
 * The design states the failure mode by name — *"turning off the link would
 * expel the very people who were invited by name"* — so the tests are written
 * around that rather than around the happy path. Every case here is a shape
 * that a sweep written the obvious way gets wrong: a chain several passes
 * long, a chain whose middle badge is gone, a cycle, and a badge that another
 * grant still covers.
 *
 * It runs against a real `FileDesk` rather than a stub, because the awkward
 * shapes are ones the desk has to store faithfully — an admission rooted at a
 * badge id, a grant that is a tombstone rather than a deletion — and a stub
 * that stored them the way the sweep wanted would be testing the sweep against
 * its own assumptions.
 *
 * Fixtures are synthetic: Acme's canvas, Priya, Jordan, Nico.
 */

const CANVAS = "prj_acme";
const OTHER = "prj_other";

let home: string;
let desk: FileDesk;
let badges = 0;

/** A badge on the desk, named for readability. The secret is real (`mintBadge`
 * does the crypto) and irrelevant here — nothing in a sweep presents one. */
async function badge(): Promise<string> {
  const { record } = mintBadge("bearer");
  const named = { ...record, badgeId: `bdg_${++badges}` };
  await desk.put(named);
  return named.badgeId;
}

async function grantOn(subject: GrantSubject, canvasId = CANVAS): Promise<Grant> {
  const row: Grant = {
    id: `gnt_${subject.replace(/[^a-z0-9]/gi, "_")}_${canvasId}`,
    canvasId,
    subject,
    grantedBy: "bdg_owner",
    at: new Date(Date.UTC(2026, 0, 1)).toISOString(),
  };
  await desk.putGrant(row);
  return row;
}

const admit = (badgeId: string, provenance: Provenance, canvasId = CANVAS) =>
  desk.admit(badgeId, canvasId, provenance);

/** Which canvases this badge is still in — the whole of what a sweep changes. */
async function inRooms(badgeId: string): Promise<string[]> {
  return ((await desk.badge(badgeId))?.admissions ?? []).map((a) => a.canvasId).sort();
}

async function rootOf(badgeId: string, canvasId = CANVAS): Promise<Provenance | undefined> {
  const found = (await desk.badge(badgeId))?.admissions.find((a) => a.canvasId === canvasId);
  return found?.provenance;
}

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-sweep-"));
  desk = new FileDesk(home);
  await desk.init();
  badges = 0;
});

afterEach(async () => {
  await desk.close();
  await fs.rm(home, { recursive: true, force: true });
});

describe("revoking a grant expels the people it let in", () => {
  it("sweeps the badges rooted in it, and leaves everybody else alone", async () => {
    const link = await grantOn(LINK);
    const stranger = await badge();
    const creator = await badge();
    await admit(stranger, { root: "grant", grantId: link.id });
    await admit(creator, { root: "created" });

    await desk.revokeGrant(link.id, new Date().toISOString(), "bdg_owner");
    expect(await sweepCanvas(desk, CANVAS)).toEqual({ expelled: 1, rerooted: 0 });

    expect(await inRooms(stranger)).toEqual([]);
    // "The only root that is not somebody let me in, and the only one a sweep
    // never touches."
    expect(await inRooms(creator)).toEqual([CANVAS]);
  });

  it("does not touch a canvas it was not asked about", async () => {
    const here = await grantOn(LINK);
    await grantOn(LINK, OTHER);
    const jordan = await badge();
    await admit(jordan, { root: "grant", grantId: here.id });
    await admit(jordan, { root: "grant", grantId: `gnt_link_${OTHER}` }, OTHER);

    await desk.revokeGrant(here.id, new Date().toISOString(), "bdg_owner");
    await sweepCanvas(desk, CANVAS);

    expect(await inRooms(jordan)).toEqual([OTHER]);
  });

  it("is a no-op when nothing's root has moved — a sweep is not a purge", async () => {
    const link = await grantOn(LINK);
    const jordan = await badge();
    await admit(jordan, { root: "grant", grantId: link.id });

    expect(await sweepCanvas(desk, CANVAS)).toEqual({ expelled: 0, rerooted: 0 });
    expect(await inRooms(jordan)).toEqual([CANVAS]);
  });
});

describe("the chain: a pass-derived admission inherits its minter's root", () => {
  it("reaches a daemon and an agent several hops away, in one sweep", async () => {
    const link = await grantOn(LINK);
    // Jordan's tab came in on the link; her daemon on a pass from the tab;
    // Nico's sandbox on a pass from the daemon. Nothing had ever walked one
    // of these chains before phase 9 — phase 8 built it precisely so this
    // could.
    const tab = await badge();
    const daemon = await badge();
    const nico = await badge();
    await admit(tab, { root: "grant", grantId: link.id });
    await admit(daemon, { root: "pass", badgeId: tab });
    await admit(nico, { root: "pass", badgeId: daemon });

    await desk.revokeGrant(link.id, new Date().toISOString(), "bdg_owner");
    expect(await sweepCanvas(desk, CANVAS)).toEqual({ expelled: 3, rerooted: 0 });

    expect(await inRooms(tab)).toEqual([]);
    expect(await inRooms(daemon)).toEqual([]);
    expect(await inRooms(nico)).toEqual([]);
  });

  it("keeps the whole chain when its root RE-ROOTS rather than dropping", async () => {
    const link = await grantOn(LINK);
    const invited = await grantOn("email:jordan@acme.test");
    const tab = await badge();
    const daemon = await badge();
    await desk.attest(tab, {
      attribute: "email:jordan@acme.test",
      verifiedVia: "magic-link",
      at: new Date().toISOString(),
    });
    // Both would admit her; the door names the OLDEST, which is the link.
    await admit(tab, { root: "grant", grantId: link.id });
    await admit(daemon, { root: "pass", badgeId: tab });

    await desk.revokeGrant(link.id, new Date().toISOString(), "bdg_owner");
    // One re-rooted, and the daemon is not counted at all: its root did not
    // stop standing, because the badge it names is still admitted.
    expect(await sweepCanvas(desk, CANVAS)).toEqual({ expelled: 0, rerooted: 1 });

    expect(await rootOf(tab)).toEqual({ root: "grant", grantId: invited.id });
    // The chain is untouched and still points at the tab — a re-root does not
    // rewrite the people downstream of it, it only stops them dangling.
    expect(await rootOf(daemon)).toEqual({ root: "pass", badgeId: tab });
  });

  it("expels a chain whose middle badge is gone", async () => {
    const link = await grantOn(LINK);
    const laptop = await badge();
    const enrolled = await badge();
    await admit(laptop, { root: "grant", grantId: link.id });
    await admit(enrolled, { root: "pass", badgeId: laptop });

    // The laptop is ENDED rather than expelled: its badge cannot authenticate
    // any more, so the machine it vouched in is hanging off a holder the home
    // no longer recognises. The link grant is untouched and still live.
    await desk.killBadge(laptop, new Date().toISOString(), "bdg_phone");
    expect(await sweepCanvas(desk, CANVAS)).toEqual({ expelled: 0, rerooted: 1 });

    // Re-rooted, not expelled — the link is still on, so the machine is still
    // admitted, just no longer on the strength of a dead badge.
    expect(await rootOf(enrolled)).toEqual({ root: "grant", grantId: link.id });

    // With the link off there is nothing left to catch it.
    await desk.revokeGrant(link.id, new Date().toISOString(), "bdg_owner");
    expect(await sweepCanvas(desk, CANVAS)).toEqual({ expelled: 1, rerooted: 0 });
    expect(await inRooms(enrolled)).toEqual([]);
  });

  it("expels a cycle, which no walk from the revoked grant could ever reach", async () => {
    const link = await grantOn(LINK);
    const a = await badge();
    const b = await badge();
    // A vouched B in; then A was expelled and got back in on a pass from B.
    // Neither names a grant any more, so a sweep that walked FORWARD from the
    // revoked row would find neither of them and both would live forever.
    await admit(a, { root: "pass", badgeId: b });
    await admit(b, { root: "pass", badgeId: a });

    await desk.revokeGrant(link.id, new Date().toISOString(), "bdg_owner");
    expect(await sweepCanvas(desk, CANVAS)).toEqual({ expelled: 2, rerooted: 0 });
    expect(await inRooms(a)).toEqual([]);
    expect(await inRooms(b)).toEqual([]);
  });

  it("keeps a cycle whose members the door would admit anyway", async () => {
    await grantOn(LINK);
    const a = await badge();
    const b = await badge();
    await admit(a, { root: "pass", badgeId: b });
    await admit(b, { root: "pass", badgeId: a });

    // Nothing was revoked: the cycle is unstanding on its own, so the door is
    // re-asked and the live link grant answers. Nobody is expelled — and only
    // ONE of them is rewritten, which is the sweep being minimal rather than
    // thorough: once either member names a real grant, the other's chain
    // resolves through it and there is nothing left to fix. A sweep that
    // re-rooted both would be rewriting a root that had started standing again.
    expect(await sweepCanvas(desk, CANVAS)).toEqual({ expelled: 0, rerooted: 1 });
    expect(await inRooms(a)).toEqual([CANVAS]);
    expect(await inRooms(b)).toEqual([CANVAS]);
    const roots = [await rootOf(a), await rootOf(b)];
    expect(roots.filter((root) => root?.root === "grant")).toHaveLength(1);
    // And a second sweep finds nothing to do, which is the property that
    // matters: the cycle is broken, not merely survived.
    expect(await sweepCanvas(desk, CANVAS)).toEqual({ expelled: 0, rerooted: 0 });
  });
});

describe("re-rooting: the half that stops a revocation being a purge", () => {
  it("turning off the link keeps the person invited by name, and expels the stranger", async () => {
    const link = await grantOn(LINK);
    const invited = await grantOn("email:jordan@acme.test");
    const jordan = await badge();
    const stranger = await badge();
    await desk.attest(jordan, {
      attribute: "email:jordan@acme.test",
      verifiedVia: "magic-link",
      at: new Date().toISOString(),
    });
    await admit(jordan, { root: "grant", grantId: link.id });
    await admit(stranger, { root: "grant", grantId: link.id });

    await desk.revokeGrant(link.id, new Date().toISOString(), "bdg_owner");
    expect(await sweepCanvas(desk, CANVAS)).toEqual({ expelled: 1, rerooted: 1 });

    expect(await inRooms(jordan)).toEqual([CANVAS]);
    expect(await rootOf(jordan)).toEqual({ root: "grant", grantId: invited.id });
    expect(await inRooms(stranger)).toEqual([]);
  });

  it("revoking the EMAIL grant expels her, and the link does not catch her when it is off", async () => {
    const invited = await grantOn("email:jordan@acme.test");
    const jordan = await badge();
    await desk.attest(jordan, {
      attribute: "email:jordan@acme.test",
      verifiedVia: "magic-link",
      at: new Date().toISOString(),
    });
    await admit(jordan, { root: "grant", grantId: invited.id });

    await desk.revokeGrant(invited.id, new Date().toISOString(), "bdg_owner");
    expect(await sweepCanvas(desk, CANVAS)).toEqual({ expelled: 1, rerooted: 0 });
    expect(await inRooms(jordan)).toEqual([]);
  });

  it("uses the DOOR's own test, not a lookalike — an attestation nobody granted admits nobody", async () => {
    const link = await grantOn(LINK);
    const jordan = await badge();
    await desk.attest(jordan, {
      attribute: "email:jordan@acme.test",
      verifiedVia: "magic-link",
      at: new Date().toISOString(),
    });
    await admit(jordan, { root: "grant", grantId: link.id });

    // No email grant on this canvas: proving something nobody asked for is
    // not a way in. The door says so, and so does the sweep, because they are
    // the same function.
    expect(await admittingGrant(desk, CANVAS, (await desk.badge(jordan))!)).toMatchObject({
      subject: LINK,
    });
    await desk.revokeGrant(link.id, new Date().toISOString(), "bdg_owner");
    expect(await admittingGrant(desk, CANVAS, (await desk.badge(jordan))!)).toBeNull();
    expect(await sweepCanvas(desk, CANVAS)).toEqual({ expelled: 1, rerooted: 0 });
  });
});

describe("the sweep does not spare the badge that triggered it", () => {
  /**
   * **Recorded as a decision, not discovered as a bug.**
   *
   * Turning the link off from a browser tab that CAME IN on that link expels
   * that tab. Measured against a real daemon while walking this stage: the
   * canvas was created from a terminal (`{root: "created"}` on the CLI's
   * bearer badge), opened in a browser (`{root: "grant"}` on the cookie
   * badge), and the Share dialog's own toggle then locked the browser out of
   * the canvas — landing it on phase 7's terminal page, which told the person
   * who had just switched the link off to "ask whoever shared it".
   *
   * It is left exactly as the design specifies, and the alternative is worse:
   * exempting the revoker would leave that badge's admission rooted at a
   * revoked grant, which the very next sweep of that canvas would expel
   * anyway — a one-gesture reprieve that evaporates silently. There is no
   * honest root to give them instead, because the thing that would provide
   * one is a subject that binds to a person, and the design leaves roles open
   * ("whether grants may carry roles waits for a scene that forces it").
   *
   * What DID change is that the consequence is now stated before the click,
   * in the dialog and in the verb. This test is here so the behaviour cannot
   * drift without somebody meeting this argument.
   */
  it("expels the revoker too, when the revoker came in on the row it revoked", async () => {
    const link = await grantOn(LINK);
    const cli = await badge();
    const tab = await badge();
    await admit(cli, { root: "created" });
    await admit(tab, { root: "grant", grantId: link.id });

    await desk.revokeGrant(link.id, new Date().toISOString(), tab);
    expect(await sweepCanvas(desk, CANVAS)).toEqual({ expelled: 1, rerooted: 0 });
    expect(await inRooms(tab)).toEqual([]);
    // The terminal that MADE the canvas is untouched, which is why this bites
    // browser-first arrivals and not the machine that created the thing.
    expect(await inRooms(cli)).toEqual([CANVAS]);
  });
});

describe("historical provenance, and the hole it leaves on purpose", () => {
  it("leaves a pre-grant `link` root standing, because it names no row to revoke", async () => {
    const link = await grantOn(LINK);
    const ancient = await badge();
    // What phases 2 to 6 wrote, before there was a grant to point at.
    await admit(ancient, { root: "link" });

    await desk.revokeGrant(link.id, new Date().toISOString(), "bdg_owner");
    expect(await sweepCanvas(desk, CANVAS)).toEqual({ expelled: 0, rerooted: 0 });
    // A real hole in revocation, bounded to badges minted before phase 7 —
    // and the alternative is a revocation expelling holders it cannot name.
    // Kill-a-badge is what reaches this one.
    expect(await inRooms(ancient)).toEqual([CANVAS]);
  });

  it("treats a grant id that points at nothing as a root that does not stand", async () => {
    await grantOn(LINK);
    const orphan = await badge();
    await admit(orphan, { root: "grant", grantId: "gnt_vanished" });

    // The live link grant catches it, so it stays — but under a row somebody
    // can actually produce. Revocation is a tombstone precisely so this shape
    // stays rare; when it happens the honest reading is "ask the door again".
    expect(await sweepCanvas(desk, CANVAS)).toEqual({ expelled: 0, rerooted: 1 });
    expect(await rootOf(orphan)).toMatchObject({ root: "grant" });
  });
});

describe("kill-a-badge composes with revocation rather than duplicating it", () => {
  it("ends the holder and sweeps every room it had vouched people into", async () => {
    await grantOn(LINK);
    const linkGrant = (await desk.grantsFor(CANVAS))[0]!;
    await grantOn(LINK, OTHER);
    const laptop = await badge();
    const enrolled = await badge();
    await admit(laptop, { root: "grant", grantId: linkGrant.id });
    await admit(laptop, { root: "grant", grantId: `gnt_link_${OTHER}` }, OTHER);
    await admit(enrolled, { root: "pass", badgeId: laptop });

    // The link is off on THIS canvas, so the machine the laptop enrolled has
    // nothing else to stand on here; on the other canvas the laptop was alone.
    await desk.revokeGrant(linkGrant.id, new Date().toISOString(), "bdg_owner");
    const outcome = await killAndSweep(desk, laptop, "bdg_phone");

    expect(outcome!.killed.badgeId).toBe(laptop);
    expect(outcome!.swept).toEqual({ expelled: 1, rerooted: 0 });
    expect(await desk.badge(laptop)).toBeNull();
    expect(await inRooms(enrolled)).toEqual([]);
  });

  it("does not un-invite: a live grant still catches what the dead badge let in", async () => {
    const link = await grantOn(LINK);
    const laptop = await badge();
    const enrolled = await badge();
    await admit(laptop, { root: "grant", grantId: link.id });
    await admit(enrolled, { root: "pass", badgeId: laptop });

    const outcome = await killAndSweep(desk, laptop, "bdg_phone");
    expect(outcome!.swept).toEqual({ expelled: 0, rerooted: 1 });
    expect(await inRooms(enrolled)).toEqual([CANVAS]);
  });

  it("is idempotent, and the second caller sweeps nothing", async () => {
    await grantOn(LINK);
    const laptop = await badge();
    await admit(laptop, { root: "created" });

    expect(await killAndSweep(desk, laptop, "bdg_phone")).not.toBeNull();
    expect(await killAndSweep(desk, laptop, "bdg_phone")).toBeNull();
    expect(await killAndSweep(desk, "bdg_nobody", "bdg_phone")).toBeNull();
  });
});
