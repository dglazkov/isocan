import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ParkCursors, parkCursorsFile } from "../src/park.ts";

/**
 * The durable park cursor's state machine (on-demand phase 1), pinned at the
 * unit: three watermarks per row (`cursor ≤ rehanded ≤ delivered`), advance
 * only on completion evidence, one reader per row with the newest adopting.
 * The end-to-end walk — a real park killed and resumed — lives in
 * `cli/test/wait-cursor.test.ts`; what these pin is the arithmetic that walk
 * depends on, including the double-death bound: an entry is handed at most
 * twice, the second time marked, and then settled.
 */

let home: string;
let park: ParkCursors;

const spoke = (answer: boolean) => async () => answer;
const seedAt = (seq: number) => async () => seq;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-park-"));
  park = new ParkCursors(home);
});

afterEach(async () => {
  await fs.rm(home, { recursive: true, force: true });
});

describe("the row's life", () => {
  it("a first claim seeds at now and outstands nothing", async () => {
    const claim = await park.claim("prj_1", "usr_a", { seed: seedAt(7), actorSpoke: spoke(false) });
    expect(claim.cursor).toBe(7);
    expect(claim.redeliverUpTo).toBeNull();
  });

  it("a wake records the high-water without advancing the cursor", async () => {
    const claim = await park.claim("prj_1", "usr_a", { seed: seedAt(0), actorSpoke: spoke(false) });
    await park.delivered("prj_1", "usr_a", claim.parkId, 5);
    // A fresh store reading the same file: what survives the process is the
    // whole point.
    const later = await new ParkCursors(home).claim("prj_1", "usr_a", {
      seed: seedAt(99),
      actorSpoke: spoke(false),
    });
    expect(later.cursor).toBe(0); // not advanced — the turn left no trace
    expect(later.redeliverUpTo).toBe(5); // handed again, marked
  });

  it("the actor having spoken after the delivery is completion — the cursor advances", async () => {
    const claim = await park.claim("prj_1", "usr_a", { seed: seedAt(0), actorSpoke: spoke(false) });
    await park.delivered("prj_1", "usr_a", claim.parkId, 5);
    const later = await park.claim("prj_1", "usr_a", { seed: seedAt(99), actorSpoke: spoke(true) });
    expect(later.cursor).toBe(5);
    expect(later.redeliverUpTo).toBeNull();
  });

  it("an entry is handed at most twice: rehand once marked, then settle", async () => {
    // Wake at 5, die. Rehand marked, die again. The third park settles —
    // the actor came back after a marked redelivery, which is the bound.
    const c1 = await park.claim("prj_1", "usr_a", { seed: seedAt(0), actorSpoke: spoke(false) });
    await park.delivered("prj_1", "usr_a", c1.parkId, 5);
    const c2 = await park.claim("prj_1", "usr_a", { seed: seedAt(99), actorSpoke: spoke(false) });
    expect(c2.redeliverUpTo).toBe(5);
    await park.delivered("prj_1", "usr_a", c2.parkId, 5);
    const c3 = await park.claim("prj_1", "usr_a", { seed: seedAt(99), actorSpoke: spoke(false) });
    expect(c3.cursor).toBe(5);
    expect(c3.redeliverUpTo).toBeNull();
  });

  it("a rehand that picked up new entries settles only the twice-handed prefix", async () => {
    // Wake at 5, die. The rehand wake carries 1..5 again plus new 6..9, die
    // again. The next park settles 5 (handed twice) and rehands 6..9 marked
    // — an entry handed once as new comes back marked, never as new.
    const c1 = await park.claim("prj_1", "usr_a", { seed: seedAt(0), actorSpoke: spoke(false) });
    await park.delivered("prj_1", "usr_a", c1.parkId, 5);
    const c2 = await park.claim("prj_1", "usr_a", { seed: seedAt(99), actorSpoke: spoke(false) });
    await park.delivered("prj_1", "usr_a", c2.parkId, 9);
    const c3 = await park.claim("prj_1", "usr_a", { seed: seedAt(99), actorSpoke: spoke(false) });
    expect(c3.cursor).toBe(5);
    expect(c3.redeliverUpTo).toBe(9);
  });

  it("a quiet advance settles noise completely", async () => {
    const claim = await park.claim("prj_1", "usr_a", { seed: seedAt(0), actorSpoke: spoke(false) });
    await park.advance("prj_1", "usr_a", claim.parkId, 12);
    const later = await park.claim("prj_1", "usr_a", { seed: seedAt(99), actorSpoke: spoke(false) });
    expect(later.cursor).toBe(12);
    expect(later.redeliverUpTo).toBeNull();
  });

  it("--since resets the row", async () => {
    const c1 = await park.claim("prj_1", "usr_a", { seed: seedAt(0), actorSpoke: spoke(false) });
    await park.delivered("prj_1", "usr_a", c1.parkId, 5);
    const reset = await park.claim("prj_1", "usr_a", {
      since: 2,
      seed: seedAt(99),
      actorSpoke: spoke(false),
    });
    expect(reset.cursor).toBe(2);
    expect(reset.redeliverUpTo).toBeNull();
  });

  it("rows are per actor and per canvas", async () => {
    const a = await park.claim("prj_1", "usr_a", { seed: seedAt(3), actorSpoke: spoke(false) });
    await park.delivered("prj_1", "usr_a", a.parkId, 8);
    const b = await park.claim("prj_1", "usr_b", { seed: seedAt(6), actorSpoke: spoke(false) });
    const elsewhere = await park.claim("prj_2", "usr_a", { seed: seedAt(1), actorSpoke: spoke(false) });
    expect(b.cursor).toBe(6);
    expect(elsewhere.cursor).toBe(1);
  });
});

describe("one reader per row — the newest adopts", () => {
  it("a second claim displaces the first, which learns at its next write", async () => {
    const first = await park.claim("prj_1", "usr_a", { seed: seedAt(0), actorSpoke: spoke(false) });
    const second = await park.claim("prj_1", "usr_a", { seed: seedAt(0), actorSpoke: spoke(false) });
    expect(await park.delivered("prj_1", "usr_a", first.parkId, 5)).toBe(false);
    expect(await park.advance("prj_1", "usr_a", first.parkId, 5)).toBe(false);
    expect(await park.delivered("prj_1", "usr_a", second.parkId, 5)).toBe(true);
  });

  it("a displaced reader's refusal writes nothing", async () => {
    const first = await park.claim("prj_1", "usr_a", { seed: seedAt(0), actorSpoke: spoke(false) });
    await park.claim("prj_1", "usr_a", { seed: seedAt(0), actorSpoke: spoke(false) });
    await park.delivered("prj_1", "usr_a", first.parkId, 50);
    const raw = JSON.parse(await fs.readFile(parkCursorsFile(home), "utf8"));
    expect(raw["prj_1 usr_a"].delivered).toBe(0);
  });
});
