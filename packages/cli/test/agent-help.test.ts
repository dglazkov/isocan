import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * `isocan --agent-help` is how an agent learns to work a canvas (#75). It has
 * to answer with no daemon, no identity, no canvas and no network — an agent
 * that has just met this tool has none of those, and the guide is what tells
 * it how to get them.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const guideFile = fileURLToPath(new URL("../src/agent-guide.md", import.meta.url));

async function isocan(...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  // A home nothing has ever run in: no identity, no config, no daemon — and
  // FRESH, made for this run. A fixed /tmp path was "never run in" only on
  // the first machine that ran it (a latent debt named on the roadmap).
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-agent-help-"));
  const child = spawn(process.execPath, [cliBin, ...args], {
    env: { ...process.env, ISOCAN_HOME: home },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  /**
   * **`setEncoding`, or the guide comes back with holes in it.**
   *
   * `stdout += chunk` on a raw stream concatenates BUFFERS onto a string, and
   * each one is decoded on its own. A UTF-8 character that straddles a chunk
   * boundary is therefore decoded as two half-characters and lands as `���`.
   *
   * That is exactly how this test failed on CI and never here: the guide is
   * 61KB with em-dashes all through it, where the OS splits the stream depends
   * on how loaded the machine is, and the assertion diff read
   *
   *     - prints — and opens — the address of that ONE item
   *     + prints — and opens ��� the address of that ONE item
   *
   * one em-dash mangled and every other one intact. Setting the encoding puts
   * a `StringDecoder` in the way, which holds a partial character back until
   * its remaining bytes arrive. `main.ts` already does this when it reads
   * stdin — the tests simply had not copied the idiom.
   */
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => (stderr += chunk));
  return new Promise((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
  );
}

describe("isocan --agent-help", () => {
  it("prints the guide the CLI ships, in full", async () => {
    const guide = await fs.readFile(guideFile, "utf8");
    const { code, stdout } = await isocan("--agent-help");
    expect(code).toBe(0);
    expect(stdout).toContain(guide.trimEnd());
  });

  it("means the same thing after a subcommand, and runs nothing else", async () => {
    // Typed as `isocan comment --agent-help` it must still be help, not a
    // half-run command reaching for a daemon that isn't there.
    const { code, stdout, stderr } = await isocan("comment", "--agent-help");
    expect(code).toBe(0);
    expect(stdout).toContain("Collaborating on an isocan canvas");
    expect(stderr).toBe("");
  });

  it("tells an agent that the promoted version is not the newest one", async () => {
    /**
     * Reported by a human whose agent kept working from the wrong version:
     * twelve versions on an item, #9 promoted, and the agent answered with
     * #12. Nothing in the code was picking the newest — `isocan get` follows
     * `currentVersionId` and always did. What was missing was anywhere in
     * the guide SAYING that the file in the tree does not follow it, and
     * that nothing writes that file on its own. An agent that reads the path
     * instead of the item gets the version the human just set aside, stacks
     * a new one on top, and buries the choice they made.
     *
     * The guide is how an agent learns this; there is no other channel.
     */
    const guide = await fs.readFile(guideFile, "utf8");
    expect(guide).toContain("The file on disk is not the item.");
    expect(guide).toContain("not necessarily\nthe newest");
    expect(guide).toContain("Read with `isocan get`, not by opening the path.");
    // The refusal has two causes, and the guide used to name only one.
    expect(guide).toContain("That last refusal has two causes");
    expect(guide).not.toContain("That last one is somebody editing outside the canvas");
  });

  it("is advertised in `isocan --help`, where an agent looks first", async () => {
    const { stdout } = await isocan("--help");
    expect(stdout).toContain("--agent-help");
  });
});
