import type { CanvasContents, CoreModule, Item, SlashCommand } from "@isocan/core";
import { isDesignSystem, isNote, isTextItem, itemKind } from "@isocan/core";

/**
 * **Documents** (`docs/projects/modules/design.md`, phase 4).
 *
 * The module that needed the two slots nothing else had asked for: an
 * INSPECTOR beside the stage (the outline of the document you are reading)
 * and a PAGE of its own (every document on the canvas, with its shape),
 * plus two commands an agent carries out. It adds no kind — markdown is
 * already a document — no property key and no op; what it adds is ways to
 * read what is already there, which is the test a module should pass first.
 *
 * A document here is a markdown item somebody brought or wrote as prose: not
 * a text node (a caption, a post-it, a speaker note) and not the design
 * system, which is markdown with a job of its own.
 */
export const DOCUMENT_MIMES = ["text/markdown", "text/plain"] as const;

export function isDocumentItem(item: Item): boolean {
  if (isTextItem(item) || isNote(item) || isDesignSystem(item)) return false;
  return itemKind(item) === "document" && currentMime(item) !== "application/pdf";
}

function currentMime(item: Item): string {
  return (item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0])?.mimeType ?? "";
}

/** The documents on a canvas, newest edit first. */
export function documentsOn(canvas: CanvasContents): Item[] {
  return Object.values(canvas.items)
    .filter(isDocumentItem)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
}

export interface Heading {
  level: number;
  text: string;
  /** The line it starts on, 1-based — what `docs outline` prints and what a
   *  reader jumps to. */
  line: number;
}

/**
 * The headings of a markdown document, in order. ATX headings only (`#` to
 * `######`); fenced code is skipped so a `# comment` in a shell block is not
 * a chapter. Setext underlines are not read — they are rare in what agents
 * write and ambiguous without a parser.
 */
export function outlineOf(markdown: string): Heading[] {
  const out: Heading[] = [];
  let inFence = false;
  markdown.split("\n").forEach((raw, i) => {
    const line = raw.replace(/\r$/, "");
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) out.push({ level: m[1]!.length, text: m[2]!, line: i + 1 });
  });
  return out;
}

/** Words, the way a writer counts them: runs of non-space, code fences out. */
export function wordCount(markdown: string): number {
  let inFence = false;
  let words = 0;
  for (const raw of markdown.split("\n")) {
    if (/^\s*(```|~~~)/.test(raw)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const bare = raw.replace(/[#>*_`-]+/g, " ").trim();
    if (bare) words += bare.split(/\s+/).length;
  }
  return words;
}

/** The outline as text, indented by level — what `docs outline` prints and
 *  what `/outline` posts. */
export function outlineText(headings: readonly Heading[]): string {
  if (headings.length === 0) return "(no headings)";
  const top = Math.min(...headings.map((h) => h.level));
  return headings.map((h) => `${"  ".repeat(h.level - top)}${h.text}`).join("\n");
}

/** About a minute per two hundred words, which is how long a reader takes. */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 200));
}

const outline: SlashCommand = {
  name: "outline",
  description: "Post a document's outline — its headings, indented — as a comment on it",
  usage: "[#Title]",
  source: "module",
  body: `Post the outline of a document as a comment on that document.

Which document: the one named after the command (\`#Title\`), else the one
the comment is on, else ask. Read it with \`isocan get <item>\` and print its
headings with \`isocan docs outline <item>\` — that is the outline, indented
by level, and it is what you post, with one line above it saying how many
words and about how many minutes to read (\`isocan docs ls\` has both).

Do not rewrite the document. If it has no headings, say so and offer three
headings that would fit it, as a suggestion in the same comment.`,
};

const summarize: SlashCommand = {
  name: "summarize",
  description: "Summarize a document in a few sentences, as a comment on it",
  usage: "[#Title] [in <n> words]",
  source: "module",
  body: `Summarize a document, as a comment on that document.

Which document: the one named after the command (\`#Title\`), else the one
the comment is on, else ask. Read it whole with \`isocan get <item>\`. Write
the summary in the document's own words where you can, at the length asked
for (\`in 50 words\`) or in three sentences if nobody said; lead with what
the document decides or asks, not with what it is about.

Post it with \`isocan comment add <item> "…"\`. Never edit the document
itself — a summary that replaces the thing it summarizes is a deletion.`,
};

export const documentsModule: CoreModule = {
  name: "@isocan/documents",
  commands: [outline, summarize],
};

export default documentsModule;
