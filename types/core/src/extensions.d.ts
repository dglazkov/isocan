import type { CanvasContents, Item } from "./model.js";
import { type CommandMetadata } from "./commands.js";
export declare const TOOL_ROLE = "tool";
/** The properties that make an item this canvas's tool. */
export declare function toolProperties(): Record<string, string>;
export declare function isToolExtension(item: Item): boolean;
/**
 * **The icons a tool may wear, and there is no other option.**
 *
 * Not arbitrary SVG, and this is a security decision rather than a style one:
 * an icon is a place somebody would otherwise paint anything at all, including
 * a convincing copy of a control that already exists. A closed set means a
 * tool cannot draw a padlock, a spinner, or the app's own Add button.
 *
 * Grows on evidence, like every other list in this design — a name is added
 * when a real tool wants it.
 */
export declare const EXTENSION_ICONS: readonly ["broom", "wand", "check", "star", "tag", "list", "eye", "bolt", "clock", "flag", "link", "note"];
export type ExtensionIcon = (typeof EXTENSION_ICONS)[number];
export interface ToolExtension {
    kind: "tool";
    /** What the button says. Short, because it sits in a rail. */
    label: string;
    icon: ExtensionIcon;
    /** The ask, verbatim: a slash command that exists, with optional arguments —
     * `/format`, or `/format tighten the rows`. */
    does: string;
}
/** The longest a rail button's words may be. A label is not a paragraph, and
 * a rail is not a place to put one. */
export declare const LABEL_LIMIT = 24;
/**
 * What a manifest turned out to be: a tool, or the sentence explaining why not.
 *
 * A refusal is prose rather than a code because it is shown to whoever wrote
 * the file, and "invalid manifest" tells them nothing about which line to fix.
 */
type ToolRead = {
    tool: ToolExtension;
    problem?: undefined;
} | {
    tool?: undefined;
    problem: string;
};
/**
 * **Read a tool manifest, or say why it is not one.**
 *
 * `commands` is the live registry — built-ins, this home's, and any a loaded
 * module carries — because `does` naming a command that does not exist is the
 * failure a person actually makes, and the refusal should say so at the moment
 * the file is read rather than when the button is pressed.
 */
export declare function readToolExtension(text: string, commands: readonly CommandMetadata[]): ToolRead;
/**
 * **What this tool can do, in words, before you keep it** — stage 2.
 *
 * The design puts the capability list before the tier that needs it, on
 * purpose: *the habit has to exist before the tier that depends on it.* A
 * tier-1 tool needs almost none, and that is exactly why it is the right place
 * to establish that installing an extension means reading what it may do —
 * `command add --from` already prints a command's whole body and installs
 * nothing until `--yes`, because a command's body is instructions to every
 * future agent. An extension is code with a seat at the table and gets at
 * least the same ceremony.
 *
 * Derived, never declared. A manifest that stated its own capabilities would
 * be a manifest that could understate them.
 */
export declare function toolCapabilities(tool: ToolExtension, commands: readonly CommandMetadata[]): string[];
/**
 * Every tool on this canvas, oldest first, so the rail does not reshuffle
 * itself when somebody edits one. The bytes are not read here — an item's
 * content is fetched by the caller, the way `designSystem` hands back an item
 * and lets the surface read it.
 */
export declare function toolExtensionItems(canvas: CanvasContents): Item[];
/**
 * **A declarative panel manifest** — phase 3 of
 * `docs/projects/extensions/phases.md`, which is the design's stage 5 (hosted
 * panels) cut into the three acts it turned out to be: the manifest and its
 * reader here, the frame after it, the narrow door last.
 *
 * `role=panel` makes an item a panel the same way `role=tool` makes one a
 * tool, so everything the block at the top of this file says about a tool
 * being an ORDINARY ITEM is true of a panel without another line of work: it
 * versions, undoes per actor, takes comments, trashes and restores, arrives
 * with the canvas, and is removed with `rm` rather than a verb of its own.
 *
 * **Nothing renders here, and that is what makes this phase worth having on
 * its own.** A manifest is readable, refusable and removable before there is
 * a frame to argue about — and a refusal that arrives when the file is read
 * beats one that arrives when the panel is already on screen, which is the
 * same argument `readToolExtension` makes about `does`.
 */
