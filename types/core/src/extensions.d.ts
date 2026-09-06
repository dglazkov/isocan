import type { CanvasContents, Item } from "./model.js";
import { type SlashCommand } from "./commands.js";
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
export declare function readToolExtension(text: string, commands: SlashCommand[]): ToolRead;
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
export declare function toolCapabilities(tool: ToolExtension, commands: SlashCommand[]): string[];
/**
 * Every tool on this canvas, oldest first, so the rail does not reshuffle
 * itself when somebody edits one. The bytes are not read here — an item's
 * content is fetched by the caller, the way `designSystem` hands back an item
 * and lets the surface read it.
 */
export declare function toolExtensionItems(canvas: CanvasContents): Item[];
export {};
