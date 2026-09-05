import type { ContextPiece } from "./context.ts";
import type { CanvasContents, Item } from "./model.ts";
import type { Operation } from "./ops.ts";
import type { SlashCommand } from "./commands.ts";

/**
 * **The module registry** (`docs/projects/modules/design.md`).
 *
 * A module is a package that contributes to both surfaces at once and can be
 * removed leaving every item it made still readable as a file. This is the
 * part of it core sees: a record naming what the module contributes to the
 * facts core already computes — the rows of `isocan context`, the edges the
 * canvas draws and JSON Canvas exports, and (phase 2) the kinds.
 *
 * **Core imports no module.** The web shell and the CLI each hold a list and
 * register every entry's record at start; a surface that does not load a
 * module gets a core that has never heard of it. That is the only way
 * "removed" can mean removed, and it is why the functions below read a
 * registry instead of calling anything by name.
 */

export interface ModuleEdge {
  from: Item;
  to: Item;
}

/**
 * **A kind a module adds** (phase 2): a mime first, because the file is the
 * truth — `itemKind()` asks the registry before its own mime tests, and with
 * the module gone the same file falls through to whatever the built-ins call
 * it. Extensions are how `isocan add diagram.mmd` and a dropped file learn
 * the mime.
 */
export interface ModuleKind {
  id: string;
  mimes: readonly string[];
  /** Bare, lower-case: `mmd`, not `.mmd`. */
  extensions?: readonly string[];
  /** The plural a list groups under, and the singular a tooltip uses. */
  label: string;
  noun: string;
  /** Which of the built-in marks this kind borrows for its icon — the icon
   *  set is the app's, drawn for 11px, and a module names one rather than
   *  shipping pixels. Unset, the kind wears the plain file mark. */
  icon?: string;
}

export interface CoreModule {
  /** The package name — `@isocan/<name>` — which is also how an item made by
   *  a module that is not installed can be named from its mime alone. */
  name: string;
  /** The property keys it owns. Namespaced, and forever: keys replay, and a
   *  removed module's keys must read as orphaned rather than be reused. */
  propertyKeys?: readonly string[];
  contextPieces?: (canvas: CanvasContents) => ContextPiece[];
  edges?: (canvas: CanvasContents) => ModuleEdge[];
  kinds?: readonly ModuleKind[];
  /**
   * **Slash commands** (phase 4): instructions an agent carries out, merged
   * under the built-ins and the home's own — a third source, `module`, that
   * is there while the module is and gone when it is not. Text, like every
   * command; a module's agent tool is a command plus a verb.
   */
  commands?: readonly SlashCommand[];
}

