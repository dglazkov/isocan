import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { type Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { cliEnv, runCli, type Run } from "./cli.ts";
import { mintTestBadge } from "./badge.ts";
import { parkedWait } from "./parked.ts";
import { CLIENT_FEATURES_HEADER, CURRENT_CLIENT_FEATURES } from "@isocan/core";

/**
 * **`isocan design card`, over the real CLI wire** (proactive-agent phase 5).
 * The card's reading and the re-read are core's and unit-tested there
 * (`packages/core/test/brief-card.test.ts`); this holds the terminal's half on
 * a synthetic Acme canvas: the card prints said lines solid and inferred ones
 * in pencil; Right makes a line the person's and the brief's history names
 * her; an edit with nobody to answer lands, writes nothing to any screen and
 * says the re-read waits; with Kit parked the edit's re-read reaches Kit, and
 * Kit's one question and its "matters more now" are read back.
 */
const maya = { id: "usr_bc_maya", name: "Maya" };

let home: string;
let daemon: Daemon;
let port: string;

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-brief-card-"));
  await fs.writeFile(path.join(home, "identity.json"), JSON.stringify({ ...maya, createdAt: new Date().toISOString() }));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  port = String(typeof address === "object" && address ? address.port : 0);
});

afterAll(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function isocan(args: string[], as?: Record<string, string>): Promise<Run> {
  return runCli(args, { cwd: home, env: cliEnv({ ISOCAN_HOME: home, ISOCAN_PORT: port, ...as }) });
}

async function json(args: string[], as?: Record<string, string>): Promise<any> {
  const run = await isocan([...args, "--json"], as);
  expect(run.code, run.stderr).toBe(0);
  return JSON.parse(run.stdout);
}

async function page(name: string, words: string): Promise<string> {
  const file = path.join(home, `${name}.html`);
  await fs.writeFile(file, `<!doctype html><title>${name}</title><h1>${words}</h1>`);
  return file;
}

describe("isocan design card", () => {
  let canvas: string;
  const screens: Record<string, string> = {};
  const kit = { ISOCAN_SESSION_ID: "brief-card-kit" };
  /** Every screen's versions — what an edit to the brief must never touch. */
  const screenState = async () => JSON.stringify(await Promise.all(Object.values(screens).map(async (id) => (await json(["--canvas", canvas, "show", id])).versions)));

  beforeAll(async () => {
    canvas = (await json(["canvas", "create", "Acme Bakery"])).canvasId;
    for (const [i, title] of ["Menu", "Checkout", "Basket"].entries()) {
      screens[title] = (await json(["--canvas", canvas, "add", await page(title, title), "--title", title, "--size", "390x640", "--at", `${i * 470},400`])).itemId;
    }
    const start = path.join(home, "start.json");
    await fs.writeFile(start, JSON.stringify({
      requestId: "req_acme_card", itemId: "itm_acme_card", versionId: "ver_acme_card_1",
      source: { entrance: "external-agent", externalRequestId: "acme-card" },
      fields: {
        intent: "refine", fidelity: "designed", delivery: "html-node", targetItemId: null, groupId: null,
        audience: "regulars who order weekly", primaryTask: "a pre-order app", constraints: ["pickup only"],
        facts: [
          { id: "feel", name: "Should feel", value: "warm, quick", origin: "supplied", sources: [] },
          { id: "never", name: "Never", value: "pushy", origin: "assumed", sources: [] },
          { id: "tone", name: "Tone of voice", value: "chatty", origin: "assumed", sources: [] },
        ],
        references: [], outstandingDecisionIds: [], outputIds: [],
      },
    }));
    expect((await json(["--canvas", canvas, "design", "start", start])).status).toBe("accepted");
  });

  it("prints the six lines: said ones solid, inferred ones pencil with Right / Wrong", async () => {
    const run = await isocan(["--canvas", canvas, "design", "card"]);
    expect(run.code, run.stderr).toBe(0);
    expect(run.stdout).toMatch(/^Brief “a pre-order app” \(req_acme_card · itm_acme_card@ver_acme_card_1\)/);
    expect(run.stdout).toContain("━ For            regulars who order weekly · said");
    expect(run.stdout).toContain("┄ Never          pushy · assumed · Right / Wrong: --right never | --wrong never");
    expect(run.stdout).toContain("┄ Right now      refining · sensed from the canvas — the request: refine existing work");
    expect(run.stdout).toContain("cites brief:making|for|feel|never|constraints|now|tone");
    const read = await json(["--canvas", canvas, "design", "card"]);
    expect(read.card.lines.find((l: { key: string }) => l.key === "never")).toMatchObject({ said: false, origin: "assumed", factId: "never" });
    expect(read.reread).toBeNull();
  });

  it("Right turns a pencil line solid, and the brief's history names the person as its source", async () => {
    const run = await isocan(["--canvas", canvas, "design", "card", "--right", "never"]);
    expect(run.code, run.stderr).toBe(0);
    expect(run.stdout).toContain("Never: now the person's word");
    expect(run.stdout).toContain("━ Never          pushy · said");
    expect(run.stdout).toContain("Right changes no words, so nothing re-reads.");
    const brief = (await json(["--canvas", canvas, "design", "brief", "req_acme_card"])).requests[0];
    expect(brief.brief.facts.find((f: { id: string }) => f.id === "never")).toMatchObject({ origin: "supplied" });
    expect(brief.brief.continuation.factProvenance).toContainEqual({ field: "facts.never", actorId: maya.id, kind: "direct" });
    const item = await json(["--canvas", canvas, "show", "itm_acme_card"]);
    expect(item.versions.at(-1).createdBy).toMatchObject(maya);
    const again = await isocan(["--canvas", canvas, "design", "card", "--right", "never"]);
    expect(again.code).not.toBe(0);
    expect(again.stderr).toMatch(/“Never” is already what the person said/);
  });

  it("an edit with nobody to answer lands, touches no screen, and says the re-read waits", async () => {
    const before = await screenState();
    const run = await isocan(["--canvas", canvas, "design", "card", "--wrong", "tone", "--value", "plain and kind"]);
    expect(run.code, run.stderr).toBe(0);
    expect(run.stdout).toContain("━ Tone of voice  plain and kind · said");
    expect(run.stdout).toContain("Re-read after Maya changed “Tone of voice”: “chatty” → “plain and kind”");
    expect(run.stdout).toContain("Nothing on the canvas changed.");
    expect(run.stdout).toContain("Still holds: “Menu”; “Checkout”; “Basket”");
    expect(run.stdout).toMatch(/The re-read waits: no agent stands on this canvas/);
    expect(await screenState()).toBe(before);
  });

  it("with Kit parked: the edit's re-read reaches Kit; Kit's one question and its call are read back", async () => {
    expect((await isocan(["identity", "--as", "usr_bc_kit", "--name", "Kit"], kit)).code).toBe(0);
    const base = `http://127.0.0.1:${port}`;
    const badge = await mintTestBadge(base);
    const host = { id: "usr_bc_host", name: "Host" };
    await badge.speakAs(host);
    const res = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers, [CLIENT_FEATURES_HEADER]: CURRENT_CLIENT_FEATURES },
      body: JSON.stringify({ canvasId: canvas, actor: host, op: { type: "agent.enroll", agent: { id: "usr_bc_kit", name: "Kit" } } }),
    });
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    // Kit's proposal beneath Checkout answers For.
    const proposal = await json(["--canvas", canvas, "propose", screens.Checkout!, await page("try", "Pickup slot first"), "--cites", "brief:for", "--why", "Summary before detail: regulars check the pickup slot first."], kit);
    const shownProposal = await json(["--canvas", canvas, "show", proposal.itemId]);
    expect(JSON.parse(shownProposal.properties.proposalCites)).toEqual([{ kind: "brief", ref: "for" }]);
    expect((await isocan(["--canvas", canvas, "session", "start", "--label", "Kit"], kit)).code).toBe(0);
    // Collected from spawn and known to be parked before the edit is made (lessons.md #123).
    const parked = await parkedWait({ base, headers: { ...badge.headers, [CLIENT_FEATURES_HEADER]: CURRENT_CLIENT_FEATURES }, canvas, actorId: "usr_bc_kit", cli: { cwd: home, env: cliEnv({ ISOCAN_HOME: home, ISOCAN_PORT: port, ...kit }) } });

    const before = await screenState();
    const edit = await isocan(["--canvas", canvas, "design", "card", "--set", "for", "--value", "regulars, and weekend first-timers"]);
    expect(edit.code, edit.stderr).toBe(0);
    expect(edit.stdout).toContain("Assumed the old line: “Checkout” — its proposal “Checkout — proposal” cites For");
    expect(edit.stdout).toContain("Still holds: “Menu”; “Basket”");
    expect(edit.stdout).toContain("(asked Kit in the Chat)");
    expect(await screenState()).toBe(before);
    const woke = await parked.run;
    expect(woke.stdout).toContain("Brief re-read, please (itm_acme_card@");

    const two = await isocan(["--canvas", canvas, "design", "card", "--reread", "--question", "Who? And when?"], kit);
    expect(two.code).not.toBe(0);
    expect(two.stderr).toMatch(/one question, not several/);
    const answered = await json(["--canvas", canvas, "design", "card", "--reread", "--matters", screens.Menu!, "--question", "As well as regulars, or instead?"], kit);
    expect(answered.matters).toEqual([screens.Menu]);

    const card = await isocan(["--canvas", canvas, "design", "card"]);
    expect(card.stdout).toContain("━ For            regulars, and weekend first-timers · said");
    expect(card.stdout).toContain("Matters more now: “Menu”");
    expect(card.stdout).toContain("Still holds: “Basket”");
    expect(card.stdout).toContain("Kit asks: As well as regulars, or instead?");
    expect(await screenState()).toBe(before);
  }, 60_000);
});
