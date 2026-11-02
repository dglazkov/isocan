import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { mapState } from "@isocan/rc";
import { announceRule, rollMemory } from "../src/rc.ts";

/**
 * **The laptop's half of the roll call**: which agents say it in the Chat
 * (`--announce`, `config.json`'s `rcAnnounce`), and the `seen:` memory that
 * makes an rc restarted inside five minutes say nothing.
 */
let home: string;
beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-rc-roll-"));
});
afterEach(async () => {
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

const acme = { id: "act_acme", name: "Acme helper" };
const other = { id: "act_other", name: "Wren" };

describe("who says it in the Chat", () => {
  it("says nothing by default; --announce or rcAnnounce: true turns it on", () => {
    expect(announceRule(undefined, false, "prj_acme")).toBeUndefined();
    expect(announceRule(false, false, "prj_acme")).toBeUndefined();
    expect(announceRule(undefined, true, "prj_acme")?.(acme)).toBe(true);
    expect(announceRule(true, false, "prj_acme")?.(acme)).toBe(true);
  });

  it("a list names the agents (by name or id) and canvases that announce", () => {
    const rule = announceRule(["acme helper", "act_other"], false, "prj_acme")!;
    expect(rule(acme)).toBe(true);
    expect(rule(other)).toBe(true);
    expect(rule({ id: "act_third", name: "Finch" })).toBe(false);
    expect(announceRule(["prj_acme"], false, "prj_acme")?.({ id: "act_third", name: "Finch" })).toBe(true);
    expect(announceRule(["prj_acme"], false, "prj_board")?.(acme)).toBe(false);
  });
});

describe("the seen memory", () => {
  it("keeps seen: keys across a restart and nothing else", async () => {
    const first = rollMemory(home, mapState());
    await first.set("seen:prj_acme:act_acme", 12345);
    await first.set("guard:act_acme", { turnTimes: [] });
    const second = rollMemory(home, mapState());
    expect(await second.get("seen:prj_acme:act_acme")).toBe(12345);
    expect(await second.get("guard:act_acme")).toBeUndefined();
    expect(JSON.parse(await fs.readFile(path.join(home, "rc-seen.json"), "utf8"))).toEqual({
      "seen:prj_acme:act_acme": 12345,
    });
  });
});
