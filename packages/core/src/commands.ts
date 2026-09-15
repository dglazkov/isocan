/**
 * Slash commands: a message that asks for a known piece of work.
 *
 * Typing `/format` in any composer is not a button the web app presses. It
 * posts an ordinary comment whose body begins with the command, and an agent
 * does the work — which is the only design that keeps its promise on both
 * surfaces. A person types it into the composer, an agent reads it with
 * `isocan comment list`, and `isocan comment add "/format tighten the rows"`
 * asks for exactly the same thing from a terminal. Nothing new is stored: a
 * command is text in a comment, so undo, history, and every existing client
 * keep working.
 *
 * A command IS a skill: its body is the instructions the agent follows, in
 * markdown, written for a reader who has the isocan CLI and this canvas. The
 * catalogue and instruction bodies beside this file ship with the app; a home can add its own (or shadow one of
 * these) by dropping a file in `~/.isocan/commands/`, which is why the
 * registry is a list rather than this constant.
 */

/** The shared menu, alias and dispatch data; an instruction body is not required to offer a command. */
export interface CommandMetadata {
  /** The word after the slash: lowercase, digits and dashes. */
  name: string;
  /** One line, shown beside the name in the menu. */
  description: string;
  /** How the arguments read, e.g. `[note]` or `<n> <how>`. */
  usage: string;
  /**
   * **Names this command used to have**, so a rename does not break the
   * habit of everybody who learned the old one.
   *
   * Not shown in the menu and not offered as a completion: an old name is a
   * door that still opens, not a second thing to choose between. `/format`
   * became `/tidy` on 7 Sep because the command's own description had always
   * begun "Tidy the canvas" — one operation with two names before anybody
   * tried to use it — and `/format` is written in canvases, in habits, and in
   * the agent guide.
   */
  aka?: readonly string[];
  /** Shipped with isocan, written by this home, or carried by a loaded module (core/modules.ts). */
  source: "built-in" | "home" | "module";
  /**
   * The app answers this one itself instead of posting it.
   *
   * Almost every command is a request an agent carries out, and that is the
   * point of the design. The exception is a command about the app you are
   * already holding: making somebody wait for an agent to be told what their
   * own keyboard does would be silly, and if no agent is parked they would
   * wait forever. Only built-ins can be local — a home command has no code in
   * the client to run.
   */
  local?: boolean;
  /**
   * **A module command that opens one of its module's dialogs** (proposed:
   * `dialogs`, 11 Sep 2026) — local on the web, a skill on the terminal. Typed
   * into a composer it opens the dialog, with whatever followed the command
   * as the dialog's `args`; read by an agent from the Chat it is still a body
   * to carry out with the module's verbs. The same command, the right thing on
   * each surface — which is what `local` already means for a built-in.
   *
   * Honoured only for `source: "module"`: a home command has no code in the
   * client, and a file must not be able to claim a dialog.
   */
  opens?: string;
}

/** A complete command carries the actual instructions read by CLI and agent clients. */
export interface SlashCommand extends CommandMetadata {
  /** What the agent should do. Markdown — this is the skill. */
  body: string;
}

/** What a command may be called. Kept narrow so a name is always typeable,
 * always a legal filename, and never ambiguous with the text after it. */
export const COMMAND_NAME = /^[a-z][a-z0-9-]{0,31}$/;

interface ParsedCommand {
  name: string;
  /** Everything after the name, trimmed. Empty string when there is none. */
  args: string;
  /** Where the name ends, for painting the chip. */
  end: number;
}

/**
 * The command a message IS, or null.
 *
 * Only at the very start: a message that mentions "/format" halfway through a
 * sentence is talking ABOUT the command, not asking for it, and an agent that
 * cannot tell the difference will do the work while you are still explaining
 * why you did not want it. Leading whitespace is forgiven; nothing else is.
 */
export function parseSlashCommand(body: string): ParsedCommand | null {
  const lead = body.length - body.trimStart().length;
  const text = body.slice(lead);
  if (!text.startsWith("/")) return null;
  const match = /^\/([a-z][a-z0-9-]{0,31})(?=$|\s)/.exec(text);
  if (!match) return null;
  return {
    name: match[1]!,
    args: text.slice(match[0].length).trim(),
    end: lead + match[0].length,
  };
}

/** The commands worth offering for what has been typed so far. Prefix first
 * (what you are typing is usually the start of what you mean), then anything
 * else that contains it, and never the same command twice. */
export function matchCommands<T extends CommandMetadata>(
  commands: readonly T[],
  query: string,
  limit = 6,
): T[] {
  const q = query.trim().toLowerCase();
  if (q === "") return commands.slice(0, limit);
  const starts = commands.filter((c) => c.name.startsWith(q));
  const contains = commands.filter(
    (c) => !c.name.startsWith(q) && (c.name.includes(q) || c.description.toLowerCase().includes(q)),
  );
  return [...starts, ...contains].slice(0, limit);
}

/** Look one up by name — the registry is small, and the answer has to be the
 * same for the menu, the CLI, and the agent reading the comment. */
export function findCommand<T extends CommandMetadata>(commands: readonly T[], name: string): T | null {
  const wanted = name.toLowerCase();
  return (
    commands.find((c) => c.name === wanted) ??
    // An old name still opens the door. Checked second, so a command that
    // takes a name another one used to have wins it — the current vocabulary
    // outranks the history of it.
    commands.find((c) => c.aka?.includes(wanted)) ??
    null
  );
}

/**
 * The home's commands laid over the built-ins: same name, the home wins.
 * Shadowing rather than replacing means an upgrade improves the built-ins you
 * have not overridden, and a `rm` of your own file gives you ours back.
 */
export function mergeCommands<T extends CommandMetadata>(builtIns: readonly T[], home: readonly T[]): T[] {
  const byName = new Map<string, T>();
  for (const command of builtIns) byName.set(command.name, command);
  for (const command of home) byName.set(command.name, { ...command, source: "home" });
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * A command as a FILE: frontmatter for what the menu shows, and the rest is
 * the instructions. The same shape a skill has, because it is one — and a
 * format somebody can write in a text editor without reading a schema.
 *
 * ---
 * description: Tidy the whole canvas
 * usage: [note]
 * ---
 * Do this, then that.
 *
 * The name comes from the filename, not the frontmatter: two sources for one
 * identity is how you get a `format.md` that answers to `/tidy`.
 */
export function parseCommandFile(name: string, text: string): SlashCommand | null {
  if (!COMMAND_NAME.test(name)) return null;
  let description = "";
  let usage = "";
  let body = text;
  const front = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (front) {
    body = text.slice(front[0].length);
    for (const line of front[1]!.split(/\r?\n/)) {
      const pair = /^([a-z]+):\s*(.*)$/i.exec(line.trim());
      if (!pair) continue;
      const value = pair[2]!.trim().replace(/^["']|["']$/g, "");
      if (pair[1]!.toLowerCase() === "description") description = value;
      if (pair[1]!.toLowerCase() === "usage") usage = value;
    }
  }
  body = body.trim();
  if (body === "") return null; // a command with no instructions is not a command
  return {
    name,
    // A command with no description still has to be pickable from the menu.
    description: description || `Run the ${name} command`,
    usage,
    body,
    source: "home",
  };
}

/** The file a command is written back as — what `parseCommandFile` reads. */
export function commandFileText(command: Pick<SlashCommand, "description" | "usage" | "body">): string {
  const lines = ["---", `description: ${command.description}`];
  if (command.usage) lines.push(`usage: ${command.usage}`);
  lines.push("---", "", command.body.trim(), "");
  return lines.join("\n");
}
