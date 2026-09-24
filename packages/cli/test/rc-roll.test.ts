import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { mapState } from "@isocan/rc";
import { announceRule, rollMemory } from "../src/rc.ts";

/**
 * **The laptop's half of the roll call**: which agents stay quiet
 * (`--no-announce`, `config.json`'s `rcAnnounce`), and the `seen:` memory that
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

describe("who stays quiet in the Chat", () => {
  it("announces by default, and --no-announce or rcAnnounce: false turns it off", () => {
    expect(announceRule(undefined, true, "prj_acme")?.(acme)).toBe(true);
    expect(announceRule(undefined, false, "prj_acme")).toBeUndefined();
    expect(announceRule(false, true, "prj_acme")).toBeUndefined();
    expect(announceRule(true, true, "prj_acme")?.(acme)).toBe(true);
  });

  it("a list names agents (by name or id) and canvases that stay quiet", () => {
    const rule = announceRule(["acme helper", "act_other"], true, "prj_acme")!;
    expect(rule(acme)).toBe(false);
    expect(rule(other)).toBe(false);
    expect(rule({ id: "act_third", name: "Finch" })).toBe(true);
    expect(announceRule(["prj_acme"], true, "prj_acme")).toBeUndefined();
    expect(announceRule(["prj_acme"], true, "prj_board")?.(acme)).toBe(true);
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
