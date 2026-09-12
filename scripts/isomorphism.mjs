#!/usr/bin/env node
/**
 * **Can an agent do everything a person can?**
 *
 *   node scripts/isomorphism.mjs           # the audit
 *   node scripts/isomorphism.mjs --json
 *   node scripts/isomorphism.mjs --check   # fail on a web-only operation
 *
 * The product's central claim, checked rather than believed: *every shared
 * fact is an Operation either surface can send.* A canvas the web app can
 * change in a way the CLI cannot is a canvas an agent is a second-class
 * citizen on — and it would be invisible, because both surfaces would keep
 * working perfectly on their own.
 *
 * ## What "can send" means here, and what it cost to get right
 *
 * The first version looked for the literal `type: "<op>"` at a send site and
 * reported three operations as CLI-only and five as sent by nobody. **Six of
 * those eight were wrong**, in the two ways this kind of reading goes wrong:
 *
 * - **Sent through a helper.** The web enrols an agent through
 *   `lib/api.ts`, so `agent.enroll` never appears beside a `type:` in a
 *   component. Grepping for the send site missed it.
 * - **Produced by INVERSION.** `comment.restore`, `thread.restore` and
 *   `item.restoreVersion` are written by nobody and sent constantly: they are
 *   what `core/invert.ts` returns when you undo a removal. Undo exists on both
 *   surfaces, so they are reachable from both — and calling them dead
 *   vocabulary would have argued for deleting three operations that run every
 *   time somebody presses ⌘Z.
 *
 * So an operation counts as reachable from a surface when its name appears
 * anywhere in that surface's own source, and separately when `invert.ts`
 * produces it. **The bias is deliberate**: over-counting reachability reports
 * a gap that is not there, which is the failure that wastes a day
 * (`docs/reviews/lessons.md` — a reading that cannot see half the schedule
 * invents drift). Under-counting is caught by the eye; inventing is not.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const argv = process.argv.slice(2);
const JSON_OUT = argv.includes("--json");
const CHECK = argv.includes("--check");

/** The vocabulary, from the one place it is declared. */
export function operations(file = path.join(repo, "packages/core/src/ops.ts")) {
  const src = readFileSync(file, "utf8");
  return [...new Set([...src.matchAll(/type:\s*"([a-z]+\.[a-zA-Z]+)"/g)].map((m) => m[1]))].sort();
}

/** Every operation name mentioned anywhere under a surface's own source. */
export function mentionedIn(dir) {
  const found = new Set();
  const ops = operations();
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|mjs)$/.test(entry.name)) {
        const src = readFileSync(full, "utf8");
        for (const op of ops) if (src.includes(`"${op}"`)) found.add(op);
      }
    }
  };
  walk(path.join(repo, dir));
  return found;
}

/** Operations `core/invert.ts` RETURNS — reachable from anywhere undo is. */
export function producedByUndo(file = path.join(repo, "packages/core/src/invert.ts")) {
  const src = readFileSync(file, "utf8");
  return new Set([...src.matchAll(/return\s*\{\s*type:\s*"([a-z]+\.[a-zA-Z]+)"/g)].map((m) => m[1]));
}

/** Follow each installed module's surface entry into shared operation helpers.
 * Looking only in the shell mistook Anatomy’s guarded edit for dead vocabulary. */
function moduleOperations(surface) {
  const found = new Set(), visited = new Set(), ops = operations();
  const visit = (file) => {
    if (visited.has(file) || !existsSync(file)) return;
    visited.add(file);
    const source = readFileSync(file, "utf8");
    for (const op of ops) if (source.includes(`"${op}"`)) found.add(op);
    // Static imports/exports and lazy import() both make a helper reachable.
    for (const match of source.matchAll(/(?:from\s*|import\s*\(\s*)["'](\.[^"']+)["']/g)) {
      visit(path.resolve(path.dirname(file), match[1]));
    }
  };
  for (const module of readdirSync(path.join(repo, "packages/modules"))) {
    const root = path.join(repo, "packages/modules", module);
    const manifest = path.join(root, "package.json");
    if (!existsSync(manifest)) continue;
    const entry = JSON.parse(readFileSync(manifest, "utf8")).exports?.[`./${surface}`];
    if (typeof entry === "string") visit(path.resolve(root, entry));
  }
  return found;
}

/** Both shells and their module entry points are clients of the operation vocabulary. */
export function audit() {
  const ops = operations();
  const web = new Set([...mentionedIn("packages/web/src"), ...moduleOperations("web")]);
  const cli = new Set([...mentionedIn("packages/cli/src"), ...moduleOperations("cli")]);
  const undo = producedByUndo();
  return ops.map((op) => ({
    op,
    web: web.has(op),
    cli: cli.has(op),
    undo: undo.has(op),
    // The one that matters: a person can, and an agent cannot.
    webOnly: web.has(op) && !cli.has(op) && !undo.has(op),
    unreachable: !web.has(op) && !cli.has(op) && !undo.has(op),
  }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = audit();
  const webOnly = rows.filter((r) => r.webOnly);
  const unreachable = rows.filter((r) => r.unreachable);
  const cliOnly = rows.filter((r) => r.cli && !r.web && !r.undo);
  if (JSON_OUT) {
    console.log(JSON.stringify({ count: rows.length, rows, webOnly, cliOnly, unreachable }, null, 2));
  } else {
    console.log(`${rows.length} operations.\n`);
    const mark = (b) => (b ? "yes" : " — ");
    console.log("operation                web   cli   undo");
    for (const r of rows) {
      console.log(`${r.op.padEnd(24)} ${mark(r.web)}   ${mark(r.cli)}   ${mark(r.undo)}`);
    }
    console.log(
      `\n**A person can, an agent cannot: ${webOnly.length}**` +
        (webOnly.length ? `\n  ${webOnly.map((r) => r.op).join("\n  ")}` : " — the claim holds."),
    );
    if (cliOnly.length) console.log(`\nAn agent can, a person cannot: ${cliOnly.length}\n  ${cliOnly.map((r) => r.op).join("\n  ")}`);
    if (unreachable.length) console.log(`\nReachable from neither surface: ${unreachable.length}\n  ${unreachable.map((r) => r.op).join("\n  ")}`);
  }
  if (CHECK && webOnly.length > 0) process.exit(1);
}