/** Every loaded module's slash commands, in name order. */
export function moduleCommands(): SlashCommand[] {
  return modules()
    .flatMap((m) => (m.commands ?? []).map((c) => ({ ...c, source: "module" as const })))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * A command list with the loaded modules' commands laid UNDER it: a built-in
 * or a home command of the same name wins, so a module cannot shadow what the
 * product or the person wrote. Both surfaces call this on whatever list they
 * hold — the daemon's, or the compiled built-ins — because the daemon
 * registers no module and the list it serves cannot know them.
 */
export function withModuleCommands(commands: readonly SlashCommand[]): SlashCommand[] {
  const byName = new Map<string, SlashCommand>();
  for (const command of moduleCommands()) byName.set(command.name, command);
  for (const command of commands) byName.set(command.name, command);
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const REGISTRY = new Map<string, CoreModule>();

/** Idempotent by name, so a surface that registers twice (HMR, a test) holds one. */
export function registerModule(record: CoreModule): void {
  REGISTRY.set(record.name, record);
}

export function unregisterModule(name: string): void {
  REGISTRY.delete(name);
}

export function modules(): CoreModule[] {
  return [...REGISTRY.values()];
}

export function moduleContextPieces(canvas: CanvasContents): ContextPiece[] {
  return modules().flatMap((m) => m.contextPieces?.(canvas) ?? []);
}

export function moduleEdges(canvas: CanvasContents): ModuleEdge[] {
  return modules().flatMap((m) => m.edges?.(canvas) ?? []);
}

export function moduleKinds(): ModuleKind[] {
  return modules().flatMap((m) => m.kinds ?? []);
}

/** The module kind that owns a mime, if a loaded module claims it. */
export function moduleKindOf(mime: string): ModuleKind | null {
  return moduleKinds().find((k) => k.mimes.includes(mime)) ?? null;
}

/**
 * **What the web shell mounts** — the slots, as data. Generic over the
 * component type so this file stays free of React: the shell narrows `C` to
 * `ComponentType<UnderlayFacts>`, and a module's `web.tsx` types its export
 * the same way, so the two agree by construction without either importing
 * the other.
 */
export interface UnderlayFacts {
  canvas: CanvasContents;
  /** The live drag, so a line can ride the gesture before the replica moves. */
  drag: { itemIds: readonly string[]; dx: number; dy: number } | null;
}

/**
 * **A palette action a module adds**, as data over facts: the shell reads
 * its stores, hands the module the canvas and the selection, and SENDS the
 * ops the module returns — so a module never holds a store or a socket, and
 * an action that writes is an `items.move` or an `item.update` like any
 * other, echoed, undoable, and visible to the terminal as the same op.
 */
export interface ModuleActionFacts {
  canvas: CanvasContents;
  selection: readonly string[];
}

export interface ModuleAction {
  id: string;
  name: string;
  hint?: string;
  /** Offered only when this says so — a menu that lists what it cannot do lies. */
  available?: (facts: ModuleActionFacts) => boolean;
  /** The ops to send, in order; nothing means nothing to do. */
  run: (facts: ModuleActionFacts) => readonly Operation[] | void;
}

/**
 * **What a renderer is handed** (phase 2): the version's identity, the two
 * ways to reach its bytes, and whether the item is entered. The shell builds
 * `url` and `readText` from its own blob client; a module never spells a
 * blob path.
 */
export interface RendererFacts {
  canvasId: string;
  blobHash: string;
  mimeType: string;
  filename: string;
  entered: boolean;
  url: string;
  readText: () => Promise<string>;
}

export interface ModuleRenderer<R> {
  /** The mimes this draws — the same list the module's kind claims. */
  mimes: readonly string[];
  component: R;
}

/**
 * **What an inspector is handed** (phase 4): the open item, and its bytes on
 * request. The workbench mounts a module's inspector beside the stage when
 * the item's kind is one the inspector names — the slot the extensions
 * design called for and nothing had asked for until documents did.
 */
export interface InspectorFacts {
  canvasId: string;
  item: Item;
  readText: () => Promise<string>;
}

export interface ModuleInspector<I> {
  /** The kinds it inspects — built-in ids or a module's. */
  kinds: readonly string[];
  label: string;
  component: I;
}

/**
 * **What a page is handed** (phase 4): the canvas, whole. A page is a cover
 * route of its own — `x/<segment>` under the canvas's path — the same kind of thing the
 * workbench and the deck view are: an address either surface can hand you,
 * mounted inside the canvas page so the replica underneath stays open.
 */
export interface PageFacts {
  canvasId: string;
  canvas: CanvasContents;
}

export interface ModulePage<P> {
  /** The path segment: lowercase letters, digits, dashes. */
  segment: string;
  label: string;
  hint?: string;
  component: P;
}

export interface WebModule<C, R = never, I = never, P = never> {
  core: CoreModule;
  /** Drawn inside `.world`, under the items, in world units. */
  underlays?: readonly C[];
  /** Entries in the ⌘K palette's Canvas group. Every one of them writes. */
  actions?: readonly ModuleAction[];
  /** How a version of one of this module's kinds is drawn on the card and
   *  the stage — ahead of the built-in chain, lazily loaded by the module. */
  renderers?: readonly ModuleRenderer<R>[];
  /** Beside the workbench's stage, for items of the kinds it names. */
  inspectors?: readonly ModuleInspector<I>[];
  /** Whole sections of the app, each a cover route with an address. */
  pages?: readonly ModulePage<P>[];
}

/**
 * **A runtime module's manifest** (phase 3): what `isocan module add` prints
 * before `--yes`, what the daemon lists on `/api/serving`, and what the CLI
 * reads before it imports any code. Written by `scripts/module-build.mjs`
 * from the package and its core record, so the declaration and the code come
 * from one place; the registry is filled from the manifest, so a module's
 * kinds are known to both surfaces without executing its web half at all.
 *
 * Paths are relative to the module's directory: `~/.isocan/modules/<name>/`.
 */
export interface ModuleManifest {
  name: string;
  version: string;
  description?: string;
  /** The isocan version range this was built against — refused with a
   *  sentence, never crashed on. `>=0.1.0`, `^0.1`, or `*`. */
  engines?: string;
  kinds?: readonly ModuleKind[];
  propertyKeys?: readonly string[];
  /** The web half, an ES module the daemon serves under `/modules/<name>/`. */
  web?: string;
  /** The CLI half, an ES module the CLI imports before it parses argv. */
  cli?: string;
  /** The guide section, printed after the base guide while loaded. */
  guide?: string;
}

/** The version a module's `engines` is judged against. One place; the
 *  packaging test holds it equal to the root manifest's. */
export const ISOCAN_VERSION = "0.1.0";

/** The name a module is addressed by on disk and in a URL: the package
 *  name's last segment — `@isocan/<name>` → `<name>`. */
export function moduleSlug(name: string): string {
  return name.split("/").pop() ?? name;
}

/** Where the daemon serves a module's web half from: `/modules/<slug>/<web>`.
 *  Spelled once, here, for the daemon that serves it and the shell that asks. */
export function moduleWebPath(manifest: ModuleManifest): string | null {
  return manifest.web ? `/modules/${moduleSlug(manifest.name)}/${manifest.web}` : null;
}

/** The registry record a manifest declares — the code-free half of a module. */
export function manifestRecord(manifest: ModuleManifest): CoreModule {
  return {
    name: manifest.name,
    ...(manifest.kinds ? { kinds: manifest.kinds } : {}),
    ...(manifest.propertyKeys ? { propertyKeys: manifest.propertyKeys } : {}),
  };
}

function parseVersion(v: string): [number, number, number] | null {
  const m = /^v?(\d+)\.(\d+)(?:\.(\d+))?/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null;
}

function compare(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return 0;
}

/**
 * Does this isocan satisfy a module's `engines`? Three shapes, on purpose
 * no more: `*` (or nothing) is anything; `>=a.b.c` is at least; `^a.b.c` is
 * at least and the same major (same minor while the major is 0, as npm
 * reads it). A range this cannot read is a refusal that says so, because a
 * module that cannot state what it needs is not a module a home should run.
 */
export function enginesSatisfied(range: string | undefined, version: string = ISOCAN_VERSION): { ok: true } | { ok: false; why: string } {
  const have = parseVersion(version);
  if (!have) return { ok: false, why: `this isocan's version "${version}" cannot be read` };
  const r = (range ?? "*").trim();
  if (r === "*" || r === "") return { ok: true };
  const m = /^(>=|\^)?\s*(.+)$/.exec(r);
  const want = m ? parseVersion(m[2]!) : null;
  if (!m || !want) return { ok: false, why: `cannot read the engines range "${r}" — use >=a.b.c, ^a.b.c or *` };
  const op = m[1] ?? "^";
  if (compare(have, want) < 0) return { ok: false, why: `needs isocan ${r}, and this is ${version}` };
  if (op === "^") {
    const sameLine = want[0] === 0 ? have[0] === 0 && have[1] === want[1] : have[0] === want[0];
    if (!sameLine) return { ok: false, why: `needs isocan ${r}, and this is ${version}` };
  }
  return { ok: true };
}
