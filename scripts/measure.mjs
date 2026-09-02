#!/usr/bin/env node
/**
 * **One number, printed on stdout.**
 *
 * A persona's goal is `(number, bound, the command that produces it)`, and this
 * is that command for the numbers this repo already knows how to take. Each
 * metric prints a single integer and nothing else, so a goal can be checked by
 * running it and comparing — no parsing, no format to drift.
 *
 *   node scripts/measure.mjs contrast-failures      → 0
 *   node scripts/measure.mjs --list
 *   node scripts/measure.mjs --selftest
 *
 * **`--selftest` is not optional politeness.** The build rule in
 * `docs/projects/personas/design.md` is that no persona may declare a goal
 * whose measuring command has not been shown to fail on something broken —
 * paid for three times in one week by instruments that reported nothing and
 * were believed. Every metric here therefore names a way to break it, and the
 * selftest breaks it and checks the number moves.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });

/**
 * Each metric: what it counts, how, and — for the selftest — a mutation that
 * MUST move it. A metric with no `breakIt` cannot be trusted and is refused by
 * `--selftest` rather than quietly skipped.
 */
const METRICS = {
  "contrast-failures": {
    what: "text failing 4.5:1 against what is actually painted, on the front door, worst width",
    take() {
      const out = run("node", ["scripts/grade.mjs", "--file", "docs/index.html", "--json"]);
      const g = JSON.parse(out)[0];
      return Math.max(...Object.values(g.contrastFailures ?? { 0: 0 }).map(Number));
    },
    breakIt: {
      file: "docs/index.html",
      // A grey that cannot pass on this ground, in a rule the page really uses.
      apply: (t) => t.replace("--ink-dim:  #6a6872;", "--ink-dim:  #cfcdd4;"),
    },
  },
  "grader-checks-failing": {
    what: "deterministic checks failing across the pages this repo ships",
    take() {
      const out = run("node", ["scripts/grade.mjs", "--file", "docs/index.html", "--json"]);
      const g = JSON.parse(out)[0];
      return Object.values(g.checks ?? {}).filter((ok) => !ok).length;
    },
    breakIt: {
      file: "docs/index.html",
      apply: (t) => t.replace("--ink-dim:  #6a6872;", "--ink-dim:  #cfcdd4;"),
    },
  },
  "core-runtime-deps": {
    what: "runtime dependencies of @isocan/core — the reducer must stay portable",
    take() {
      const pkg = JSON.parse(readFileSync(path.join(repo, "packages/core/package.json"), "utf8"));
      return Object.keys(pkg.dependencies ?? {}).length;
    },
    breakIt: {
      file: "packages/core/package.json",
      apply: (t) => {
        const pkg = JSON.parse(t);
        pkg.dependencies = { ...(pkg.dependencies ?? {}), "left-pad": "^1.3.0" };
        return JSON.stringify(pkg, null, 2) + "\n";
      },
    },
  },
  "op-types": {
    what: "operations in the vocabulary — every one is a fact both surfaces must speak",
    take() {
      const src = readFileSync(path.join(repo, "packages/core/src/ops.ts"), "utf8");
      return (src.match(/^ {2}\| \{/gm) ?? []).length;
    },
    breakIt: {
      file: "packages/core/src/ops.ts",
      apply: (t) => t + "\n// selftest\ntype Extra =\n  | { type: \"selftest.noop\" };\n",
    },
  },
  "a11y-failures": {
    what: "controls with no accessible name, targets under 24px, images with no alt — the front door",
    take() {
      const out = run("node", ["scripts/grade.mjs", "--file", "docs/index.html", "--json"]);
      const g = JSON.parse(out)[0];
      return (g.namelessControls ?? 0) + (g.smallTargets ?? 0) + (g.imagesWithoutAlt ?? 0);
    },
    breakIt: {
      file: "docs/index.html",
      // A control with nothing in it and nothing naming it: unreachable by
      // anyone not looking at the pixels.
      apply: (t) => t.replace("</body>", '<button style="width:12px;height:12px"></button>\n</body>'),
    },
  },
  "colour-literals": {
    what: "colours written as literals where a token exists — the front door",
    take() {
      const out = run("node", ["scripts/grade.mjs", "--file", "docs/index.html", "--json"]);
      return JSON.parse(out)[0].colourLiterals ?? 0;
    },
    breakIt: {
      file: "docs/index.html",
      apply: (t) => t.replace(":root {", ":root {\n    /* selftest */ --x: #abcdef;"),
    },
  },
  "copied-rules": {
    what:
      "CSS rule bodies that already exist word for word elsewhere in the sheet — " +
      "each one a copy that cannot notice when the next copy is forgotten",
    /**
     * **The Personas panel's broken header, as a number.**
     *
     * Five dock panels each hand-rolled a `<header>`, and four carried a
     * private rule to lay it out. Those four rules were byte-identical.
     * Personas was the fifth and never got a copy, so its header fell back to
     * `display: block` and its icon sat on its own title.
     *
     * Nothing could have caught that by reading the Personas panel, because
     * nothing there is wrong — what is wrong is four copies of something
     * elsewhere, none of which can notice a missing fifth. So the thing worth
     * counting is the copying, not the omission.
     *
     * Declarations are sorted before comparing, so reordering does not hide a
     * duplicate, and bodies under three declarations are ignored: `flex: 1`
     * and `display: none` are vocabulary rather than structure, and counting
     * them would bury the signal under noise nobody should act on.
     *
     * **What this number is NOT.** It counts value-coincidence, which is
     * evidence of copying rather than proof of it. `styles.css` holds an
     * explicit position on the other case — two rules whose values agree
     * because the things they style happen to want the same treatment, where
     * *"a selector list spanning both would be one rule pretending two
     * different elements are the same element. The values are what agree, not
     * the code."*
     *
     * So a rise is a question, not a verdict: is this one thing written twice,
     * or two things that agree? Merging the second kind is the mistake the
     * sheet names, and the right answer there is to raise the bound WITH THE
     * REASON — which is what happened at 47.
     */
    take() {
      const css = readFileSync(path.join(repo, "packages/web/src/styles.css"), "utf8");
      const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
      const seen = new Map();
      let copies = 0;
      for (const [, body] of bare.matchAll(/\{([^{}]*)\}/g)) {
        const decls = body
          .split(";")
          .map((d) => d.trim().replace(/\s+/g, " "))
          .filter(Boolean);
        if (decls.length < 3) continue;
        const key = decls.sort().join(";");
        if (seen.has(key)) copies += 1;
        else seen.set(key, true);
      }
      return copies;
    },
    breakIt: {
      file: "packages/web/src/styles.css",
      // Paste the shared panel header back as a private copy — the exact
      // shape this metric exists to see.
      apply: (t) =>
        t.replace(
          ".panel-head {",
          ".selftest-panel header {\n  display: flex; align-items: center; gap: 7px; flex: none;\n  padding: 10px 14px; border-bottom: 1px solid var(--line-soft);\n}\n.panel-head {",
        ),
    },
  },
  /**
   * **The ENTRY chunk, not the biggest one on disk.**
   *
   * This took `Math.max` over every `.js` in `dist/assets` while its own
   * description said "what a first visit downloads", and on 1 Sep 2026 those
   * two stopped meaning the same thing. Splitting the markdown parser out took
   * the entry from 757,948 to 600,420 — a real 157 KB off a first visit — and
   * the metric went on reporting 615,249, because `StageEditor` is now the
   * biggest file in the directory. `StageEditor` is lazy. Nobody downloads it
   * on a first visit, and a bound it can breach is a bound that fails for a
   * reason unrelated to the sentence describing it.
   *
   * Worse in the other direction: the max would have gone UNDER the bound the
   * moment anything eager was split into two eager chunks, which downloads
   * exactly the same bytes. A number you can satisfy by rearranging files is a
   * number that rewards rearranging files.
   *
   * So it reads the module script out of the built HTML, which is the one
   * artifact that knows which chunk the browser fetches first.
   */
  "bundle-bytes": {
    what: "the entry chunk, in bytes — what a first visit downloads before anything renders",
    take: () => statSync(path.join(repo, entryChunk())).size,
    breakIt: {
      // A getter, because the entry's name carries a content hash and changes
      // with every build — a literal path here would go stale silently, which
      // is the failure this whole file exists to make impossible.
      get file() {
        return entryChunk();
      },
      apply: (t) => `${t}\n// selftest\n${"x".repeat(2_000_000)}\n`,
    },
  },
  /**
   * **The words, which nothing else here watches.**
   *
   * `slop.ts` carries the copy rules this project believes — an apology as an
   * error message, copy that narrates the interface, Title Case On Everything,
   * "not just X, it's Y". Most need a reader. These few are a string match, and
   * a string match is a number.
   */
  "copy-tells": {
    what: "user-facing strings in the app that trip a greppable copy rule",
    take() {
      const dirs = ["packages/web/src/components", "packages/web/src/pages", "packages/web/src/lib"];
      const BANNED = [
        /\b(sorry|oops|whoops|unfortunately)\b/i,
        /\b(seamless|seamlessly|revolutioni[sz]e|unlock|elevate|effortless|cutting-edge|leverage)\b/i,
        /not just [^,"'`]{2,30}[—,-] it'?s\b/i,
      ];
      let hits = 0;
      for (const dir of dirs) {
        const full = path.join(repo, dir);
        if (!existsSync(full)) continue;
        for (const file of readdirSync(full).filter((f) => /\.(tsx?|ts)$/.test(f))) {
          const src = readFileSync(path.join(full, file), "utf8")
            // Comments are where this codebase does its arguing, and an
            // argument that QUOTES a banned phrase to ban it is not a tell.
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/^\s*\/\/.*$/gm, "");
          // Only strings a person can read: a label, a title, an aria-label,
          // or text between tags. Not identifiers, not imports.
          const strings = [
            ...src.matchAll(/(?:title|aria-label|placeholder|label)=\{?["'`]([^"'`]{4,200})["'`]/g),
            ...src.matchAll(/>\s*([A-Z][^<>{}\n]{6,200}?)\s*</g),
          ].map((m) => m[1]);
          for (const text of strings) {
            if (BANNED.some((rx) => rx.test(text))) hits += 1;
          }
        }
      }
      return hits;
    },
    breakIt: {
      file: "packages/web/src/components/Glyphs.tsx",
      apply: (t) => t + '\nexport const SELFTEST = <button title="Sorry, something went wrong">x</button>;\n',
    },
  },
  /**
   * **Surface area nobody asked for.**
   *
   * An `export` is a promise that something outside this file needs it. One
   * that nothing outside the file uses — not another module, not a test — is a
   * promise to nobody, and a future reader has to treat it as API before
   * discovering it is not. This only ever goes up on its own, which is why the
   * goal against it is a RATCHET at today's number rather than a target of
   * zero: any new one fails on the commit that added it, while the author
   * still remembers why.
   */
  "unused-exports": {
    what: "exports that nothing outside their own file uses",
    take: () => scanExports().unused,
    breakIt: {
      file: "packages/core/src/kinds.ts",
      /**
       * **The name is assembled rather than written**, and that is not
       * cleverness. The first version injected a literal
       * `SELFTEST_UNUSED_EXPORT` — which appears in THIS file, which the scan
       * reads, so the metric correctly found it "used elsewhere" and did not
       * move. The selftest caught it: the mutation was wrong, not the metric.
       */
      apply: (t) => `${t}\n/** selftest */\nexport const ${["Zq", "Tmp", "Sym"].join("")} = 1;\n`,
    },
  },
  /**
   * **In this codebase the comments ARE the documentation**, argued at length
   * and relied on by people and agents alike. An export with nothing above it
   * is the one place that stops being true.
   *
   * Also a ratchet, and deliberately not zero: some exports genuinely do not
   * need a paragraph, and a persona that nags about every one of them becomes
   * noise — which is how a persona stops being read.
   */
  "undocumented-exports": {
    what: "exports with no comment above them",
    take: () => scanExports().bare,
    breakIt: {
      file: "packages/core/src/kinds.ts",
      apply: (t) => `${t}\nexport const SELFTEST_BARE_EXPORT = 2;\n`,
    },
  },
  "lint-violations": {
    what: "eslint errors — rules-of-hooks and exhaustive-deps, both at error",
    take() {
      /**
       * The JSON goes to STDOUT, and it is read on both paths. The first
       * version passed `-o /dev/null`, which sends the report to a file and
       * leaves stdout empty — so a run with violations parsed nothing and
       * returned 0. Caught by `--selftest`, which is the entire argument for
       * having one: the metric was wrong in the direction that reads as
       * healthy.
       */
      let out = "";
      try {
        out = run("npx", ["eslint", ".", "--format", "json"]);
      } catch (err) {
        out = String(err.stdout ?? "");
      }
      const trimmed = out.slice(out.indexOf("["));
      const parsed = trimmed.startsWith("[") ? JSON.parse(trimmed) : [];
      return parsed.reduce((n, f) => n + (f.errorCount ?? 0), 0);
    },
    breakIt: {
      // The bug this linter was added for: a hook below an early return, which
      // white-screened the pen tool with React #300.
      file: "packages/web/src/components/OwnCursor.tsx",
      apply: (t) =>
        t +
        "\nexport function SelftestViolation({ on }: { on: boolean }) {\n" +
        "  if (!on) return null;\n" +
        "  const [n] = useState(0);\n" +
        "  return <span>{n}</span>;\n}\n",
    },
  },
};


/**
 * One walk for both export metrics: which exported names nothing outside their
 * own file uses, and which carry no comment.
 *
 * Deliberately a text scan rather than a type-aware tool. It is wrong at the
 * edges — a name that is also an ordinary word could be "used" by coincidence —
 * and it is wrong in the SAFE direction: it under-reports, so the ratchet never
 * fires on a false positive. A number that cries wolf is a number people turn
 * off.
 */
/**
 * Where the built HTML says the browser should start. Vite emits the entry as
 * `<script type="module" src="/assets/index-<hash>.js">`, and that file — not
 * the largest one in the directory — is what a first visit downloads.
 */
function entryChunk() {
  const html = path.join(repo, "packages/web/dist/index.html");
  if (!existsSync(html)) {
    throw new Error("no build at packages/web/dist — run `npm run build` first");
  }
  const found = /<script[^>]*\ssrc="\/assets\/([^"]+\.js)"/.exec(readFileSync(html, "utf8"));
  if (!found) {
    throw new Error("no module script in packages/web/dist/index.html — the build's shape changed");
  }
  return path.join("packages/web/dist/assets", found[1]);
}

function scanExports() {
  const list = (glob) =>
    execFileSync("git", ["ls-files", ...glob], { cwd: repo, encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  const sources = list(["packages/core/src", "packages/server/src", "packages/web/src/lib"]).filter(
    (f) => /\.tsx?$/.test(f) && !f.endsWith("index.ts"),
  );
  const everywhere = list(["packages", "test", "scripts"]).filter((f) => /\.(tsx?|mjs)$/.test(f));
  const bodies = new Map(everywhere.map((f) => [f, readFileSync(path.join(repo, f), "utf8")]));

  let unused = 0;
  let bare = 0;
  for (const file of sources) {
    const src = bodies.get(file) ?? readFileSync(path.join(repo, file), "utf8");
    const lines = src.split("\n");
    lines.forEach((line, i) => {
      const m = /^export (?:async function|function|const|interface|type) (\w+)/.exec(line);
      if (!m) return;
      const name = m[1];
      // A comment on the line above — a block's `*/`, a `//`, or a continuation.
      const prev = (lines[i - 1] ?? "").trim();
      if (!(prev.endsWith("*/") || prev.startsWith("//") || prev.startsWith("*"))) bare += 1;
      const word = new RegExp(`\\b${name}\\b`);
      let usedElsewhere = false;
      for (const [other, body] of bodies) {
        if (other === file) continue;
        if (word.test(body)) { usedElsewhere = true; break; }
      }
      if (!usedElsewhere) unused += 1;
    });
  }
  return { unused, bare };
}

const argv = process.argv.slice(2);

if (argv.includes("--list")) {
  for (const [name, m] of Object.entries(METRICS)) console.log(`${name.padEnd(24)} ${m.what}`);
  process.exit(0);
}

if (argv.includes("--selftest")) {
  /**
   * **It mutates real files, so it must have the tree to itself.**
   *
   * Proving `contrast-failures` fires means breaking `docs/index.html` for a
   * few seconds. The first version of this ran inside the vitest suite and
   * promptly failed a DIFFERENT test in another worker, which was grading that
   * same page at that same moment — a green metric bought by a red neighbour.
   *
   * So this is a CI step of its own (`release.yml`), never a test, and it
   * refuses outright if anything it is about to break is already modified. A
   * selftest that clobbers uncommitted work is worse than one that does not
   * run.
   */
  const targets = [
    ...new Set(
      Object.values(METRICS)
        .filter((m) => m.breakIt && !m.breakIt.create)
        .map((m) => m.breakIt.file),
    ),
  ];
  const dirty = run("git", ["status", "--porcelain", "--", ...targets]).trim();
  if (dirty) {
    console.error(
      "refusing: these files have uncommitted changes and the selftest would overwrite them:\n" +
        dirty +
        "\n\nCommit or stash first.",
    );
    process.exit(1);
  }
  let bad = 0;
  for (const [name, m] of Object.entries(METRICS)) {
    if (!m.breakIt) {
      console.log(`REFUSED ${name} — no way to break it is declared, so it cannot be trusted`);
      bad++;
      continue;
    }
    const file = path.join(repo, m.breakIt.file);
    /**
     * Two shapes of mutation: EDIT a file that is there, or CREATE one that is
     * not. `bundle-bytes` needs the second — it measures built artifacts, and
     * the way to break that number is to put a big one in the directory, not
     * to edit a source file it does not read.
     */
    const creating = m.breakIt.create === true;
    if (creating && existsSync(file)) {
      console.log(`SILENT  ${name} — ${m.breakIt.file} already exists; the selftest will not overwrite it`);
      bad++;
      continue;
    }
    const before = creating ? null : readFileSync(file, "utf8");
    const clean = m.take();
    let broken;
    try {
      const mutated = m.breakIt.apply(before ?? "");
      if (!creating && mutated === before) {
        console.log(`SILENT  ${name} — its mutation changed nothing; the anchor has moved`);
        bad++;
        continue;
      }
      writeFileSync(file, mutated);
      broken = m.take();
    } finally {
      // Put it back exactly, or take away exactly what was added.
      if (creating) rmSync(file, { force: true });
      else writeFileSync(file, before);
    }
    if (broken === clean) {
      console.log(`SILENT  ${name} — ${clean} before and after a deliberate break`);
      bad++;
    } else {
      console.log(`fires   ${name} — ${clean} clean, ${broken} broken`);
    }
  }
  if (bad) {
    console.error(`\n${bad} metric(s) cannot be trusted. A goal measured by one of these is a goal that passes forever.`);
    process.exit(1);
  }
  console.log(`\nall ${Object.keys(METRICS).length} metrics move when the thing they measure breaks`);
  process.exit(0);
}

const name = argv[0];
const metric = METRICS[name];
if (!metric) {
  console.error(`unknown metric "${name ?? ""}" — try --list`);
  process.exit(2);
}
console.log(metric.take());
