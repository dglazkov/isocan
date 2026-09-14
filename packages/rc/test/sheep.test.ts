import { describe, expect, it } from "vitest";
import {
  COLLAB_SKILL,
  SheepAgent,
  endSheep,
  type RmAnswer,
  type SheepCommands,
  type SheepEntry,
  type SheepReply,
  type SheepRow,
} from "../src/index.ts";

/**
 * **The sheep's policy over in-memory commands** (docs/projects/room/phases.md,
 * phase 2's proof). No `sheep` binary and no process: a sheep home that is an
 * array of rows and a map of pastures in this file, recording every verb the
 * policy speaks to it, so what a birth, a resume, the secret's fallback and a
 * withdrawal ask of a home is read off the record.
 */

type Call = [verb: keyof SheepCommands, ...args: unknown[]];

class MemoryHome implements SheepCommands {
  calls: Call[] = [];
  rows: (SheepRow & { busy?: boolean })[] = [];
  pastureTrees = new Map<string, { tree: Record<string, string>; secrets: Record<string, string> }>();
  sheepSecrets = new Map<string, Record<string, string>>();
  /** A home from before per-sheep secrets: it mints, and drops the secrets. */
  dropsSecrets = false;
  /** A home from before sheep's end verb: `rm` is refused. */
  cannotRm = false;
  /** What the next `attach` streams. */
  stream: SheepEntry[] = [];
  private next = 1;

  async sessions(): Promise<SheepRow[]> {
    this.calls.push(["sessions"]);
    return this.rows.map(({ busy: _busy, ...row }) => row);
  }
  async session(id: string): Promise<SheepRow | null> {
    this.calls.push(["session", id]);
    const row = this.rows.find((r) => r.id === id);
    if (!row) return null;
    const { busy: _busy, ...rest } = row;
    return rest;
  }
  async pastures(): Promise<string[]> {
    this.calls.push(["pastures"]);
    return [...this.pastureTrees.keys()];
  }
  async pastureNew(name: string): Promise<void> {
    this.calls.push(["pastureNew", name]);
    this.pastureTrees.set(name, { tree: {}, secrets: {} });
  }
  async pasturePut(name: string, path: string, body: string): Promise<void> {
    this.calls.push(["pasturePut", name, path]);
    this.pastureTrees.get(name)!.tree[path] = body;
  }
  async pastureSecret(name: string, key: string, value: string): Promise<void> {
    this.calls.push(["pastureSecret", name, key, value]);
    this.pastureTrees.get(name)!.secrets[key] = value;
  }
  async mint(opts: { name: string; pasture: string }, secrets: Record<string, string>): Promise<string> {
    this.calls.push(["mint", opts, secrets]);
    const id = `s_${this.next++}`;
    const keep = !this.dropsSecrets;
    this.rows.push({
      id,
      name: opts.name,
      pasture: opts.pasture,
      setup: null,
      ...(keep ? { secrets: Object.keys(secrets).sort() } : {}),
    });
    if (keep) this.sheepSecrets.set(id, secrets);
    return id;
  }
  async attach(id: string, text: string, onEntry: (entry: SheepEntry) => void): Promise<SheepReply> {
    this.calls.push(["attach", id, text]);
    for (const entry of this.stream) onEntry(entry);
    return { ended: true };
  }
  async rm(id: string): Promise<RmAnswer> {
    this.calls.push(["rm", id]);
    if (this.cannotRm) return { ended: false, refusal: "not found" };
    const row = this.rows.find((r) => r.id === id);
    if (!row) return { ended: false, refusal: `no session ${id}` };
    this.rows = this.rows.filter((r) => r !== row);
    return { ended: true, aborted: row.busy === true };
  }
  async abort(id: string): Promise<boolean> {
    this.calls.push(["abort", id]);
    const row = this.rows.find((r) => r.id === id);
    if (!row?.busy) return false;
    row.busy = false;
    return true;
  }

  verbs(): string[] {
    return this.calls.map(([verb]) => verb);
  }
}

const PLACE = { kennel: "/acme/.sheep", home: "local" };
const WHERE = "the local sheep home in /acme";
const ADDRESS = "http://host.docker.internal:4400/p/prj_acme#pass=tok_acme";

