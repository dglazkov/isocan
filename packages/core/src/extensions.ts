import type { CanvasContents, Item } from "./model.ts";
import { COMMAND_NAME, findCommand, parseSlashCommand, type CommandMetadata } from "./commands.ts";

/**
 * **Extending the canvas from inside it** — the one reader for
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
 * ## Two readers, one file
 *
 * `readToolExtension` is stage 1's, and `readPanelExtension` below it is
 * phase 3's — the same move for a panel, sharing one `flattened()` so that a
 * reserved name cannot be spelled around the check, and sharing the argument
 * for why a refusal is prose. They sit together because what must not drift
 * is the SHAPE of a refusal, and two files is how it would.
 *
 * ## What is deliberately NOT here
 *
 * No `Operation` in `does`, though the design permits one eventually: stage 1
 * says "existing commands", and a command is the form a person's ask already
 * takes on both surfaces. No `rows` — the design's tier 2, whose gate is
 * evidence that has not arrived, because a declarative vocabulary grows until
 * it is a bad programming language. No frames, no actors of their own yet:
 * phases 4, 5 and 6, and the capability list below says so out loud rather
 * than implying a panel can already act.
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
export function readToolExtension(text: string, commands: readonly CommandMetadata[]): ToolRead {
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
      problem:
        raw.kind === undefined
          ? 'no "kind" — a tool declares `"kind": "tool"`.'
          : `"kind" is ${JSON.stringify(raw.kind)}; this reads tools${raw.kind === PANEL_ROLE ? " — a panel is added with `isocan panel add`" : ""}.`,
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
export function toolCapabilities(tool: ToolExtension, commands: readonly CommandMetadata[]): string[] {
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

// ---------- panels: the hosted tier's manifest, and its one reader ----------

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
export const PANEL_ROLE = "panel";

/** The properties that make an item this canvas's panel. */
export function panelProperties(): Record<string, string> {
  return { [ROLE_PROP]: PANEL_ROLE };
}

/** Whether an item is one — one property, read the same way a design system
 * is read, so nothing has to learn a new kind. */
export function isPanelExtension(item: Item): boolean {
  return item.properties[ROLE_PROP] === PANEL_ROLE;
}

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
export const PANEL_SIDES = ["left"] as const;

/** One of the slots above, so a panel's side is a place and not a string. */
export type PanelSide = (typeof PANEL_SIDES)[number];

/** The longest a panel's name may be. It is a dock header, not a sentence. */
export const TITLE_LIMIT = 32;

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
 * **The names a panel may not take.**
 *
 * The tool's `RESERVED_LABELS` argument, pointed at the dock: a surface that
 * looks exactly like isocan is a place to put a convincing "sign in to
 * continue", and the app's own panels are the ones worth impersonating
 * because they are the ones a person already trusts by sight.
 *
 * Read from the shell rather than guessed: `packages/web/src/lib/panels.ts`
 * has `main | files | agents | context | personas`, and the entries that open
 * them (`lib/actions.ts`, `lib/menuentries.tsx`) call them Chat, Files,
 * Agents, Context and Personas. Both spellings of the first are reserved —
 * the panel is the Chat in the rail and the "Main" button in the top bar, and
 * a person who has seen either would be fooled by the other.
 *
 * Flattened by the same `flattened()` the labels use, deliberately not a
 * second copy: "I S O C A N" and "isocan" are one attempt, and a check that
 * only catches the exact string catches nobody who is actually trying.
 */
const RESERVED_TITLES = ["chat", "main", "files", "agents", "context", "personas", "isocan"];

/**
 * What a manifest turned out to be: a panel, or the sentence explaining why
 * not — prose naming the field, for `readToolExtension`'s reason. It is shown
 * to whoever wrote the file, and "invalid manifest" tells them nothing about
 * which line to fix.
 */
type PanelRead = { panel: PanelExtension; problem?: undefined } | { panel?: undefined; problem: string };

/** Anything that looks like it wants a host of its own — a scheme, a
 * protocol-relative pair of slashes, or a path off this canvas. Matched
 * before the lookup so the refusal can say the RULE rather than "no item
 * called https://acme.example/panel.html". */
