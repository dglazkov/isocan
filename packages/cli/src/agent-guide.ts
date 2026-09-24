import guideText from "./agent-guide.md";
import startText from "./guide/start.md";

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
 * cold start — most of it about kinds of work that agent was not doing. So
 * `isocan --agent-help` prints `guide/start.md` — what isocan is, the lap, and
 * one line per verb family — followed by an index of topics GENERATED from
 * the list below, so a topic nobody is told about cannot exist.
 * `isocan --agent-help <topic>` prints one topic, `--agent-help <verb>` the
 * topic that teaches that verb, and `--agent-help all` everything, for anyone
 * who wants the old behaviour. The budget on the cold start is held by
 * `packages/cli/test/agent-guide.test.ts`.
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

/**
 * The base guide's topics, as the `## ` sections of `agent-guide.md` each one
 * gathers. Order is the index's order: the protocol in full first, the fine
 * print last. `agent-guide.test.ts` holds that every section is in exactly one
 * topic and every section named here exists — so a new `##` in the guide
 * without a home here fails the build rather than vanishing from every
 * printout but `all`.
 */
export const BASE_TOPICS: readonly { slug: string; summary: string; sections: readonly string[] }[] = [
  {
    slug: "protocol",
    summary: "the lap in full — naming yourself, the session, who is at your terminal, parking, several of you, your inbox, asking a person",
    sections: [
      "Orient (once per session)",
      "Your name",
      "The session protocol",
      "Who is at your terminal",
      "Parking is a foreground call",
      "More than one of you",
      "What is addressed to you",
      "When you need a person",
      "Working a canvas that is not this directory's",
    ],
  },
  {
    slug: "practices",
    summary: "the habits that earn trust — terse replies, versions, marks and reactions, tidy canvases, stopping, product bugs",
    sections: ["Practices that earn trust"],
  },
  {
    slug: "items",
    summary: "making and arranging things — `add`, text nodes, Google Docs, canvases on canvases, groups, copying, files on disk",
    sections: [
      "Adding anything: one verb that reads what you give it",
      "Words on the canvas",
      "A Google Doc on the canvas",
      "A canvas on a canvas",
      "Groups: explicit membership, with area aliases",
      "Copying things, and taking them to another canvas",
      "Screens that become files",
    ],
  },
  {
    slug: "design",
    summary: "design work — the design system, requests and questions, images, variations, compare, review and repair",
    sections: [
      "Choosing between variations",
      "Bringing in somebody else's theme",
      "Making an image",
      "One shared review and bounded repair",
    ],
  },
  {
    slug: "context",
    summary: "what an agent reads before it starts — the Chat, `context`, pins and exclusions, document status",
    sections: ["The Chat", "What you are about to read", "Saying what matters here", "Saying where a document stands"],
  },
  {
    slug: "history",
    summary: "what happened — `timeline`, `activity`, `lens`, `history`, `at`, `recap`, `whatsnew`",
    sections: ["Where the seams are", "What has been going on", "What changed"],
  },
  {
    slug: "agents",
    summary: "agents beyond you — standing agents, the bench, personas and the docket, scripting against the library",
    sections: ["Standing agents", "Your bench: the agents a person has", "The roles you can take on", "Scripting"],
  },
  {
    slug: "present",
    summary: "running a room — the slide deck, design sprints",
    sections: ["The slide deck", "Running a sprint"],
  },
  {
    slug: "extend",
    summary: "what a canvas carries — modules, tools in the rail, panels in the dock",
    sections: ["Modules", "Tools: a canvas that carries its own buttons", "Panels: a canvas that carries its own page"],
  },
  {
    slug: "homes",
    summary: "where a canvas lives — homes and replicas, teleport, export and import, missing bytes",
    sections: [
      "When a canvas's home is somewhere else",
      "Taking a canvas somewhere else",
      "Moving a canvas to another home",
      "Backing a canvas up",
      "When a teammate sees the item but not the picture",
    ],
  },
  {
    slug: "sharing",
    summary: "who may enter — `share`, spaces, groups of people, passes, embeds, badges, and the refusals",
    sections: [
      "Sharing a canvas",
      "Spaces: a set of canvases, shared once",
      "Groups: a set of people, shared with once",
      "Your own surfaces",
      "Passes: a credential, not an invitation",
      "When a canvas refuses you",
      "When the DOOR refuses you",
    ],
  },
  {
    slug: "reference",
    summary: "every verb with its flags, the older spellings, and the fine print",
    sections: ["Quick reference of the whole surface"],
  },
];

/** A `## ` section of a guide: its heading's text and everything under it. */
export interface GuideSection {
  heading: string;
  text: string;
}

/**
 * Split markdown at its `## ` headings, ignoring any inside code fences. The
 * text before the first heading is the preamble; `###` stays with its `##`.
 */
export function splitSections(markdown: string): { preamble: string; sections: GuideSection[] } {
  const sections: GuideSection[] = [];
  let preamble = "";
  let current: GuideSection | null = null;
  let fenced = false;
  for (const line of markdown.split("\n")) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    if (!fenced && line.startsWith("## ")) {
      current = { heading: line.slice(3).trim(), text: "" };
      sections.push(current);
    }
    if (current) current.text += line + "\n";
    else preamble += line + "\n";
  }
  return { preamble, sections };
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
 * Every topic this build can print: the base guide's, then one per loaded
 * module — a module's verbs are described only while the module is here to
 * answer them, which is `surface.test.ts`'s rule with its pleasant inverse.
 */
export function guideTopics(modules: readonly ModuleGuide[] = []): GuideTopic[] {
  const { preamble, sections } = splitSections(guideText);
  const byHeading = new Map(sections.map((s) => [s.heading, s.text]));
  const topics: GuideTopic[] = BASE_TOPICS.map((t, i) => ({
    slug: t.slug,
    summary: t.summary,
    text: ((i === 0 ? preamble : "") + t.sections.map((h) => byHeading.get(h) ?? "").join("")).trim(),
  }));
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
  return `${startText.trim()}\n\n${topicIndex(topics)}\n`;
}

/** Everything, in index order — the guide as it printed before #124. */
export function wholeGuide(topics: readonly GuideTopic[]): string {
  return [coldStart(topics).trim(), ...topics.map((t) => t.text)].join("\n\n") + "\n";
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
