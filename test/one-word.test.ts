import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * **One word each: a canvas is the surface, a project is the directory** (#135).
 *
 * The glossary is in `docs/architecture.md` ("One word each"), and the
 * measurement behind it in `docs/research/2026-09-06-project-and-canvas.md`:
 * 4,879 "canvas" against 331 "project" in the workspaces' source, the product's
 * word settled as canvas, and "project" wandering in where it meant the
 * surface — "link it into a project", "the project's design still governs",
 * `isocan --project <id>` printed as the way to reply. These are the words
 * agents read every turn, so a drift here is a drift in every session.
 *
 * So this reads **what a person or an agent is handed** — the README, the
 * agent guide (`isocan --agent-help`), every string literal in the CLI (its
 * help, its errors, its hints) and every string and JSX text in the web app —
 * and fails on the word `project` wherever it is not one of the uses the
 * glossary keeps:
 *
 *   - **the wire and the marker**, which are durable and name the container:
 *     `project.*` ops, `/api/projects`, `.isocan/project.json` — removed
 *     before matching, with every other path, because a path is an address,
 *     not a sentence;
 *   - **a sentence about the directory**, listed in `ALLOWED` below with the
 *     reason it is the directory and not the canvas.
 *
 * `projection`, `projector`, `projected` are other words; the match is on the
 * whole word `project`/`projects` only, which is also why "projects the live
 * site" (a verb) has to be listed rather than missed.
 *
 * **Deliberately not read:** `docs/changelog/`, `docs/research/`,
 * `docs/reviews/` (lessons included) and `docs/projects/`. They quote history
 * — the note that retired the word has to be able to say it — and a guard over
 * a record is a guard against remembering. Nor the Anatomy module
 * (`packages/modules/anatomy`), whose "Anatomy project" is its own domain
 * object (the model of an analysed repository, stored under its own MIME
 * type); renaming that is the module's decision, not a copy edit.
 *
 * `ALLOWED` cannot rot: an entry nothing matches any more fails the second
 * case, so a sentence that was reworded takes its licence with it.
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

/** A sentence that may say "project", and why it is the directory (or not the noun at all). */
type Allowed = { file: string; phrase: string; why: string; exact?: true };

const ALLOWED: Allowed[] = [
  { file: "README.md", phrase: "every research note and project by", why: "the repo's own docs/projects/ bodies of work" },
  { file: "README.md", phrase: "Starting a *new* project this way", why: "the directory: the glossary sentence follows it" },
  { file: "README.md", phrase: "**project** is the directory that holds it", why: "the glossary sentence itself" },
  { file: "README.md", phrase: "Anatomy project exploration", why: "Anatomy's own domain object, an analysed repository" },
  { file: "packages/cli/src/agent-guide.md", phrase: "The directory you are in IS the project", why: "the directory, by definition" },
  { file: "packages/cli/src/agent-guide.md", phrase: "every project's primary doc", why: "the repo's own docs/projects/ bodies of work" },
  { file: "packages/cli/src/agent-guide.md", phrase: "for a real project is ordinary", why: "somebody's repository" },
  { file: "packages/cli/src/agent-guide.md", phrase: "inside a project never sweeps", why: "a git working directory" },
  { file: "packages/cli/src/agent-guide.md", phrase: "projects the live site", why: "the verb" },
  { file: "packages/cli/src/agent-guide.md", phrase: "design project", why: "the verb: `design project <directory>`" },
  { file: "packages/cli/src/agent-guide.md", phrase: "|direction|project|reconcile|", why: "the verb `design project`, in the cold start's one-line index of the design family (#124)" },
  { file: "packages/cli/src/agent-guide.md", phrase: "and `project` is", why: "the hidden alias of `isocan canvas`, named once among the older spellings so nothing teaches it (#124)" },
  { file: "README.md", phrase: "design project", why: "the verb: `design project <directory>`" },
  { file: "packages/cli/src/main.ts", phrase: "projects a live site", why: "the verb" },
  { file: "packages/cli/src/main.ts", phrase: "Run this in a project directory", why: "the directory, by definition" },
  { file: "packages/cli/src/main.ts", phrase: "--project <ref>", why: "the hidden alias old scripts still pass; hideHelp() keeps it out of --help" },
  { file: "packages/cli/src/main.ts", phrase: "project", exact: true, why: "`.alias(\"project\")`, the hidden spelling of `isocan canvas` kept for old scripts" },
  { file: "packages/cli/src/design-system.ts", phrase: "design project", why: "the verb: `design project <directory>`" },
  { file: "packages/cli/src/design-system.ts", phrase: "project <directory>", why: "the verb's registration" },
  { file: "packages/web/src/components/AgentTray.tsx", phrase: "this project checked out", why: "a clone of the directory" },
  { file: "packages/web/src/lib/guides.ts", phrase: "Every research note and project by", why: "the repo's own docs/projects/ bodies of work" },
  { file: "packages/web/src/lib/terms.ts", phrase: "a young project run by one person", why: "isocan itself, the repository" },
];

/** Paths, URLs and dotted wire names are addresses, not sentences: `docs/projects/x`,
 *  `/api/projects/:id`, `.isocan/project.json`, `project.update`, `new-project.sh`. */
function addressesRemoved(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[\w.@~:<>$-]*\/[\w.@~:<>/$*-]*/g, " ")
    .replace(/\bproject\.(?:[a-z]\w*|\*(?!\*))/g, " ")
    .replace(/\b[\w-]+-projects?(?:-[\w-]+)?(?:\.\w+)?\b/g, " ")
    .replace(/\bprojects?-[\w-]+/g, " ");
}