export declare const PANEL_ROLE = "panel";
/** The properties that make an item this canvas's panel. */
export declare function panelProperties(): Record<string, string>;
/** Whether an item is one — one property, read the same way a design system
 * is read, so nothing has to learn a new kind. */
export declare function isPanelExtension(item: Item): boolean;
/**
 * **Where a panel may sit, and there is no other option.**
 *
 * One entry today because the app has one dock — `packages/web/src/lib/panels.ts`
 * holds the left one, which shows a single panel at a time, and the right
 * edge is the tool rail's. A closed set for the same reason `EXTENSION_ICONS`
 * is one: the app draws the slot, so a panel can only name a slot that
 * exists. It grows when a second real one does, never because a manifest
 * might want it — and a set with one member is an honest statement of what
 * there is rather than a field pretending to offer a choice.
 */
export declare const PANEL_SIDES: readonly ["left"];
/** One of the slots above, so a panel's side is a place and not a string. */
export type PanelSide = (typeof PANEL_SIDES)[number];
/** The longest a panel's name may be. It is a dock header, not a sentence. */
export declare const TITLE_LIMIT = 32;
/**
 * **Where a panel's bytes actually are**, resolved when the manifest is read
 * rather than taken from it.
 *
 * `src` names an ITEM on this canvas and this is what that item turned out to
 * be, so the frame phase 4 builds has a blob hash to put after the content
 * base and never a URL the manifest chose. Resolving through the item rather
 * than storing a hash in the manifest is what gives a panel its history for
 * free: editing the page is a new version of that item, the panel shows it,
 * and a bad one rolls back with `S` — which would be untrue of a manifest
 * that pinned a hash.
 */
export interface PanelBytes {
    itemId: string;
    blobHash: string;
    filename: string;
    mimeType: string;
}
/** A manifest that read, plus what its `src` turned out to be — everything a
 * surface needs in order to draw the thing, and nothing it has to trust. */
export interface PanelExtension {
    kind: "panel";
    /** What the dock header says, and what the panel is called everywhere else.
     * It wears its own name the way a cursor does — see the reserved list. */
    title: string;
    side: PanelSide;
    /** Verbatim from the manifest: the title of an item on THIS canvas. */
    src: string;
    /** What `src` resolved to. Derived, never declared. */
    bytes: PanelBytes;
}
/**
 * What a manifest turned out to be: a panel, or the sentence explaining why
 * not — prose naming the field, for `readToolExtension`'s reason. It is shown
 * to whoever wrote the file, and "invalid manifest" tells them nothing about
 * which line to fix.
 */
type PanelRead = {
    panel: PanelExtension;
    problem?: undefined;
} | {
    panel?: undefined;
    problem: string;
};
/**
 * **Read a panel manifest, or say why it is not one.**
 *
 * `canvas` is the second argument for the same reason `commands` is
 * `readToolExtension`'s: it is what the rule needs in order to be enforced
 * where it is stated. `src` must name a blob **on this canvas** — *no reading
 * past the canvas it is on* — and the only thing that can answer whether it
 * does is the canvas itself. A reader that took a string and trusted it would
 * be a reader that let a panel fetch its page from anywhere.
 */
export declare function readPanelExtension(text: string, canvas: CanvasContents): PanelRead;
/**
 * **What this panel can do, in words, before you keep it** — the ceremony
 * stage 2 established at the tier that barely needed it, now at the tier it
 * was built for. `panel add` prints this and adds nothing until `--yes`.
 *
 * Derived, never declared, for the reason `toolCapabilities` gives: a
 * manifest that stated its own capabilities would be a manifest that could
 * understate them.
 *
 * **And it is honest about the phase it is in.** A panel cannot act at all
 * today — there is no frame (phase 4) and no door (phase 6) — so the list
 * says what it WILL be able to do once it renders and that it cannot yet,
 * rather than inventing powers nothing has built. The one thing it can
 * genuinely do from the day it is added is CHANGE: its bytes are another
 * item's current version, so whoever may edit that item decides what this
 * panel shows without touching this manifest. That is a capability and it is
 * named as one.
 */
export declare function panelCapabilities(panel: PanelExtension): string[];
/**
 * Every panel on this canvas, oldest first, so the dock does not reshuffle
 * itself when somebody edits one. The bytes are not read here — an item's
 * content is fetched by the caller, exactly as `toolExtensionItems` leaves it.
 */
export declare function panelExtensionItems(canvas: CanvasContents): Item[];
export {};
