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
 * built-ins here ship with the app; a home can add its own (or shadow one of
 * these) by dropping a file in `~/.isocan/commands/`, which is why the
 * registry is a list rather than this constant.
 */

export interface SlashCommand {
  /** The word after the slash: lowercase, digits and dashes. */
  name: string;
  /** One line, shown beside the name in the menu. */
  description: string;
  /** How the arguments read, e.g. `[note]` or `<n> <how>`. */
  usage: string;
  /** What the agent should do. Markdown — this is the skill. */
  body: string;
  /** Shipped with isocan, or written by this home. */
  source: "built-in" | "home";
}

/** What a command may be called. Kept narrow so a name is always typeable,
 * always a legal filename, and never ambiguous with the text after it. */
export const COMMAND_NAME = /^[a-z][a-z0-9-]{0,31}$/;

export interface ParsedCommand {
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
export function matchCommands(
  commands: SlashCommand[],
  query: string,
  limit = 6,
): SlashCommand[] {
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
export function findCommand(commands: SlashCommand[], name: string): SlashCommand | null {
  return commands.find((c) => c.name === name.toLowerCase()) ?? null;
}

/**
 * The home's commands laid over the built-ins: same name, the home wins.
 * Shadowing rather than replacing means an upgrade improves the built-ins you
 * have not overridden, and a `rm` of your own file gives you ours back.
 */
export function mergeCommands(builtIns: SlashCommand[], home: SlashCommand[]): SlashCommand[] {
  const byName = new Map<string, SlashCommand>();
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

/** The commands isocan ships with. A home can shadow any of them by name. */
export const DEFAULT_COMMANDS: SlashCommand[] = [
  {
    name: "format",
    description: "Tidy the whole canvas into rows, children under parents",
    usage: "[note]",
    source: "built-in",
    body: `Arrange the canvas.

Run \`isocan format\` — the layout is a core function both surfaces share, so
it lands every item on the same coordinate whoever asks, and it is ONE
\`items.move\`, which means one undo. Do not place items by hand with \`mv\`
unless the note below asks for something the standard arrangement cannot do.

What it does, so you can say it back to them:
- Screens go in a row, left to right, keeping the reading order they already had.
- Anything made FROM a screen hangs in a column beneath it (the \`parent\`
  property — see /variation).
- Images and video gather into a grid below the screens: reference material,
  not slots in the row.
- Ink that annotates an item is left alone. It travels with what it marks.

If the person added a note, it OVERRIDES the standard arrangement wherever the
two disagree — they are looking at the canvas and you are not. Do the standard
format first, then adjust with \`isocan mv\`, \`align\`, and \`distribute\`,
and say which part of what you did came from the note.

Reply on the thread with what moved and what you left alone. If nothing moved,
say that too: a canvas that is already formatted is a good answer, not a
failure.`,
  },
  {
    name: "variation",
    description: "Make N variations of a screen, each explored differently",
    usage: "[n=3] <how they should differ>",
    source: "built-in",
    body: `Make variations of a screen.

WHICH SCREEN: the items attached to the message, or the ones #-referenced in
it, or — failing both — the single item they had selected. If none of those
answers, ask which one rather than guessing; a variation of the wrong screen
wastes their time and yours.

HOW MANY: the first argument if it is a number, otherwise three.

HOW THEY SHOULD DIFFER: the rest of the argument. If it is empty, vary the
thing that actually carries the design — layout and hierarchy — and not the
palette, and say that is what you chose.

For each variation:
- Build a REAL alternative, not a recolour. Two variations that differ by a
  font are one variation.
- \`isocan add <file> --title "<original title> — <what makes it different>"\`
  with \`--prop parent=<source item id>\`. That property is what makes it a
  child: /format will hang it under its source, and anyone can see where it
  came from.
- Give it a name that says the IDEA, not a number. "— single column" is worth
  reading; "— variation 2" is not.

Then run \`isocan format\` so they land under the original in the order you
made them, and post ONE comment on the thread: what you varied, what each one
is trying, and which you would keep and why. You looked at all three; say what
you saw.`,
  },
  {
    name: "grill-me",
    description: "Interview the user, then write the spec it produces",
    usage: "[what you want to build]",
    source: "built-in",
    body: `Interview them, then write the spec.

They have asked to be questioned because they know what they want and have not
said it yet. Your job is to find the decisions that are still open and get them
made — not to collect requirements politely.

HOW TO ASK:
- ONE question per comment. A list of six gets one answer to the easiest.
- Ask what is undecided, not what is written down. If the canvas already says
  it, read the canvas: \`isocan ls\`, \`isocan get\`, \`isocan activity\`.
- Prefer a question with named options over an open one. "Grid or list?" gets
  an answer; "how should it look?" gets a shrug.
- Follow the answer that surprises you. That is where the real spec is.
- Keep count out loud: "3 of about 6" costs nothing and tells them how long
  this is.
- Stop when the next question would not change what gets built. Usually five
  to eight. Do not pad.

BETWEEN QUESTIONS: post the question with \`isocan comment reply\` on this
thread, then \`isocan wait --timeout 900\`. They may take a while; that is what
waiting is for. If they answer two questions at once, do not re-ask the one
they already answered.

WHEN YOU ARE DONE: write the spec as an item on the canvas —
\`isocan add spec.md --title "<what it is> — spec"\` — covering what is being
built, who for, the decisions they made and WHY (in their words, quoted where
they were vivid), what is explicitly out of scope, and what remains open. Then
reply on the thread with #the-spec and one line on what to do next.

The value is in the decisions, not the prose. A spec that says "clean, modern"
recorded nothing.`,
  },
];
