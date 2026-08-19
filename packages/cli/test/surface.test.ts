import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The house rule with teeth (see AGENTS.md, "Done means done on both
 * surfaces"): every verb an agent could want is named in the skill agents
 * read before they act. A command nobody is told about does not exist.
 *
 * This reads the commands the CLI actually registers — not a list someone
 * remembered to update — so adding a verb and forgetting the skill breaks the
 * build rather than quietly shipping a feature only humans can reach.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");

/** Commands that run the plumbing rather than the canvas. An agent never
 * needs to be told about these to collaborate; the skill covers the ones it
 * does need (setup, status) in prose. */
const PLUMBING = new Set(["serve", "stop", "restart", "status", "upgrade", "help", "gc"]);

function registeredCommands(): string[] {
  const source = readFileSync(path.join(repo, "packages/cli/src/main.ts"), "utf8");
  const names = new Set<string>();
  for (const match of source.matchAll(/\.command\("([a-z-]+)/g)) names.add(match[1]!);
  return [...names].sort();
}

describe("the agent-facing surface", () => {
  const skill = readFileSync(
    path.join(repo, ".agents/skills/isocan-collab/SKILL.md"),
    "utf8",
  );
  const commands = registeredCommands();

  it("registers the commands this test knows how to read", () => {
    // A sanity check on the parse itself: if the regex stops matching, every
    // other assertion here passes vacuously.
    expect(commands).toContain("add");
    expect(commands).toContain("comment");
    expect(commands.length).toBeGreaterThan(20);
  });

  it("names every canvas verb in the skill agents read", () => {
    const missing = commands.filter((name) => !PLUMBING.has(name) && !skill.includes(name));
    expect(missing, `add these to the skill's quick reference: ${missing.join(", ")}`).toEqual([]);
  });

  it("tells agents that a gap between the surfaces is a bug", () => {
    // The skill has to say this out loud: an agent that finds it cannot do
    // something a person can should report it, not work around it.
    expect(skill).toMatch(/bug in isocan/i);
  });
});
