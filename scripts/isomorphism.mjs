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
 * anywhere in that surface's own source, when a runtime API declaration it
 * references constructs it, and separately when `invert.ts` produces it.
 * Shared API exports are not capabilities until a surface uses them: importing
 * a barrel or one CanvasHandle method must not count every other method.
 * **The bias is deliberate**: over-counting reachability reports
 * a gap that is not there, which is the failure that wastes a day
 * (`docs/reviews/lessons.md` — a reading that cannot see half the schedule
 * invents drift). Under-counting is caught by the eye; inventing is not.
 */
import { readFileSync, readdirSync, existsSync, realpathSync } from "node:fs";
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

/** The API operation producers each surface actually references, through named
 * imports, re-exports and instance methods. The checker resolves symbols rather
 * than treating an API barrel as its entire runtime surface. Only referenced
 * API declaration bodies are followed; type nodes and core/server declarations
 * never count. An operation comparison in a shared receipt reader is not a
 * producer, so only object-literal `type` assignments contribute operations. */
export function sharedApiOperations(entries, ops, apiDir = path.join(repo, "packages/api/src")) {
  const program = ts.createProgram(Object.values(entries).flat(), {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowImportingTsExtensions: true,
    allowJs: true,
    jsx: ts.JsxEmit.Preserve,
    noEmit: true,
    skipLibCheck: true,
    types: [],
  });
  const checker = program.getTypeChecker();
  const vocabulary = new Set(ops);
  const apiRoot = realpathSync(apiDir) + path.sep;
  const apiSources = new Map();
  const isApiSource = (file) => {
    if (!apiSources.has(file)) apiSources.set(file, realpathSync(file.fileName).startsWith(apiRoot));
    return apiSources.get(file);
  };
  const result = {};
  for (const [surface, files] of Object.entries(entries)) {
    const found = new Set(), visited = new Set();
    const visitDeclaration = (declaration) => {
      if (visited.has(declaration) || !isApiSource(declaration.getSourceFile())) return;
      // A namespace import resolves to a SourceFile. Its exports are not all
      // used merely because the namespace exists; property uses resolve below.
      if (ts.isSourceFile(declaration)) return;
      visited.add(declaration);
      if (ts.isClassDeclaration(declaration) || ts.isClassExpression(declaration)) {
        // Referencing/constructing a class does not call every method. Each
        // method is reached through the runtime property reference to it.
        for (const member of declaration.members) {
          if (ts.isConstructorDeclaration(member) || ts.isClassStaticBlockDeclaration(member)) visit(member, true);
          else if (ts.isPropertyDeclaration(member) && member.initializer) visit(member.initializer, true);
        }
      } else visit(declaration, true);
    };
    const visit = (node, inApi) => {
      if (ts.isTypeNode(node) || ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node) ||
          ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node) || ts.isExportDeclaration(node)) return;
      if (inApi && ts.isPropertyAssignment(node) &&
          (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) && node.name.text === "type" &&
          ts.isStringLiteral(node.initializer) && vocabulary.has(node.initializer.text)) found.add(node.initializer.text);
      if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        let symbol = checker.getSymbolAtLocation(node);
        if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
        for (const declaration of symbol?.declarations ?? []) visitDeclaration(declaration);
      }
      ts.forEachChild(node, (child) => visit(child, inApi));
    };
    for (const file of files) {
      const source = program.getSourceFile(file);
      if (!source) throw new Error(`surface source not loaded: ${file}`);
      visit(source, false);
    }
    result[surface] = found;
  }
  return result;
}

/** Surface-owned source remains the audit's entrance, including lazy UI files. */
function surfaceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? surfaceFiles(full) : /\.(ts|tsx|mjs)$/.test(entry.name) ? [full] : [];
  });
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
  const shared = sharedApiOperations({
    web: surfaceFiles(path.join(repo, "packages/web/src")),
    cli: surfaceFiles(path.join(repo, "packages/cli/src")),
  }, ops);
  const web = new Set([...mentionedIn("packages/web/src"), ...moduleOperations("web"), ...shared.web]);
  const cli = new Set([...mentionedIn("packages/cli/src"), ...moduleOperations("cli"), ...shared.cli]);
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
