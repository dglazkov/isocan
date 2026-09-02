/**
 * **The split ledger** — the front page's argument, as data.
 *
 * The gesture on the left, the command that does the identical work on the
 * right. It is a layout and it is also the claim: every mutation on a canvas is
 * one `Operation` value applied by one reducer, so the mouse and the terminal
 * cannot drift apart. A page that says that in a sentence is asking to be
 * believed; a page that shows nine pairs has already proved it.
 *
 * **Here rather than in the JSX for one reason: the right-hand column is a
 * promise about the CLI.** A command written into a page is a copy that ages,
 * and the audience for this page will paste one within a minute of reading it.
 * So the rows are a value a test can walk, and
 * `packages/web/test/frontdoor.test.ts` checks every verb here against the
 * commands `packages/cli/src/main.ts` actually registers — the same move
 * `packages/cli/test/surface.test.ts` makes for the agent guide, and the same
 * move `SKILL_INSTALL_COMMAND` makes for the install line. Rename a verb and
 * this page fails the build instead of lying quietly.
 *
 * The nouns are synthetic and stay that way (AGENTS.md): `itm_9fK`, a file
 * called `step-2.html`, agents named for models. Nothing here is lifted from a
 * canvas anybody actually has.
 */
type LedgerRow = {
  /** What a person does with a pointer or a key. */
  did: string;
  /** The part that would otherwise need a paragraph. */
  note: string;
  /** The same act, as an agent performs it. Always starts with `isocan`. */
  command: string;
};

export const LEDGER: readonly LedgerRow[] = [
  {
    did: "Drag a screen across the canvas",
    note: "Or nudge it with the arrow keys",
    command: "isocan mv itm_9fK 320 180",
  },
  {
    did: "Drop a file onto the canvas",
    note: "Images, HTML, markdown, video, PDFs",
    command: "isocan add step-2.html --at 520,0",
  },
  {
    did: "Double-press a title and rename it",
    note: "The file underneath is renamed too",
    command: 'isocan set itm_9fK --title "Pick many"',
  },
  {
    did: "Save a new version of a screen",
    note: "The old one stays in the stack",
    command: "isocan edit itm_9fK step-2.html",
  },
  {
    did: "Press S to fan the versions out",
    note: "Escape, or S again, closes it",
    command: "isocan versions itm_9fK",
  },
  {
    did: "Drop a pin and write a comment",
    note: "@names reach people, #titles link items",
    // Kept short on purpose: measured in a 1280px window, a longer string
    // scrolled out of the right-hand column instead of sitting in it.
    command: 'isocan comment add --item itm_9fK "@Fable one or many?"',
  },
  {
    did: "Tidy the whole canvas",
    note: "Screens across, children under parents",
    command: "isocan format",
  },
  {
    did: "Point a mini-browser at your dev server",
    note: "A running site, live on the canvas",
    command: "isocan browse http://localhost:5173",
  },
  {
    did: "Press ⌘Z",
    note: "Per person — you never undo somebody else's work",
    command: "isocan undo",
  },
];

/**
 * The verb a row promises, for the guard that checks it is real.
 *
 * Written as a function rather than inline in the test because "the second word
 * is the verb" is a rule about how these strings are shaped, and the shape is
 * this module's business (lessons.md #5). `isocan comment add …` names
 * `comment`, which is what `main.ts` registers; the subcommand is a level
 * `registeredCommands` cannot see anyway, and pretending otherwise would be a
 * check with a false failure in it.
 */
export function verbOf(command: string): string {
  return command.trim().split(/\s+/)[1] ?? "";
}