function agentAt(home: MemoryHome, name = "Percy") {
  const lines: string[] = [];
  let passes = 0;
  const agent = new SheepAgent({
    commands: home,
    name,
    place: PLACE,
    where: WHERE,
    narrate: (line) => lines.push(line),
    birth: {
      canvasTitle: "Acme Board",
      pass: async () => {
        passes++;
        return { address: ADDRESS, passId: "pass_acme" };
      },
    },
  });
  return { agent, lines, passes: () => passes };
}

describe("SheepAgent over SheepCommands", () => {
  it("a birth is a mint with the pass among its secrets and no prompt, then an attach with the summons", async () => {
    const home = new MemoryHome();
    const { agent, lines, passes } = agentAt(home);

    const session = await agent.ensureSession("/acme", null);
    expect(session).toEqual({ sessionId: "s_1", resumed: false });
    expect(passes()).toBe(1);
    expect(agent.bornPass).toBe("pass_acme");

    // The herd is read before anything is made; the pasture is the agent's.
    expect(home.verbs()).toEqual([
      "sessions",
      "pastures",
      "pastureNew",
      "pasturePut",
      "pasturePut",
      "pasturePut",
      "mint",
      "session",
    ]);
    const mint = home.calls.find(([verb]) => verb === "mint")!;
    // The pass is the sheep's own secret, and the mint carries nothing else:
    // no prompt, so no model turn is spent at the birth.
    expect(mint.slice(1)).toEqual([{ name: "Percy", pasture: "isocan-percy" }, { ISOCAN_PASS: ADDRESS }]);
    const tree = home.pastureTrees.get("isocan-percy")!;
    expect(Object.keys(tree.tree).sort()).toEqual(["BRIEF.md", "setup.sh", "skills/isocan/SKILL.md"]);
    expect(tree.tree["BRIEF.md"]).toContain('You are Percy, an agent enrolled on the isocan canvas "Acme Board"');
    expect(tree.tree["setup.sh"]).toContain('isocan setup --direct --no-open --no-install "$ISOCAN_PASS"');
    expect(tree.tree["skills/isocan/SKILL.md"]).toBe(COLLAB_SKILL);
    expect(tree.secrets).toEqual({});
    expect(lines).toContain("birthing a sheep for Percy at the local sheep home in /acme");
    expect(home.calls.some(([verb]) => verb === "attach")).toBe(false);

    const summons = "@Percy the empty state reads wrong";
    home.stream = [
      { id: "e1", timestamp: 1, type: "message", message: { role: "user", content: summons } },
      {
        id: "e2",
        timestamp: 2,
        type: "message",
        message: { role: "assistant", content: [{ type: "toolCall", name: "bash", arguments: { command: "isocan comment reply th_1 \"on it\"" } }] },
      },
      { id: "e3", timestamp: 3, type: "message", message: { role: "assistant", content: [{ type: "text", text: "on it" }] } },
      // A `sheep` from before the stream writes the last entry again.
      { id: "e3", timestamp: 3, type: "message", message: { role: "assistant", content: [{ type: "text", text: "on it" }] } },
    ];
    const events: { kind: string; text?: string; detail?: string }[] = [];
    const turn = await agent.prompt(session.sessionId, summons, (event) => events.push(event));
    expect(home.calls.at(-1)).toEqual(["attach", "s_1", summons]);
    expect(turn).toEqual({ stopReason: "end_turn", text: "on it" });
    expect(events).toEqual([
      { kind: "tool", detail: 'bash isocan comment reply th_1 "on it"' },
      { kind: "chunk", text: "on it" },
    ]);
  });

  it("a sheep found in the herd is resumed, with no mint and no pass", async () => {
    const home = new MemoryHome();
    home.rows = [
      { id: "s_other", name: "Shaun", pasture: "isocan-shaun" },
      { id: "s_herd", name: "Percy", pasture: "isocan-percy", secrets: ["ISOCAN_PASS"], setup: { state: "ok" } },
    ];
    home.pastureTrees.set("isocan-percy", { tree: {}, secrets: {} });
    const { agent, lines, passes } = agentAt(home);

    // The row named a sheep the home no longer has; the pasture's herd does.
    const session = await agent.ensureSession("/acme", "s_gone");
    expect(session).toEqual({ sessionId: "s_herd", resumed: true });
    expect(home.verbs()).not.toContain("mint");
    expect(home.verbs()).not.toContain("pastureNew");
    expect(passes()).toBe(0);
    expect(agent.bornPass).toBeNull();
    expect(lines[0]).toBe(
      "sheep s_herd is already in pasture isocan-percy (the row named s_gone, which the home no longer has) — resuming it rather than birthing a second",
    );
    // The tree is refreshed, so a resumed sheep runs the current script.
    expect(home.verbs()).toEqual(["sessions", "pasturePut", "pasturePut", "pasturePut"]);
  });

  it("a home that drops the secret gets pastureSecret and one sentence", async () => {
    const home = new MemoryHome();
    home.dropsSecrets = true;
    const { agent, lines } = agentAt(home);

    const session = await agent.ensureSession("/acme", null);
    expect(session.resumed).toBe(false);
    const secret = home.calls.filter(([verb]) => verb === "pastureSecret");
    expect(secret).toEqual([["pastureSecret", "isocan-percy", "ISOCAN_PASS", ADDRESS]]);
    // After the mint, and read from the listing rather than the mint's answer.
    expect(home.verbs().slice(-3)).toEqual(["mint", "session", "pastureSecret"]);
    const said = lines.filter((line) => line.includes("secret for one sheep"));
    expect(said).toEqual([
      "the local sheep home in /acme cannot keep a secret for one sheep (this `sheep` or its home predates it), " +
        "so the pass is pasture isocan-percy's ISOCAN_PASS secret instead, and stays there once spent",
    ]);
    // The sheep is used, not ended.
    expect(home.verbs()).not.toContain("rm");
  });

  it("a home that keeps the secret gets no pastureSecret", async () => {
    const home = new MemoryHome();
    const { agent, lines } = agentAt(home);
    await agent.ensureSession("/acme", null);
    expect(home.verbs()).not.toContain("pastureSecret");
    expect(lines.some((line) => line.includes("secret for one sheep"))).toBe(false);
  });
});

