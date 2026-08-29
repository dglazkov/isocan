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
import { readFileSync, writeFileSync } from "node:fs";
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
  const targets = [...new Set(Object.values(METRICS).map((m) => m.breakIt?.file).filter(Boolean))];
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
    const before = readFileSync(file, "utf8");
    const clean = m.take();
    let broken;
    try {
      const mutated = m.breakIt.apply(before);
      if (mutated === before) {
        console.log(`SILENT  ${name} — its mutation changed nothing; the anchor has moved`);
        bad++;
        continue;
      }
      writeFileSync(file, mutated);
      broken = m.take();
    } finally {
      writeFileSync(file, before);
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