const WORD = /\bprojects?\b/i;

/** Every string a file hands a reader: literals, template parts and JSX text. Comments are code's own prose and are not read. */
function literalsOf(file: string, source: string): string[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: string[] = [];
  const walk = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node)) {
      out.push(node.text);
    }
    // An import specifier is a module path, not copy.
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return out;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(path.join(root, dir))) {
    const rel = path.posix.join(dir, name);
    if (statSync(path.join(root, rel)).isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith(".d.ts")) out.push(rel);
  }
  return out;
}

/** What each read file hands a reader, one entry per line (markdown) or per string (source). */
function surfaces(): Array<{ file: string; lines: string[] }> {
  const markdown = ["README.md", "packages/cli/src/agent-guide.md", ".agents/skills/isocan-collab/SKILL.md"];
  const code = [...sourceFiles("packages/cli/src"), ...sourceFiles("packages/web/src")];
  return [
    ...markdown.map((file) => ({ file, lines: read(file).split("\n") })),
    ...code.map((file) => ({ file, lines: literalsOf(file, read(file)).flatMap((s) => s.split("\n")) })),
  ];
}

type Hit = { file: string; line: string; allowedBy?: Allowed };

function hits(): Hit[] {
  const out: Hit[] = [];
  for (const { file, lines } of surfaces()) {
    for (const line of lines) {
      if (!WORD.test(addressesRemoved(line))) continue;
      out.push({ file, line: line.trim(), allowedBy: ALLOWED.find((a) => a.file === file && (a.exact ? line.trim() === a.phrase : line.includes(a.phrase))) });
    }
  }
  return out;
}

describe("one word each (#135): canvas is the surface, project is the directory", () => {
  const found = hits();

  it("says 'project' to a reader only where it means the directory", () => {
    const strays = found.filter((h) => !h.allowedBy).map((h) => `${h.file}: ${h.line}`);
    expect(
      strays,
      "Say 'canvas' for the surface (docs/architecture.md, 'One word each'). If the sentence really is about the directory, add it to ALLOWED with the reason.",
    ).toEqual([]);
  });

  it("keeps no licence nothing uses", () => {
    const used = new Set(found.flatMap((h) => (h.allowedBy ? [h.allowedBy] : [])));
    expect(ALLOWED.filter((a) => !used.has(a)).map((a) => `${a.file}: ${a.phrase}`)).toEqual([]);
  });

  it("calls the web store's canvas record what it is, not a project", () => {
    // The zustand field was `project` (the research note counted 19 readers);
    // the wire's `CanvasState.project` stays, so only the store's own spellings are read.
    const offenders = sourceFiles("packages/web/src").filter((file) =>
      /useCanvasStore\(\s*\(?\s*\w+\s*\)?\s*=>[^)]*?\b\w+\.project\b|getState\(\)\.project\b|\bsetProjects\b/.test(read(file)),
    );
    expect(offenders).toEqual([]);
  });

  it("catches the drift it exists for", () => {
    // Falsification: the three sentences this guard was written after.
    for (const line of ["link it into a project, and explicitly allow", "The project's own design still governs.", "reply: isocan --project cvs_1 comment reply"]) {
      expect(WORD.test(addressesRemoved(line)), line).toBe(true);
    }
    for (const line of ["`.isocan/project.json`", "GET /api/projects/:id", "`project.update`", "docs/projects/multiuser/", "a projected site", "scripts/new-project.sh"]) {
      expect(WORD.test(addressesRemoved(line)), line).toBe(false);
    }
  });
});