const OFF_CANVAS = /^[a-z][a-z0-9+.-]*:|^\/\/|^\//i;

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
export function readPanelExtension(text: string, canvas: CanvasContents): PanelRead {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { problem: "not JSON — a panel is a small JSON file, see `isocan panel add --help`." };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { problem: "not a JSON object — a panel is one object, not a list." };
  }
  const raw = parsed as Record<string, unknown>;

  if (raw.kind !== "panel") {
    return {
      problem:
        raw.kind === undefined
          ? 'no "kind" — a panel declares `"kind": "panel"`.'
          : `"kind" is ${JSON.stringify(raw.kind)}; this reads panels${raw.kind === TOOL_ROLE ? " — a tool is added with `isocan tool add`" : ""}.`,
    };
  }

  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) return { problem: 'no "title" — a panel with no name is a panel nobody can tell from the app\'s own.' };
  if (title.length > TITLE_LIMIT) {
    return { problem: `"title" is ${title.length} characters; a dock header holds ${TITLE_LIMIT}.` };
  }
  if (RESERVED_TITLES.includes(flattened(title))) {
    return {
      problem: `"${title}" is one of the app's own panels. An extension wears its own name, because a panel that looks exactly like isocan is where somebody would put a convincing "sign in to continue".`,
    };
  }

  const side = raw.side;
  if (typeof side !== "string" || !(PANEL_SIDES as readonly string[]).includes(side)) {
    return {
      problem: `"side" must be one of the slots the app has — ${PANEL_SIDES.join(", ")} — because isocan draws the slot and a panel paints inside it and nowhere else.`,
    };
  }

  const src = typeof raw.src === "string" ? raw.src.trim() : "";
  if (!src) return { problem: 'no "src" — a panel is a name plus the bytes it shows.' };
  if (OFF_CANVAS.test(src)) {
    return {
      problem: `"src" is ${JSON.stringify(src)}, which is somewhere else. A panel shows bytes that are already on this canvas — name an item here, because an extension may not read past the canvas it is on.`,
    };
  }

  // The lookup, by the item's title — which is its filename, and the thing a
  // person actually typed when they put the page on the canvas.
  const named = Object.values(canvas.items).filter((item) => item.title === src);
  if (named.length === 0) {
    return {
      problem: `"src" is ${JSON.stringify(src)}, and nothing on this canvas is called that. Add the page first — \`isocan add ${src}\` — because a panel may only show bytes this canvas already has.`,
    };
  }
  if (named.length > 1) {
    return {
      problem: `"src" is ${JSON.stringify(src)}, and ${named.length} items here are called that. Rename one: a panel that could mean either is a panel whose bytes nobody can name.`,
    };
  }
  const item = named[0]!;
  const version = item.versions.find((v) => v.id === item.currentVersionId);
  if (!version) {
    return { problem: `"src" is ${JSON.stringify(src)}, which has no bytes on this canvas yet — a panel shows a version, and that item has none.` };
  }
  if (!version.mimeType.startsWith("text/html")) {
    return {
      problem: `"src" is ${JSON.stringify(src)}, which is ${version.mimeType}. A panel is a page, so its bytes are HTML.`,
    };
  }

  return {
    panel: {
      kind: "panel",
      title,
      side: side as PanelSide,
      src,
      bytes: { itemId: item.id, blobHash: version.blobHash, filename: version.filename, mimeType: version.mimeType },
    },
  };
}

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
export function panelCapabilities(panel: PanelExtension): string[] {
  return [
    `shows ${panel.bytes.filename} (${panel.bytes.itemId}): its bytes are an item on this canvas, and the manifest can name no other source`,
    `whoever may edit ${panel.src} decides what this panel shows, without touching this manifest — and its versions are the panel's history, so a bad one rolls back`,
    "cannot run yet: nothing renders a panel in this build, so these bytes are stored and read and never executed",
    "when it renders it will be a sandboxed page served from the content origin — never isocan's own origin, so it holds no badge and cannot act as you",
    `it will paint in the ${panel.side} dock and nowhere else: not over the canvas, the top bar or another panel`,
    "it cannot send an operation: the door a panel asks through is not built, so nothing it contains can change this canvas",
  ];
}

/**
 * Every panel on this canvas, oldest first, so the dock does not reshuffle
 * itself when somebody edits one. The bytes are not read here — an item's
 * content is fetched by the caller, exactly as `toolExtensionItems` leaves it.
 */
export function panelExtensionItems(canvas: CanvasContents): Item[] {
  return Object.values(canvas.items)
    .filter(isPanelExtension)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id.localeCompare(b.id)));
}
