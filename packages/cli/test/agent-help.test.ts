import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCli, type Run } from "./cli.ts";

/**
 * `isocan --agent-help` is how an agent learns to work a canvas (#75). It has
 * to answer with no daemon, no identity, no canvas and no network — an agent
 * that has just met this tool has none of those, and the guide is what tells
 * it how to get them.
 */

const guideFile = fileURLToPath(new URL("../src/agent-guide.md", import.meta.url));

async function isocan(...args: string[]): Promise<Run> {
  // A home nothing has ever run in: no identity, no config, no daemon — and
  // FRESH, made for this run. A fixed /tmp path was "never run in" only on
  // the first machine that ran it (a latent debt named on the roadmap).
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-agent-help-"));
  // `runCli` decodes both streams as UTF-8, and this file is why: the guide
  // is 61KB with em-dashes all through it, and on a loaded CI box one of them
  // was split across two chunks and came back as `���` — one mangled and
  // every other intact. `./cli.ts` keeps the rest of the story.
  // Keep the source launcher and its workspace/Markdown loaders under test.
  return runCli(args, { source: true, env: { ...process.env, ISOCAN_HOME: home } });
}

describe("isocan --agent-help", () => {
  it("the test bundle agrees with the source launcher on version, guides and module registration", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-cli-parity-"));
    try {
      for (const args of [["--version"], ["--agent-help", "all"], ["map", "--help"]]) {
        const expected = await isocan(...args);
        expect(expected.code, expected.stderr).toBe(0);
        const bundled = await runCli(args, { env: { ...process.env, ISOCAN_HOME: home } });
        expect(bundled).toEqual(expected);
      }
    } finally {
      await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("prints the cold start the CLI ships, and an index of the rest", async () => {
    // The cold start is the guide up to its first topic marker (#124).
    const guide = await fs.readFile(guideFile, "utf8");
    const start = guide.slice(0, guide.indexOf("<!-- topic:"));
    const { code, stdout } = await isocan("--agent-help");
    expect(code).toBe(0);
    expect(stdout).toContain(start.trim());
    expect(stdout).toContain("## Topics");
    // The cold start is a fraction of the guide (#124), not the guide.
    expect(stdout).not.toContain("## Practices that earn trust");
  });

  it("prints everything with `all`, and one topic by name", async () => {
    const guide = await fs.readFile(guideFile, "utf8");
    const all = await isocan("--agent-help", "all");
    expect(all.code).toBe(0);
    for (const heading of guide.match(/^## .+$/gm) ?? []) expect(all.stdout).toContain(heading);

    const one = await isocan("--agent-help", "sharing");
    expect(one.code).toBe(0);
    expect(one.stdout).toContain("## Sharing a canvas");
    expect(one.stdout.length).toBeLessThan(all.stdout.length / 4);

    const none = await isocan("--agent-help", "no-such-topic");
    expect(none.code).toBe(2);
    expect(none.stderr).toContain("topics: protocol");
  });

  it("names every top-level verb `--help` lists, in the cold start itself", async () => {
    /**
     * `surface.test.ts` holds that every registered command is findable —
     * in the cold start or a topic it points to. This is the stronger half
     * for the verbs an agent sees first: every top-level door is on a line of
     * the cold start's index, so no family is one topic-lookup away from
     * being invisible. Read from `--help`, which knows which commands are
     * top-level; the source parse in `surface.test.ts` does not.
     */
    const PLUMBING = new Set(["serve", "stop", "restart", "status", "upgrade", "help", "gc", "mcp"]);
    const help = (await isocan("--help")).stdout;
    const block = help.slice(help.indexOf("Commands:"), help.indexOf("Agents, start here:"));
    const verbs = [...block.matchAll(/^ {2}([a-z][a-z-]*)/gm)].map((m) => m[1]!);
    expect(verbs.length).toBeGreaterThan(50);
    const cold = (await isocan("--agent-help")).stdout;
    const named = new Set([...cold.matchAll(/`([a-z][a-z-]*)/g)].map((m) => m[1]!));
    // `browse` and `versions` are older spellings (`add --as site`,
    // `version ls`) — taught once, in topic `reference`, not in the cold start.
    const older = new Set(["browse", "versions"]);
    const missing = verbs.filter((v) => !PLUMBING.has(v) && !older.has(v) && !named.has(v));
    expect(missing, `add a line for these to the cold start's verb index in packages/cli/src/agent-guide.md`).toEqual([]);
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
