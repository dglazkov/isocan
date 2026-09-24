import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { coldStart, guideTopics } from "../src/agent-guide.ts";
import { CLI_MODULES } from "../src/modules.ts";

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
 * documenting a door that is closed to them.
 *
 * `mcp` (#220, phase 2) is here for a reason worth stating, because it is the
 * one entry that looks like a canvas verb: it serves the canvas to an agent
 * over MCP, but it is never TYPED — it goes in an agent manager's config and
 * is spawned from there. And the agent it serves is by construction not the
 * agent reading this guide: an agent that has the CLI on its PATH should use
 * the CLI, which is everything the guide already describes. Documenting it
 * for agents would be telling them to reach for a thinner copy of the surface
 * they are already holding. A PERSON finds it in `isocan --help` and in
 * `docs/projects/embed/phases.md`, which carries the config to paste. */
const PLUMBING = new Set([
  "serve",
  "stop",
  "restart",
  "status",
  "upgrade",
  "help",
  "gc",
  "turn",
  "mcp",
]);

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
    const path = span[1]!.trim().replace(/^isocan\s+/, "").split(/\s+/);
    const words = path.slice(0, (path[0] === "canvas" && path[1] === "group") || (path[0] === "context" && path[1] === "personal") ? 3 : 2);
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

/**
 * The modules this build carries (`docs/projects/modules/design.md`): each
 * registers verbs from its own `cli.ts` and describes them in its own
 * `agent-guide.md`, printed after the base guide while it is loaded. Both are
 * read here, so a module verb nobody is told about fails exactly as a core
 * one does.
 */
function moduleDirs(): string[] {
  const root = path.join(repo, "packages/modules");
  return readdirSync(root)
    .map((name) => path.join(root, name))
    .filter((dir) => existsSync(path.join(dir, "package.json")));
}

function registeredCommands(): string[] {
  const sources = [
    path.join(repo, "packages/cli/src/main.ts"),
    path.join(repo, "packages/cli/src/canvas-groups.ts"),
    path.join(repo, "packages/cli/src/context-reads.ts"),
    path.join(repo, "packages/cli/src/questionnaire.ts"),
    path.join(repo, "packages/cli/src/design-request.ts"),
    path.join(repo, "packages/cli/src/design-system.ts"),
    path.join(repo, "packages/cli/src/personal-context.ts"),
    path.join(repo, "packages/cli/src/bench.ts"),
    path.join(repo, "packages/cli/src/operator.ts"),
    ...moduleDirs().map((dir) => path.join(dir, "src/cli.ts")).filter((f) => existsSync(f)),
  ];
  const names = new Set<string>();
  for (const file of sources) {
    for (const match of readFileSync(file, "utf8").matchAll(/\.command\("([a-z-]+)/g)) names.add(match[1]!);
  }
  return [...names].sort();
}

/**
 * **What an agent can reach from the cold start** (#124). `isocan
 * --agent-help` no longer prints everything: it prints the guide's cold start — one
 * line per verb family — and an index of topics, each one a call away. So a
 * verb counts as findable when the cold start names it, or when a topic the
 * cold start's index names does. The index is read out of the printed cold
 * start rather than taken from the topic list, so a topic the index stopped
 * naming stops counting — which is the rule: a topic nobody is told about
 * does not exist either.
 *
 * The modules are the ones this build carries (`CLI_MODULES`); each is a topic
 * of its own, printed and indexed only while it is loaded.
 */
const moduleGuides = () => CLI_MODULES.map((m) => ({ name: m.core.name, guide: m.guide }));

const indexNames = (cold: string, slug: string) =>
  new RegExp(`^- \`${slug}\` — `, "m").test(cold.slice(cold.indexOf("## Topics")));

function reachableGuide(): { cold: string; reachable: string } {
  const topics = guideTopics(moduleGuides());
  const cold = coldStart(topics);
  const named = topics.filter((t) => indexNames(cold, t.slug));
  return { cold, reachable: [cold, ...named.map((t) => t.text)].join("\n\n") };
}

describe("the agent-facing surface", () => {
  const { cold, reachable: guide } = reachableGuide();
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

  it("names every canvas verb in the cold start, or in a topic it points to", () => {
    const missing = commands.filter((name) => !PLUMBING.has(name) && !documented.has(name));
    expect(
      missing,
      `add these to the cold start's verb index or to a topic (packages/cli/src/agent-guide.md): ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("points at every topic from the cold start", () => {
    // The index is generated, so this guards the generator: if it ever
    // printed a subset, the verbs in the topics it dropped would stop being
    // findable and the assertion above would quietly stop counting them.
    for (const t of guideTopics(moduleGuides())) expect(indexNames(cold, t.slug), t.slug).toBe(true);
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
    // something a person can should report it, not work around it. In the
    // cold start, since #124: it is a rule for the first lap, not a topic.
    expect(cold).toMatch(/bug in\s+isocan/i);
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

/**
 * **One fact, one fold** — the other half of "done on both surfaces".
 *
 * The command guard above asks whether both surfaces have the VERB. It cannot
 * see the failure that actually happened: `isocan history` and the app's lens
 * both answered "what has this agent been doing", from two hand-rolled folds
 * over the same logs, sorted and counted separately. Nothing was wrong on
 * either side — which is the point. Two implementations of one fact agree
 * until the day they don't, and then neither is able to say so.
 */
describe("the cross-canvas folds are shared, not re-rolled", () => {
  const source = readFileSync(path.join(repo, "packages/cli/src/main.ts"), "utf8");

  it("history folds with core, like the lens page does", () => {
    expect(source).toContain("lensActs(");
    expect(source).toContain("lensShape(acts)");
  });

  it("the lens says who is live, on this surface too", () => {
    /* A dot in the app and nothing in the terminal is the gap the house rule
       calls a bug: an agent asking "is anybody working on this" would have
       had to open a browser. Same fold, same words. */
    expect(source).toContain("lensLive(");
    expect(source).toContain("lensLiveWords(");
    expect(source).toContain("lensLiveList(");
  });

  it("counts canvases once, rather than agreeing by coincidence", () => {
    /* `new Set(acts.map(a => a.canvas)).size` is the line this replaced. It
       was correct, and it was a second opinion about a number the page also
       prints — the shape of the drift, in one expression. */
    expect(source).not.toMatch(/new Set\(acts\.map\(/);
  });
});
