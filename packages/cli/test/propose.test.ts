import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { type Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { PROPOSAL_CAP, itemChrome, overlaps } from "@isocan/core";
import { cliEnv, runCli, type Run } from "./cli.ts";

/**
 * **`isocan propose` and `isocan taste`, over the real CLI wire**
 * (proactive-agent phase 1). The rules themselves are core's and unit-tested
 * there (`packages/core/test/proposal.test.ts`); this holds that the
 * terminal refuses an empty cite list and a proposal past the cap in the
 * same words, that what lands hangs beneath its source on nothing, and that
 * a plain `add` carrying the properties is refused by the canvas itself — the
 * door the web would go through, since the web never mints a proposal.
 */
const kit = { id: "usr_kit", name: "Kit" };

let home: string;
let daemon: Daemon;
let base: string;
let source: string;
let page: string;

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-propose-"));
  await fs.writeFile(path.join(home, "identity.json"), JSON.stringify({ ...kit, createdAt: new Date().toISOString() }));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  page = path.join(home, "checkout.html");
  await fs.writeFile(page, "<!doctype html><title>Checkout</title><h1>Pickup Saturday 9:00</h1><p>Total $12</p>");
  await json("canvas", "create", "Acme Bakery");
  source = (await json("add", page, "--at", "0,0", "--size", "390x640", "--title", "Checkout")).itemId;
});

afterAll(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function isocan(...args: string[]): Promise<Run> {
  return runCli(args, { cwd: home, env: cliEnv({ ISOCAN_HOME: home, ISOCAN_PORT: new URL(base).port }) });
}

async function json(...args: string[]): Promise<any> {
  const run = await isocan(...args, "--json");
  expect(run.code, run.stderr).toBe(0);
  return JSON.parse(run.stdout);
}

const WHY = "Summary before detail: the pickup time comes first.";

describe("isocan propose", () => {
  it("refuses a proposal with no cites, and says what to do", async () => {
    const run = await isocan("propose", source, page, "--why", WHY);
    expect(run.code).not.toBe(0);
    expect(run.stderr).toMatch(/no trigger, no proposal.*--cites kind:ref/);
    const bad = await isocan("propose", source, page, "--why", WHY, "--cites", "vibes");
    expect(bad.code).not.toBe(0);
    expect(bad.stderr).toContain("is not a cite");
  });

  it(`lands ${PROPOSAL_CAP} beneath the source, clear of each other, and refuses the next`, async () => {
    const placed: { x: number; y: number; width: number; height: number }[] = [];
    for (let i = 0; i < PROPOSAL_CAP; i++) {
      const out = await json("propose", source, page, "--cites", "op:1", "--why", WHY, ...(i % 2 ? ["--hunch"] : []));
      expect(out.room).toBe(PROPOSAL_CAP - 1 - i);
      const item = await json("show", out.itemId);
      expect(item.properties.parent).toBe(source);
      expect(item.properties.proposal).toBe(i % 2 ? "hunch" : "sure");
      expect(JSON.parse(item.properties.proposalCites)).toEqual([{ kind: "op", ref: "1" }]);
      placed.push({ x: item.x, y: item.y, width: item.width, height: item.height });
    }
    // Beneath: below the source's bottom edge, centred on it, none on another.
    for (const box of placed) {
      expect(box.y).toBeGreaterThanOrEqual(640);
      expect(box.x).toBe(0);
    }
    expect(new Set(placed.map((b) => b.y)).size).toBe(PROPOSAL_CAP);
    const sixth = await isocan("propose", source, page, "--cites", "op:1", "--why", WHY);
    expect(sixth.code).not.toBe(0);
    expect(sixth.stderr).toContain(`already have ${PROPOSAL_CAP} open proposals`);
    expect(sixth.stderr).toContain("only when the person keeps or deletes one");
  });

  it("is refused by the canvas itself when another door sends one without a cite", async () => {
    // A note rather than a screen, so the design-system nudge on a seventh
    // screen is not the refusal this reads.
    const note = path.join(home, "note.md");
    await fs.writeFile(note, "pickup first");
    const run = await isocan("add", note, "--prop", `parent=${source}`, "--prop", "proposal=sure", "--prop", `proposalWhy=${WHY}`);
    expect(run.code).not.toBe(0);
    expect(run.stderr).toContain("no trigger, no proposal");
  });
});

describe("isocan taste", () => {
  it("makes the pinned note on first need, then adds one line at a time", async () => {
    const empty = await json("taste");
    expect(empty.itemId).toBeNull();
    const first = await json("taste", "No gates before value.");
    const note = await json("show", first.itemId);
    expect(note.title).toBe("What your deletes taught");
    expect(note.properties.taste).toBe("1");
    expect(note.properties.context).toBe("pinned");
    await json("taste", "Keep the photo.");
    // The note lands on nothing — footprints, not boxes: each item's name
    // strip above and marks row below count (core's \`itemChrome\`), which is
    // what a note drawn over a screen's name strip got wrong.
    const listed = await json("ls");
    const all = Array.isArray(listed) ? listed : listed.items;
    const items = await Promise.all((all as { id: string }[]).map((one) => json("show", one.id)));
    const foot = (i: any) => { const c = itemChrome(i); return { x: i.x, y: i.y - c.above, width: i.width, height: i.height + c.above + c.below }; };
    expect(items.length, "the source and its proposals are on the canvas to collide with").toBeGreaterThan(PROPOSAL_CAP);
    const mine = foot(items.find((i) => i.id === first.itemId));
    for (const other of items.filter((i) => i.id !== first.itemId)) {
      expect(overlaps(mine, foot(other), 0), `the taste note's footprint overlaps "${other.title}"`).toBe(false);
    }
    const read = await json("taste");
    expect(read.itemId).toBe(first.itemId);
    expect(read.text).toBe("# What your deletes taught\n- No gates before value.\n- Keep the photo.\n");
  });
});
