import guideText from "./agent-guide.md";

/**
 * The collaboration guide agents read before they act — the protocol behind
 * the commands, as opposed to `--help`, which is the commands themselves.
 *
 * It lives HERE, next to the CLI it describes, and not in the skill (#75).
 * The skill is installed once into a directory and then sits there: an agent
 * following a six-month-old copy is being told about a six-month-old CLI, and
 * nothing in the loop notices. Shipping the guide with the binary makes the
 * two impossible to separate — upgrade the CLI and you have upgraded the
 * instructions. `.agents/skills/isocan-collab/SKILL.md` is now a doorway that
 * says "run `isocan --agent-help`", which is small enough to never rot.
 *
 * **Imported as text, not read off disk** (`docs/projects/first-minute`). The
 * release CLI is one bundled file, where `new URL("./agent-guide.md",
 * import.meta.url)` points at a directory that does not exist; the import is a
 * build-time constant instead, inlined by esbuild's text loader and by
 * `bin/workspace-loader.mjs` in source mode.
 *
 * **A cold start and topics** (#124). The whole guide had grown to ~59k
 * tokens by 24 Sep 2026 (chars/4), and every agent paid for all of it on every
 * cold start — most of it about kinds of work that agent was not doing. The
 * file is still one file, in two parts:
 *
 * - **the cold start**, everything before the first topic marker — what
 *   isocan is, the lap, and one line per verb family — which is what
 *   `isocan --agent-help` prints, followed by an index of topics GENERATED
 *   from the markers, so a topic nobody is told about cannot exist;
 * - **the topics**, each opened by a line
 *   `<!-- topic: <slug> | <summary> -->` and running to the next one. A new
 *   `##` lands in whichever topic it is written under; there is no list to
 *   forget to update.
 *
 * `isocan --agent-help <topic>` prints one topic, `--agent-help <verb>` the
 * topic that teaches that verb, and `--agent-help all` everything, for anyone
 * who wants the old behaviour. Each loaded module is a topic too. The budget
 * on the cold start is held by `packages/cli/test/agent-guide.test.ts`.
 *
 * **Why `--agent-help <topic>` and not an `isocan guide` verb.** It is the one
 * door every agent and the skill already know; it is answered before commander
 * parses, so it needs no daemon, no identity and no canvas; and a new verb
 * would add to the surface #124 exists to shrink.
 */

/**
 * **Tokens, estimated as characters over four.** There is no tokenizer in
 * this repo and the guide is read by many models with many tokenizers, so a
 * crude count that never changes is worth more than an exact one for one of
 * them: the budget is a ratchet, and a ratchet needs the same ruler every
 * night. `scripts/measure.mjs agent-help-tokens` uses the same formula on the
 * printed output. Characters, not bytes — an em-dash is one.
 */
export const estimateTokens = (text: string): number => Math.ceil([...text].length / 4);

/** One thing `--agent-help <slug>` can print. */
export interface GuideTopic {
  slug: string;
  /** One line for the index: what is in it, in the words an agent would look for. */
  summary: string;
  text: string;
}

/** `<!-- topic: protocol | the lap in full — … -->`, alone on its line. */
export const TOPIC_MARKER = /^<!-- topic: ([a-z][a-z-]*) \| (.+?) -->$/;

/**
 * Split a guide into its cold start (everything before the first marker) and
 * its topics (each marker to the next). Markers are not printed.
 */
export function parseGuide(markdown: string): { cold: string; topics: GuideTopic[] } {
  let cold = "";
  const topics: GuideTopic[] = [];
  let current: GuideTopic | null = null;
  for (const line of markdown.split("\n")) {
    const marker = TOPIC_MARKER.exec(line);
    if (marker) {
      current = { slug: marker[1]!, summary: marker[2]!, text: "" };
      topics.push(current);
    } else if (current) current.text += line + "\n";
    else cold += line + "\n";
  }
  for (const t of topics) t.text = t.text.trim();
  return { cold: cold.trim(), topics };
}

