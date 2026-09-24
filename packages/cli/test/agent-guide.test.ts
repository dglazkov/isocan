import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BASE_TOPICS,
  agentHelp,
  coldStart,
  estimateTokens,
  guideTopics,
  splitSections,
  wholeGuide,
} from "../src/agent-guide.ts";
import { CLI_MODULES } from "../src/modules.ts";

/**
 * **The cold start has a budget** (#124).
 *
 * Every agent pays for `isocan --agent-help` on every cold start, before its
 * first act. On 11 Sep 2026 that was ~33k tokens; by 24 Sep it was ~59k
 * (237,605 characters, base guide plus nine module sections) — the guide grew
 * the way crowded files do, a paragraph per feature, and nothing said no. The
 * cold start is now `guide/start.md` plus a generated topic index, and this
 * number is what says no.
 *
 * **3,500, measured 2,982 on 24 Sep 2026** (chars/4, with this build's nine
 * modules indexed). The margin is a module or two's index line and a verb
 * family's worth of growth — enough that adding a module does not redden the
 * build, not enough to fold a topic back in. #124 set the target at ~5,000;
 * this sits under it on purpose, because a budget set at the ceiling is
 * spent by the first feature that asks.
 *
 * **Raise it by hand, with a sentence**, the way the architect's op-types
 * bound is raised: what moved into the cold start, and why it could not be a
 * topic. The answer to "my verb does not fit" is almost always one more line
 * in the verb index and the prose in a topic.
 */
const COLD_START_BUDGET = 3_500;

const modules = CLI_MODULES.map((m) => ({ name: m.core.name, guide: m.guide }));
const guideFile = fileURLToPath(new URL("../src/agent-guide.md", import.meta.url));

describe("the cold start", () => {
  it(`stays under ${COLD_START_BUDGET} tokens`, () => {
    const tokens = estimateTokens(coldStart(guideTopics(modules)));
    expect(
      tokens,
      `the cold start is ${tokens} tokens against a budget of ${COLD_START_BUDGET} — move prose into a topic, or raise the budget in this file with a sentence saying why`,
    ).toBeLessThanOrEqual(COLD_START_BUDGET);
  });

  it("is a small fraction of the whole guide", () => {
    // The point of the split, as a ratio that survives both files growing:
    // if the cold start ever approaches the whole, the topics have been
    // folded back in and the budget above was raised to let it happen.
    const topics = guideTopics(modules);
    expect(estimateTokens(coldStart(topics)) * 8).toBeLessThan(estimateTokens(wholeGuide(topics)));
  });

  it("counts characters, not bytes", () => {
    expect(estimateTokens("————")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });
});

describe("the topics", () => {
  const { sections } = splitSections(readFileSync(guideFile, "utf8"));
  const headings = sections.map((s) => s.heading);
  const claimed = BASE_TOPICS.flatMap((t) => t.sections);

  it("give every section of the guide exactly one home", () => {
    // A new `##` with no topic would print only under `all` — invisible to
    // every agent that did not ask for everything.
    const homeless = headings.filter((h) => !claimed.includes(h));
    expect(homeless, `add these sections to a topic in BASE_TOPICS (agent-guide.ts)`).toEqual([]);
    const twice = claimed.filter((h, i) => claimed.indexOf(h) !== i);
    expect(twice).toEqual([]);
  });

  it("name only sections that exist", () => {
    // A renamed heading would otherwise leave its topic quietly empty.
    const ghosts = claimed.filter((h) => !headings.includes(h));
    expect(ghosts, "these headings are gone from agent-guide.md — rename them in BASE_TOPICS").toEqual([]);
  });

  it("have one slug each, modules included", () => {
    const slugs = guideTopics(modules).map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).not.toContain("all");
  });

  it("carry the whole guide between them — `all` loses nothing", () => {
    const all = wholeGuide(guideTopics(modules));
    for (const s of sections) expect(all).toContain(s.text.trim());
    for (const m of modules) expect(all).toContain(m.guide.trim());
  });

  it("ship every file in the guide directory", () => {
    // `guide/` holds the cold start today; a topic file dropped in beside it
    // without an import would ship nowhere.
    const dir = fileURLToPath(new URL("../src/guide/", import.meta.url));
    expect(readdirSync(dir).filter((f) => f.endsWith(".md"))).toEqual(["start.md"]);
  });
});

describe("`--agent-help <word>`", () => {
  it("prints a topic by its slug", () => {
    const got = agentHelp("sharing", modules);
    expect(got.code).toBe(0);
    expect(got.out).toContain("## Sharing a canvas");
    expect(got.out).not.toContain("## Your name");
  });

  it("finds the topic that teaches a verb", () => {
    const got = agentHelp("teleport", modules);
    expect(got.code).toBe(0);
    expect(got.out).toMatch(/^\(`teleport` is taught in topic `homes`/);
  });

  it("finds a module's topic by its verb", () => {
    expect(agentHelp("map", modules).out).toContain("## Mind maps");
  });

  it("refuses a word it does not know, and lists what it does", () => {
    const got = agentHelp("zzz-nothing", modules);
    expect(got.code).toBe(2);
    expect(got.out).toBe("");
    expect(got.err).toContain("protocol");
    expect(got.err).toContain("all");
  });
});
