import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { cliEnv, runCli } from "./cli.ts";

/**
 * **`isocan words read`** (proactive-agent phase 10, design §12), against the
 * real binary: the readings and the designer's sentence an agent reads before
 * it acts on a person's words — the same list the Chat composer underlines
 * (`@isocan/core/vague-words`, whose own test holds the corpus). No canvas
 * and no daemon: three short walks.
 */

let home: string;
beforeAll(async () => {
  home = await fsp.mkdtemp(path.join(os.tmpdir(), "isocan-cli-words-read-"));
});
afterAll(async () => {
  await fsp.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});
const env = () => cliEnv({ ISOCAN_HOME: home });

describe("isocan words read", () => {
  it("prints each vague word's three readings and the designer's sentence, as words and as JSON", async () => {
    const said = await runCli(["words", "read", "make the header pop more, it feels cramped"], { env: env() });
    expect(said.code, said.stderr).toBe(0);
    for (const line of ["“pop” reads three ways", "contrast", "scale", "colour", "“cramped” reads three ways", "a designer would say: “raise the header's contrast and add space between its parts”", "ask which one they meant rather than guess"]) {
      expect(said.stdout).toContain(line);
    }
    const json = await runCli(["--json", "words", "read", "--pick", "pop=scale", "make the header pop more"], { env: env() });
    expect(json.code, json.stderr).toBe(0);
    const out = JSON.parse(json.stdout) as { words: Array<{ word: string; picked: string | null; readings: Array<{ name: string }> }>; designer: string };
    expect(out.words.map((w) => [w.word, w.picked, w.readings.map((r) => r.name)])).toEqual([["pop", "scale", ["contrast", "scale", "colour"]]]);
    expect(out.designer).toBe("make the header larger");
  });

  it("says a clear sentence reads one way, and refuses a reading the word does not have", async () => {
    const clear = await runCli(["words", "read", "Move the pickup time above the total"], { env: env() });
    expect(clear.code, clear.stderr).toBe(0);
    expect(clear.stdout).toContain("nothing here reads more than one way");
    const wrong = await runCli(["words", "read", "--pick", "pop=loud", "make it pop"], { env: env() });
    expect(wrong.code).toBe(1);
    expect(wrong.stderr).toContain("reads as contrast, scale, colour");
  });
});
