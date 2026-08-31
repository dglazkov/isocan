import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The house rule with teeth (see AGENTS.md, "Done means done on both
 * surfaces"): every verb an agent could want is named in the guide agents
 * read before they act. A command nobody is told about does not exist.
 *
 * That guide is `packages/cli/src/agent-guide.md` — shipped with the CLI, so
 * `isocan --agent-help` always describes the build in hand (#75). The skill
 * is a doorway to it now, which is why these assertions moved off SKILL.md.
 *
 * This reads the commands the CLI actually registers — not a list someone
 * remembered to update — so adding a verb and forgetting the guide breaks the
 * build rather than quietly shipping a feature only humans can reach.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");

/** Commands that run the plumbing rather than the canvas. An agent never
 * needs to be told about these to collaborate; the guide covers the ones it
 * does need (setup, status) in prose. `turn` (`rc turn`) is a person's dev
 * verb that REFUSES harness sessions — telling agents about it would be
 * documenting a door that is closed to them. */
const PLUMBING = new Set(["serve", "stop", "restart", "status", "upgrade", "help", "gc", "turn"]);

/**
 * The verbs the guide actually NAMES, as opposed to the words it happens to
 * contain.
 *
 * This is the whole point of the file. The previous check was
 * `guide.includes(name)` — a bare substring match over 771 lines of prose —
 * so any verb that is also an ordinary English word passed vacuously. It was
 * not a hypothetical: `session move` (main.ts:3732), `fit` (main.ts:2743) and
 * `trash empty` (main.ts:4436) were all registered, all absent from the
 * guide, and all green.
 *
 * So a verb counts as documented only when it appears inside an inline code
 * span, which is how this guide names a command everywhere it means one:
 * `isocan star <item>`, `comment main <thread>`, or an alternation in the
 * quick reference (`session start|on|work|say|point|end`). A word in a
 * sentence is not a command.
 *
 * KNOWN LIMIT, deliberately left: this is flat, because `registeredCommands`
 * is flat — it reads `.command("x")` without knowing which sub-program the
 * call hangs off. So `session move` documented as `mv move` would still pass.
 * Closing that needs the parse to carry parents, which is a bigger change
 * than the hole it shuts; recorded here so the next person knows it is a
 * choice rather than an oversight.
 */
export function documentedVerbs(markdown: string): Set<string> {
  const verbs = new Set<string>();
  for (const span of markdown.matchAll(/`([^`\n]+)`/g)) {
    // `isocan comment main <thread>` and `comment main <thread>` name the
    // same verbs; the first two words are where a command name can be.
    const words = span[1]!.trim().replace(/^isocan\s+/, "").split(/\s+/).slice(0, 2);
    for (const word of words) {
      for (const alt of word.split("|")) {
        // Only bare lowercase words: `--dry-run`, `<item>` and `[--css]` are
        // flags and placeholders, never command names.
        if (/^[a-z][a-z-]*$/.test(alt)) verbs.add(alt);
      }
    }
  }
  return verbs;
}

function registeredCommands(): string[] {
  const source = readFileSync(path.join(repo, "packages/cli/src/main.ts"), "utf8");
  const names = new Set<string>();
  for (const match of source.matchAll(/\.command\("([a-z-]+)/g)) names.add(match[1]!);
  return [...names].sort();
}

describe("the agent-facing surface", () => {
  const guide = readFileSync(path.join(repo, "packages/cli/src/agent-guide.md"), "utf8");
  const skill = readFileSync(path.join(repo, ".agents/skills/isocan-collab/SKILL.md"), "utf8");
  const commands = registeredCommands();
  const documented = documentedVerbs(guide);

  it("registers the commands this test knows how to read", () => {
    // A sanity check on the parse itself: if the regex stops matching, every
    // other assertion here passes vacuously.
    expect(commands).toContain("add");
    expect(commands).toContain("comment");
    expect(commands.length).toBeGreaterThan(20);
  });

  it("names every canvas verb in the guide agents read", () => {
    const missing = commands.filter((name) => !PLUMBING.has(name) && !documented.has(name));
    expect(missing, `add these to the guide's quick reference: ${missing.join(", ")}`).toEqual([]);
  });

  it("would notice a verb the guide only mentions in a sentence", () => {
    // The guard this test replaced was `guide.includes(name)`, and it could
    // not fail for any verb that is also an English word: `move` was
    // registered and undocumented for weeks while the build stayed green,
    // because "move" appears in ordinary prose. This is that regression,
    // frozen: prose must not count as documentation.
    const prose = "You can move an item, get its contents, star it, and end the session.";
    expect(prose).toContain("move");
    expect(documentedVerbs(prose)).toEqual(new Set());
  });

  it("tells agents that a gap between the surfaces is a bug", () => {
    // The guide has to say this out loud: an agent that finds it cannot do
    // something a person can should report it, not work around it.
    expect(guide).toMatch(/bug in isocan/i);
  });

  it("the skill sends agents to the guide instead of repeating it", () => {
    // The whole point of #75: the skill is installed into a directory once and
    // then sits there. Anything it says about using the CLI is a copy that
    // ages; a pointer to `--agent-help` cannot. If this fails because the
    // skill grew instructions again, move them into agent-guide.md.
    expect(skill).toContain("isocan --agent-help");
    expect(skill.split("\n").length).toBeLessThan(80);
  });
});