describe("endSheep over SheepCommands", () => {
  it("during a turn: rm aborts it and ends the sheep, and the pasture is never removed", async () => {
    const home = new MemoryHome();
    home.rows = [{ id: "s_1", name: "Percy", pasture: "isocan-percy", busy: true }];
    home.pastureTrees.set("isocan-percy", { tree: { "setup.sh": "#!/bin/sh" }, secrets: {} });
    const lines: string[] = [];

    await endSheep(home, { name: "Percy", sessionId: "s_1", where: WHERE }, (line) => lines.push(line));
    expect(home.calls).toEqual([["rm", "s_1"]]);
    expect(lines).toEqual([
      "ending sheep s_1 at the local sheep home in /acme",
      "the running turn was aborted first",
      "sheep s_1 ended — its container and workspace are gone",
      "pasture isocan-percy stays — it is yours",
    ]);
    expect(home.rows).toEqual([]);
    expect(home.pastureTrees.has("isocan-percy")).toBe(true);
  });

  it("at a home from before rm: the listing is read, abort stops the turn, and what remains is said", async () => {
    const home = new MemoryHome();
    home.cannotRm = true;
    home.rows = [{ id: "s_1", name: "Percy", pasture: "isocan-percy", busy: true }];
    home.pastureTrees.set("isocan-percy", { tree: {}, secrets: {} });
    const lines: string[] = [];

    await endSheep(home, { name: "Percy", sessionId: "s_1", where: WHERE }, (line) => lines.push(line));
    expect(home.verbs()).toEqual(["rm", "sessions", "abort"]);
    expect(lines).toEqual([
      "ending sheep s_1 at the local sheep home in /acme",
      "its running turn was aborted",
      "sheep s_1 is still at the local sheep home in /acme: this home cannot end a sheep (sheep rm: not found); `sheep ls` lists it",
      "pasture isocan-percy stays — it is yours",
    ]);
    expect(home.pastureTrees.has("isocan-percy")).toBe(true);
  });

  it("a sheep the home no longer lists was already ended, and nothing is aborted", async () => {
    const home = new MemoryHome();
    const lines: string[] = [];
    await endSheep(home, { name: "Percy", sessionId: "s_1", where: WHERE }, (line) => lines.push(line));
    expect(home.verbs()).toEqual(["rm", "sessions"]);
    expect(lines.slice(1)).toEqual([
      "sheep s_1 was already ended — the local sheep home in /acme no longer lists it",
      "pasture isocan-percy stays — it is yours",
    ]);
  });
});