/** A module's guide, with the name `--agent-help <slug>` finds it by. */
export interface ModuleGuide {
  /** The package name — `@acme/hello`. */
  name: string;
  guide: string;
}

/** `@acme/hello` → `hello`: the last segment of a package name. */
export const moduleSlug = (name: string): string => name.split("/").pop()!.toLowerCase();

/**
 * Every topic this build can print: the guide's, then one per loaded module —
 * a module's verbs are described only while the module is here to answer
 * them, which is `surface.test.ts`'s rule with its pleasant inverse.
 */
export function guideTopics(modules: readonly ModuleGuide[] = []): GuideTopic[] {
  const topics = parseGuide(guideText).topics;
  for (const m of modules) {
    const text = m.guide.trim();
    const heading = /^##\s+(.+)$/m.exec(text)?.[1]?.trim() ?? m.name;
    topics.push({ slug: moduleSlug(m.name), summary: `${heading} — a module`, text });
  }
  return topics;
}

/** The first two words of every inline code span — where a verb is named. */
export function spanVerbs(markdown: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const span of markdown.matchAll(/`([^`\n]+)`/g)) {
    const words = span[1]!.trim().replace(/^isocan\s+/, "").split(/\s+/).slice(0, 2);
    for (const word of words) {
      for (const alt of word.split("|")) {
        if (/^[a-z][a-z-]*$/.test(alt)) counts.set(alt, (counts.get(alt) ?? 0) + 1);
      }
    }
  }
  return counts;
}

/** The index printed under the cold start: every topic, one line each. */
export function topicIndex(topics: readonly GuideTopic[]): string {
  return [
    "## Topics",
    "",
    "`isocan --agent-help <topic>` prints one in full; `--agent-help <verb>` prints",
    "the topic that teaches that verb; `--agent-help all` prints everything.",
    "",
    ...topics.map((t) => `- \`${t.slug}\` — ${t.summary}`),
  ].join("\n");
}

/** What `isocan --agent-help` prints with no topic: the cold start and the index. */
export function coldStart(topics: readonly GuideTopic[]): string {
  return `${parseGuide(guideText).cold}\n\n${topicIndex(topics)}\n`;
}

/** Everything, in index order — the guide as it printed before #124. */
export function wholeGuide(topics: readonly GuideTopic[]): string {
  return [coldStart(topics).trim(), ...topics.map((t) => `# Topic \`${t.slug}\` — ${t.summary}\n\n${t.text}`)].join("\n\n") + "\n";
}

/**
 * Answer `isocan --agent-help [topic]`. Returns what to print and where: a
 * word that is neither a topic nor a verb any topic teaches is an error that
 * lists the topics, so the next call can be right.
 */
export function agentHelp(
  arg: string | undefined,
  modules: readonly ModuleGuide[] = [],
): { out: string; err: string; code: number } {
  const topics = guideTopics(modules);
  if (!arg) return { out: coldStart(topics), err: "", code: 0 };
  const want = arg.toLowerCase();
  if (want === "all") return { out: wholeGuide(topics), err: "", code: 0 };
  const topic = topics.find((t) => t.slug === want);
  if (topic) return { out: topic.text + "\n", err: "", code: 0 };
  // A verb: the topic that names it most, and the others that name it at all.
  const hits = topics
    .map((t) => ({ t, n: spanVerbs(t.text).get(want) ?? 0 }))
    .filter((h) => h.n > 0)
    .sort((a, b) => b.n - a.n);
  if (hits.length) {
    const [best, ...rest] = hits;
    const also = rest.length ? `; also named in ${rest.map((h) => h.t.slug).join(", ")}` : "";
    return { out: `(\`${want}\` is taught in topic \`${best!.t.slug}\`${also})\n\n${best!.t.text}\n`, err: "", code: 0 };
  }
  return {
    out: "",
    err: `no topic or verb "${arg}" in the agent guide — topics: ${topics.map((t) => t.slug).join(", ")}, all\n`,
    code: 2,
  };
}
