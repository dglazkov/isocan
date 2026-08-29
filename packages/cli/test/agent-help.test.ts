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

function isocan(...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const child = spawn(process.execPath, [cliBin, ...args], {
    // A home nothing has ever run in: no identity, no config, no daemon.
    env: { ...process.env, ISOCAN_HOME: path.join(os.tmpdir(), "isocan-agent-help-home") },
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

  it("is advertised in `isocan --help`, where an agent looks first", async () => {
    const { stdout } = await isocan("--help");
    expect(stdout).toContain("--agent-help");
  });
});
