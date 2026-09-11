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
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repo = fileURLToPath(new URL("..", import.meta.url));
const argv = process.argv.slice(2);
const JSON_OUT = argv.includes("--json");
const CHECK = argv.includes("--check");

/**
 * **The members of `export type Operation`, and of nothing else in the file.**
 *
 * One `type` string per member, in declaration order — `null` for a member
 * with no string `type`, which the reducer could not dispatch and which is
 * therefore worth seeing rather than skipping.
 *
 * Read with TypeScript's own parser, because both text readings this replaced
 * were fooled by the same file. `op-types` counted every line shaped like
 * `  | {`, and on 9 Sep 2026 `c8213d70` reformatted `Placement` — a type an
 * operation *carries*, not an operation — into a multi-line union whose first
 * member opens with exactly that line. The vocabulary read 35 for two nights
 * while `Operation` held 33, and the architect filed "operations in the
 * vocabulary is 35, past 33" against a change that added no operation. The
 * other reading, `type: "x.y"` anywhere in `ops.ts`, would count a nested
 * object's `type` the same way. A reading of the declaration cannot confuse
 * the declaration with its neighbours, and a formatter cannot move it.
 *
 * Throws when there is no such declaration: a vocabulary of zero is a broken
 * instrument, and an instrument that reads healthy while broken is the one
 * shape `measure.mjs` exists to refuse.
 */
export function operationMembers(src) {
  const file = ts.createSourceFile("ops.ts", src, ts.ScriptTarget.Latest, true);
  const decl = file.statements.find(
    (s) => ts.isTypeAliasDeclaration(s) && s.name.text === "Operation",
  );
  if (!decl) throw new Error("no `type Operation` in the source — the vocabulary moved, and this reading did not");
  const members = ts.isUnionTypeNode(decl.type) ? decl.type.types : [decl.type];
  return members.map((member) => {
    if (!ts.isTypeLiteralNode(member)) return null;
    const tag = member.members.find(
      (m) => ts.isPropertySignature(m) && m.name && ts.isIdentifier(m.name) && m.name.text === "type",
    );
    const lit = tag?.type && ts.isLiteralTypeNode(tag.type) ? tag.type.literal : null;
    return lit && ts.isStringLiteral(lit) ? lit.text : null;
  });
}

/** The vocabulary, from the one place it is declared. */
export function operations(file = path.join(repo, "packages/core/src/ops.ts")) {
  return [...new Set(operationMembers(readFileSync(file, "utf8")).filter((t) => t !== null))].sort();
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

export function audit() {
  const ops = operations();
  const web = mentionedIn("packages/web/src");
  const cli = mentionedIn("packages/cli/src");
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
