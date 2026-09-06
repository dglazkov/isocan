import type { CanvasContents, Item } from "./model.ts";
import { COMMAND_NAME, findCommand, parseSlashCommand, type SlashCommand } from "./commands.ts";

/**
 * **Extending the canvas from inside it** — stage 1 of
 * `docs/projects/extensions/design.md`, and the whole thing turns on one
 * sentence that this file is an application of:
 *
 * > **An extension may only ask for what a person could ask for.**
 *
 * Not "an extension runs in a sandbox". Sandboxes are a mitigation; this is a
 * model. Every mutation here is an `Operation` applied by one reducer and
 * attributed to an actor, so an extension whose requests go through the same
 * door as everybody else's can, at worst, do what a collaborator could do —
 * which is a thing this system already knows how to see, attribute, undo and
 * revoke.
 *
 * **Stage 1 is a declarative tool: a button that does a thing there is
 * already a name for.** No code at all, and `does` is limited to a slash
 * command that exists. The app renders it with its own component, its own
 * tokens and its own focus ring, from a **named icon set** — so a tool cannot
 * be off-brand, cannot be inaccessible, and cannot do anything the vocabulary
 * does not permit. Safe by construction rather than by containment, which is
 * a different and better kind of safe.
 *
 * ## An extension is an item, and that is not a saving of effort
 *
 * `role=design-system` already makes an item mean something to the app;
 * `role=tool` is the same move, on purpose, because of what the extension
 * *gets* by being an ordinary item: versions (a bad tool rolls back with `S`),
 * per-actor undo (installing one is one keystroke from undone), comments,
 * trash and restore, `isocan add rail.json --prop role=tool` for free, and
 * lineage. And the part that is actually new: **a canvas carries its own UI.**
 * Open somebody's canvas and the rail has their tool on it, because the tool
 * is on the canvas. Nothing had to be installed.
 *
 * ## What is deliberately NOT here
 *
 * No `Operation` in `does`, though the design permits one eventually: stage 1
 * says "existing commands", and a command is the form a person's ask already
 * takes on both surfaces. No panels (stage 3, and only once two real tools
 * have asked for the same shape — a declarative vocabulary grows until it is a
 * bad programming language, and the guard is a rule about additions). No
 * frames, no actors of their own yet (stage 4).
 */

/** The property that makes an item a tool, the way `role=design-system` makes
 * one a design system. One property, so nothing has to learn a new kind. */
const ROLE_PROP = "role";
export const TOOL_ROLE = "tool";

/** The properties that make an item this canvas's tool. */
export function toolProperties(): Record<string, string> {
  return { [ROLE_PROP]: TOOL_ROLE };
}

export function isToolExtension(item: Item): boolean {
  return item.properties[ROLE_PROP] === TOOL_ROLE;
}

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
export const EXTENSION_ICONS = [
  "broom",
  "wand",
  "check",
  "star",
  "tag",
  "list",
  "eye",
  "bolt",
  "clock",
  "flag",
  "link",
  "note",
] as const;

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
export const LABEL_LIMIT = 24;

/**
 * **The names a tool may not take.**
 *
 * From the design's *it must look like an extension*: a surface that looks
 * exactly like isocan is a place to put a convincing "sign in to continue".
 * The rail's own tools are the ones worth impersonating, because they are the
 * ones a person already trusts by sight, so their words are reserved.
 *
 * Compared case- and space-insensitively — "s e l e c t" and "SELECT" are the
 * same attempt, and a check that only catches the exact string is a check that
 * catches nobody trying.
 */
const RESERVED_LABELS = ["select", "hand", "zoom", "pen", "text", "comment", "add", "isocan"];

