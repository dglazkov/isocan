#!/usr/bin/env node
/**
 * **Picking a lesson number, and finding out when two people picked the same one.**
 *
 *   node scripts/lessons.mjs            what is there, and the next free number
 *   node scripts/lessons.mjs --next     just the number, for a script to use
 *   node scripts/lessons.mjs --check    collisions, and the citations they make ambiguous
 *
 * A lesson's number is its name: `see lessons.md #8` appears 112 times, `#5`
 * 111, and 728 citations across the tree in total. That is what makes the
 * numbers worth keeping and also what makes them cost something — an
 * identifier everybody cites cannot be renamed later, so it has to be right
 * when it is written.
 *
 * **And it is allocated by hand, on branches, in parallel.** `lessons.md` says
 * "take the next FREE number, not the one after the last row", which is advice
 * rather than a mechanism: three branches all claimed 55 in one week, and on
 * 13 September anatomy and main both claimed 51. `test/reviews.test.ts` has
 * always caught the collision — the expensive part was never noticing, it was
 * working out which number to move to and which citations now point at two
 * rows.
 *
 * So this says both. It cannot stop two branches choosing the same number
 * while neither can see the other; nothing can, short of giving up numbers.
 * It makes the choice correct when there is something to see, and the repair
 * mechanical when there was not.
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const LESSONS = "docs/reviews/lessons.md";

/** Every numbered row, in the order the file has them. */
export function rows(text = readFileSync(path.join(repo, LESSONS), "utf8")) {
  return [...text.matchAll(/^\| (\d+) \| (.{0,90})/gm)].map((match) => ({
    number: Number(match[1]),
    opening: match[2].replace(/\*\*/g, "").trim(),
  }));
}

/**
 * The lowest number no row uses — not one past the last row, which is the
 * mistake the file warns about and the way every collision here happened.
 * Concurrent work makes those two different numbers.
 */
export function nextFree(taken) {
  const used = new Set(taken);
  for (let n = 1; ; n++) if (!used.has(n)) return n;
}

export function collisions(all) {
  const seen = new Map();
  for (const row of all) seen.set(row.number, [...(seen.get(row.number) ?? []), row]);
  return [...seen.entries()].filter(([, group]) => group.length > 1);
}

/** Where a number is cited, so a collision's blast radius is visible. */
function citations(number) {
  try {
    return execFileSync(
      "git",
      ["grep", "-l", "-E", `lessons\\.md #${number}\\b`, "--", "*.md", "*.ts", "*.tsx", "*.mjs"],
      { cwd: repo, encoding: "utf8", timeout: 30_000 },
    )
      .split("\n")
      .filter(Boolean);
  } catch {
    return []; // git grep exits 1 when nothing matches
  }
}

if (process.argv[1] && process.argv[1].endsWith("lessons.mjs")) {
  const argv = process.argv.slice(2);
  const all = rows();
  const free = nextFree(all.map((row) => row.number));
  const clashes = collisions(all);

  if (argv.includes("--next")) {
    console.log(free);
  } else if (argv.includes("--check")) {
    if (!clashes.length) console.log(`no collisions across ${all.length} lessons.`);
    for (const [number, group] of clashes) {
      console.log(`#${number} names ${group.length} lessons:`);
      for (const row of group) console.log(`    ${row.opening}`);
      const cited = citations(number);
      console.log(
        cited.length
          ? `  ambiguous in ${cited.length} file${cited.length === 1 ? "" : "s"}: ${cited.slice(0, 6).join(", ")}`
          : "  cited nowhere yet — renumber the newer row and nothing else moves",
      );
      console.log(`  the next free number is ${free}.`);
    }
    process.exit(clashes.length ? 1 : 0);
  } else {
    console.log(`${all.length} lessons, highest #${Math.max(...all.map((row) => row.number))}.`);
    console.log(`the next FREE number is ${free}${free <= Math.max(...all.map((r) => r.number)) ? " — a gap, not the end" : ""}.`);
    if (clashes.length) console.log(`${clashes.length} collision(s): node scripts/lessons.mjs --check`);
  }
}
