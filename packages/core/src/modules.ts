import type { ContextPiece } from "./context.ts";
import type { CanvasContents, Item } from "./model.ts";
import type { Operation } from "./ops.ts";

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

export interface WebModule<C, R = C> {
  core: CoreModule;
  /** Drawn inside `.world`, under the items, in world units. */
  underlays?: readonly C[];
  /** Entries in the ⌘K palette's Canvas group. Every one of them writes. */
  actions?: readonly ModuleAction[];
  /** How a version of one of this module's kinds is drawn on the card and
   *  the stage — ahead of the built-in chain, lazily loaded by the module. */
  renderers?: readonly ModuleRenderer<R>[];
}