function flattened(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * What a manifest turned out to be: a tool, or the sentence explaining why not.
 *
 * A refusal is prose rather than a code because it is shown to whoever wrote
 * the file, and "invalid manifest" tells them nothing about which line to fix.
 */
type ToolRead = { tool: ToolExtension; problem?: undefined } | { tool?: undefined; problem: string };

/**
 * **Read a tool manifest, or say why it is not one.**
 *
 * `commands` is the live registry — built-ins, this home's, and any a loaded
 * module carries — because `does` naming a command that does not exist is the
 * failure a person actually makes, and the refusal should say so at the moment
 * the file is read rather than when the button is pressed.
 */
export function readToolExtension(text: string, commands: SlashCommand[]): ToolRead {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { problem: "not JSON — a tool is a small JSON file, see `isocan tool add --help`." };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { problem: "not a JSON object — a tool is one object, not a list." };
  }
  const raw = parsed as Record<string, unknown>;

  if (raw.kind !== "tool") {
    return {
      problem: raw.kind === undefined ? 'no "kind" — a tool declares `"kind": "tool"`.' : `"kind" is ${JSON.stringify(raw.kind)}; only "tool" is built (panels are stage 3).`,
    };
  }

  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  if (!label) return { problem: 'no "label" — a button with no words on it is not a button.' };
  if (label.length > LABEL_LIMIT) {
    return { problem: `"label" is ${label.length} characters; a rail button holds ${LABEL_LIMIT}.` };
  }
  if (RESERVED_LABELS.includes(flattened(label))) {
    return {
      problem: `"${label}" is one of the app's own tools. An extension wears its own name, because a control that looks exactly like isocan is where somebody would put a convincing "sign in to continue".`,
    };
  }

  const icon = raw.icon;
  if (typeof icon !== "string" || !(EXTENSION_ICONS as readonly string[]).includes(icon)) {
    return {
      problem: `"icon" must be one of the named set — ${EXTENSION_ICONS.join(", ")} — and not an image of your own, because an icon is a place anything at all could be painted.`,
    };
  }

  const does = typeof raw.does === "string" ? raw.does.trim() : "";
  if (!does) return { problem: 'no "does" — a tool is a button plus the ask it makes.' };
  const ask = parseSlashCommand(does);
  if (!ask) {
    return { problem: `"does" is ${JSON.stringify(does)}; it must be a slash command, like "/format".` };
  }
  if (!COMMAND_NAME.test(ask.name)) {
    return { problem: `"/${ask.name}" is not a command name — lowercase letters, digits and dashes.` };
  }
  if (!findCommand(commands, ask.name)) {
    return {
      problem: `no command called "/${ask.name}" here. A tool may only ask for what a person could ask for, so it can name a command this canvas has and no other.`,
    };
  }

  return { tool: { kind: "tool", label, icon: icon as ExtensionIcon, does } };
}

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
export function toolCapabilities(tool: ToolExtension, commands: SlashCommand[]): string[] {
  const ask = parseSlashCommand(tool.does);
  const command = ask ? findCommand(commands, ask.name) : null;
  const can: string[] = [];
  if (!command) {
    // Only reachable for a tool read before its command went away — the rail
    // says a tool is unavailable rather than silently dropping it.
    can.push(`asks for /${ask?.name ?? "?"}, which this canvas does not have`);
    return can;
  }
  if (command.local) {
    can.push(`answers in the app: ${command.description}`);
  } else {
    can.push(`posts a comment as you, asking an agent to: ${command.description}`);
    can.push("whatever that agent then does is attributed to it, and undoable per actor");
  }
  if (ask?.args) can.push(`always with the same words after it: "${ask.args}"`);
  can.push(`the command is ${command.source === "built-in" ? "one isocan ships" : command.source === "home" ? "this home's own" : "carried by a loaded module"}`);
  return can;
}

/**
 * Every tool on this canvas, oldest first, so the rail does not reshuffle
 * itself when somebody edits one. The bytes are not read here — an item's
 * content is fetched by the caller, the way `designSystem` hands back an item
 * and lets the surface read it.
 */
export function toolExtensionItems(canvas: CanvasContents): Item[] {
  return Object.values(canvas.items)
    .filter(isToolExtension)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id.localeCompare(b.id)));
}
