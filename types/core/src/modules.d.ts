import type { ContextPiece } from "./context.js";
import type { CanvasContents, Item } from "./model.js";
import type { Operation } from "./ops.js";
import type { SlashCommand } from "./commands.js";
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
export declare function moduleCommands(): SlashCommand[];
/**
 * A command list with the loaded modules' commands laid UNDER it: a built-in
 * or a home command of the same name wins, so a module cannot shadow what the
 * product or the person wrote. Both surfaces call this on whatever list they
 * hold — the daemon's, or the compiled built-ins — because the daemon
 * registers no module and the list it serves cannot know them.
 */
export declare function withModuleCommands(commands: readonly SlashCommand[]): SlashCommand[];
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
 * **What a module's components are handed to CHANGE anything** (9 Sep 2026).
 *
 * The web twin of `CliHost`, and it exists for the same reason that one does.
 * Until now `ModuleAction.run` returning `readonly Operation[]` was the only
 * place in this whole file that produced an operation: underlays, renderers,
 * inspectors and pages were read-only by construction, and four of those five
 * are components a person interacts with. The one that could write was a
 * palette entry with no UI of its own.
 *
 * That was invisible while the modules were a mind map, a Mermaid renderer and
 * a documents inspector, none of which changes anything from inside a
 * component. It stopped being invisible the moment somebody built a tray you
 * drag things out of (#156, romannurik's stickers), because dragging a sticker
 * onto the canvas IS a write made from a panel.
 *
 * It also contradicted a rule the design already states — *"a hidden store:
 * module state is an item, visible and versioned"* — since most of the places
 * a module could put UI could not write an item.
 *
 * ## Two members, and why not more
 *
 * `send` is the same door `ModuleAction.run` returns into, so a write from a
 * component is an `item.add` or an `item.update` like any other: echoed,
 * undoable, groupable, and visible to the terminal as the same op. No new
 * authority — the palette could already send these.
 *
 * `putBlob` is the one thing an operation cannot say. `item.add` and
 * `item.addVersion` both name a `blobHash`, and a blob is minted through a
 * channel that is not an op — so a module could express every canvas change
 * EXCEPT the ones that need new content, which is what a node-type module
 * spends its life doing.
 *
 * ## Deliberately not `dropFile(file, placement)`
 *
 * The exploration that found this asked for exactly that, and for an
 * `addVersion` beside it. Both bundle decisions that belong to the module:
 * mint the bytes, choose the placement, send the op. A module given `dropFile`
 * cannot set its own title, size or properties, cannot group two writes into
 * one undo, and needs a second helper the day it wants a version instead of an
 * item — which is how a per-slot helper list starts. `putBlob` plus ops
 * composes, and it is one member instead of a growing family.
 *
 * ## Who gets it
 *
 * The slots a person interacts with: overlays, inspectors and pages.
 * Underlays and renderers DRAW, and nothing has needed to write from one yet
 * — so they do not get it, and the day a module needs that it is a review
 * question rather than a private import, which is the rule `CliHost` already
 * carries and the reason this interface exists at all.
 */
export interface WebHost {
    /** Sent as the viewer, through the door the palette already uses. One
     *  `group` for one undo, exactly as a multi-op action groups today. */
    send: (ops: readonly Operation[], group?: string) => Promise<void>;
    /** Bytes in, a hash out — the half no operation carries. What a module does
     *  with the hash is an `item.add` or an `item.addVersion` of its own. */
    putBlob: (bytes: Blob, filename: string) => Promise<{
        blobHash: string;
        size: number;
    }>;
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
    /** Changing the thing you are inspecting is the point of inspecting it.
     *  An `item.addVersion` naming a hash from `host.putBlob` is how. */
    host: WebHost;
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
    host: WebHost;
}
export interface ModulePage<P> {
    /** The path segment: lowercase letters, digits, dashes. */
    segment: string;
    label: string;
    hint?: string;
    component: P;
}
/**
 * **What an overlay is handed**: the canvas, and the way to change it.
 *
 * An overlay is screen-space chrome above the viewport — a tray, a dock, a
 * palette of things to drag out. The sixth slot, and the one the design
 * anticipated when it said *"panel, page, inspector, tool: each lands when a
 * module asks"*.
 *
 * **It is also the one with real risk, and the region is why.** `underlays`
 * is safe because it is beneath everything in world space, where a module can
 * only draw under the work. An overlay is the app's own chrome space, and N
 * modules mounting floating panels wherever they like is how a shell turns
 * into a mess — the failure the rail's and the dock's fixed lists exist to
 * prevent. So an overlay names a REGION rather than positioning itself, the
 * shell owns where that region is, and two modules in one region stack in
 * module order instead of overlapping.
 */
export type OverlayRegion = "left" | "right";
/** What an overlay draws with: the canvas, and the way to change it. */
export interface OverlayFacts {
    canvasId: string;
    canvas: CanvasContents;
    host: WebHost;
}
/**
 * **A drag a module claims** (#156).
 *
 * The canvas's drop handler read `dataTransfer.files` and `text/uri-list`,
 * both spelled into the handler, so a module could put a tray on the screen
 * and had no way to catch what you dragged out of it.
 *
 * The shape is the one the module system already uses rather than a second
 * one: a module claims MIMES for its kinds, and a drag carries mimes, so a
 * module claims the drag mimes it accepts and is handed the data. What it
 * returns is ops, like everything else — and with `host.putBlob` it can mint
 * the content those ops name.
 *
 * Native OS file drops are not offered here. They are the shell's, they have
 * a hundred handlers' worth of behaviour behind them (versions onto an item,
 * a row laid out rather than a stack, the notice when one fails), and a
 * module intercepting them would be taking over the app's own gesture rather
 * than adding one of its own.
 */
export interface DropFacts {
    /** Captured explicit destination; async module work must not reread changing UI scope. */
    containerId?: string | null;
    canvasId: string;
    /** The dragged payload, by the mime this drop matched. */
    data: string;
    mimeType: string;
    /** Where it landed, in world units. */
    at: {
        x: number;
        y: number;
    };
    host: WebHost;
}
/** One claim on a dragged mime, and what to do with what arrives. */
export interface ModuleDrop {
    /** The `dataTransfer` types this claims. First match wins, module order. */
    mimes: readonly string[];
    /** Returns the ops to send, or nothing when it decides this is not for it
     *  after all — a claim on a mime is not a promise to handle every payload
     *  carried under it. */
    run: (facts: DropFacts) => Promise<readonly Operation[] | void>;
}
/** A tray or dock a module hangs against one edge of the canvas. Not
 *  exported: a module names its overlays through `WebModule`, the way it
 *  names its renderers, and nothing outside core has needed the type itself. */
interface ModuleOverlay<O> {
    /** Which edge it sits against. The shell decides where that is. */
    region: OverlayRegion;
    /** For the chrome registry, so a person can turn it off like any other
     *  floating thing — an overlay nobody chose is chrome nobody chose. */
    label: string;
    component: O;
}
export interface WebModule<C, R = never, I = never, P = never, O = never> {
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
    /** Screen-space chrome above the viewport, against a named edge. */
    overlays?: readonly ModuleOverlay<O>[];
    /** Drags this module catches on the canvas, by mime. */
    drops?: readonly ModuleDrop[];
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
    /**
     * The unstable parts of the API this module uses (`PROPOSED`). A module
     * naming any is refused unless the person adding it says yes — the same
     * bargain VS Code's proposed API makes, and the reason we can keep changing
     * these slots without breaking somebody who never asked for them.
     */
    proposed?: readonly string[];
}
/**
 * **The module API's own version, which is not the app's** (9 Sep 2026).
 *
 * It was `ISOCAN_VERSION`, pinned by a test to the root package's version,
 * which is 0.1.0 and has never moved. So the engines check — real, enforced on
 * `module add`, refused with a sentence by the daemon — could never refuse
 * anything, because the number it compares against was a constant. A bound
 * that exists and does not bind, which is this repo's oldest shape.
 *
 * **Decoupled because ours will break and VS Code's does not.** VS Code can
 * judge `engines.vscode` against the app version because their stable API has
 * essentially never broken since 1.0: every app release is compatible, so the
 * app version is a safe proxy for the API version. isocan's module API is
 * pre-1.0 and changing weekly. Tying it to the app would mean either bumping
 * the app for an API change nobody outside a module can see, or never bumping
 * at all — which is what happened.
 *
 * So this moves when the module API moves, and only then.
 *
 * **0.1.0 → 0.2.0 on 9 Sep 2026**, and it is a break rather than an addition:
 * `InspectorFacts` and `PageFacts` gained a required `host`, so a module built
 * against 0.1 no longer compiles. Under semver's pre-1.0 rule a minor bump is
 * exactly how you say that, and `^0.1.0` is refused by the check below — which
 * is the first time it has ever refused anything.
 */
export declare const MODULE_API_VERSION = "0.2.0";
/**
 * **The parts of the API we intend to change**, named so a module can say it
 * is using one and a home can say yes before it runs.
 *
 * VS Code's proposed API in the shape this codebase can afford: an extension
 * names the proposals it uses, only runs where somebody enabled them, and
 * cannot be published to the marketplace at all. Fast on one side of the line,
 * frozen on the other, and the line is a list a person opts into.
 *
 * Everything here landed on 9 Sep for one module's sake and has had exactly
 * one caller. That is not stability, and calling it stable because it shipped
 * is how an API gets frozen by accident.
 */
export declare const PROPOSED: readonly ["overlays", "drops", "host"];
/** Which of a manifest's proposals this build does not recognise. A module
 *  asking for something that no longer exists is a refusal with a name, not a
 *  module that quietly loads without the thing it needed. */
export declare function unknownProposals(wanted: readonly string[] | undefined): string[];
/** The name a module is addressed by on disk and in a URL: the package
 *  name's last segment — `@isocan/<name>` → `<name>`. */
export declare function moduleSlug(name: string): string;
/** Where the daemon serves a module's web half from: `/modules/<slug>/<web>`.
 *  Spelled once, here, for the daemon that serves it and the shell that asks. */
export declare function moduleWebPath(manifest: ModuleManifest): string | null;
/** The registry record a manifest declares — the code-free half of a module. */
export declare function manifestRecord(manifest: ModuleManifest): CoreModule;
/**
 * Does this build's MODULE API satisfy a module's `engines`? Three shapes, on purpose
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
export {};
