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
}
/** What a command may be called. Kept narrow so a name is always typeable,
 * always a legal filename, and never ambiguous with the text after it. */
export declare const COMMAND_NAME: RegExp;
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
export declare function parseSlashCommand(body: string): ParsedCommand | null;
/** The commands worth offering for what has been typed so far. Prefix first
 * (what you are typing is usually the start of what you mean), then anything
 * else that contains it, and never the same command twice. */
export declare function matchCommands(commands: SlashCommand[], query: string, limit?: number): SlashCommand[];
/** Look one up by name — the registry is small, and the answer has to be the
 * same for the menu, the CLI, and the agent reading the comment. */
export declare function findCommand(commands: SlashCommand[], name: string): SlashCommand | null;
/**
 * The home's commands laid over the built-ins: same name, the home wins.
 * Shadowing rather than replacing means an upgrade improves the built-ins you
 * have not overridden, and a `rm` of your own file gives you ours back.
 */
export declare function mergeCommands(builtIns: SlashCommand[], home: SlashCommand[]): SlashCommand[];
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
export declare function parseCommandFile(name: string, text: string): SlashCommand | null;
/** The file a command is written back as — what `parseCommandFile` reads. */
export declare function commandFileText(command: Pick<SlashCommand, "description" | "usage" | "body">): string;
/** The commands isocan ships with. A home can shadow any of them by name. */
export declare const DEFAULT_COMMANDS: SlashCommand[];
