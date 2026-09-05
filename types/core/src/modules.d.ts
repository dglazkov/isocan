import type { ContextPiece } from "./context.js";
import type { CanvasContents, Item } from "./model.js";
import type { Operation } from "./ops.js";
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
/** Idempotent by name, so a surface that registers twice (HMR, a test) holds one. */
export declare function registerModule(record: CoreModule): void;
export declare function unregisterModule(name: string): void;
export declare function modules(): CoreModule[];
export declare function moduleContextPieces(canvas: CanvasContents): ContextPiece[];
export declare function moduleEdges(canvas: CanvasContents): ModuleEdge[];
export declare function moduleKinds(): ModuleKind[];
/** The module kind that owns a mime, if a loaded module claims it. */
export declare function moduleKindOf(mime: string): ModuleKind | null;
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
    drag: {
        itemIds: readonly string[];
        dx: number;
        dy: number;
    } | null;
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
export declare const ISOCAN_VERSION = "0.1.0";
/** The name a module is addressed by on disk and in a URL: the package
 *  name's last segment — `@isocan/<name>` → `<name>`. */
export declare function moduleSlug(name: string): string;
/** Where the daemon serves a module's web half from: `/modules/<slug>/<web>`.
 *  Spelled once, here, for the daemon that serves it and the shell that asks. */
export declare function moduleWebPath(manifest: ModuleManifest): string | null;
/** The registry record a manifest declares — the code-free half of a module. */
export declare function manifestRecord(manifest: ModuleManifest): CoreModule;
/**
 * Does this isocan satisfy a module's `engines`? Three shapes, on purpose
 * no more: `*` (or nothing) is anything; `>=a.b.c` is at least; `^a.b.c` is
 * at least and the same major (same minor while the major is 0, as npm
 * reads it). A range this cannot read is a refusal that says so, because a
 * module that cannot state what it needs is not a module a home should run.
 */
export declare function enginesSatisfied(range: string | undefined, version?: string): {
    ok: true;
} | {
    ok: false;
    why: string;
};
