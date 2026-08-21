import { slopRulesAsText } from "./slop.ts";
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
    name: "help",
    description: "Keyboard shortcuts, and what else you can ask for",
    usage: "",
    source: "built-in",
    // Answered where it is typed: the app knows its own keyboard.
    local: true,
    body: `Say what can be done here.

Answer with three things, short enough to read in the thread:

1. THE COMMANDS. \`isocan command list\` — every one available on this canvas,
   including any this home added. Give the name, what it does, and one example
   of the arguments, e.g. "/variation 3 try a vertical nav".
2. THE KEYS, if they asked about the web app. \`isocan --help shortcuts\` is not
   a thing; the list lives in the app's help panel, which opens with ? — say
   that, and name the two or three that matter for what they are doing.
3. WHAT YOU CAN DO for them right now, in one line. Not a menu of capabilities
   — the one or two things that would obviously help on THIS canvas, given
   what is on it.

If they asked about something specific, answer that instead of reciting the
list. A person typing /help mid-task has a question, not a curiosity.`,
  },
  {
    name: "accessibility-audit",
    description: "Audit selected screens against WCAG — from the real HTML, not a picture",
    usage: "[what to focus on]",
    source: "built-in",
    body: `Audit the screens for accessibility, and write the report onto the canvas.

READ THE SOURCE, NOT THE SCREENSHOT. \`isocan get <item> screen.html\` gives you
the actual HTML and CSS. This is the whole reason the audit is worth running
here rather than by eye: half of accessibility is invisible in a picture — a
div pretending to be a button looks identical to a button.

WHICH SCREENS: the items attached to the message, the ones #-referenced in it,
or the selection. If none of those answers, ask.

WHAT TO CHECK, in the order that matters:
- **Semantic HTML.** Headings in order and not skipping levels; landmarks
  (header/nav/main/footer); lists that are lists; \`<button>\` for things that
  do something and \`<a href>\` for things that go somewhere. A clickable div is
  the single most common finding and the most consequential.
- **Names.** Every control has an accessible name — visible text, aria-label,
  or a label element that actually points at it. Icon-only buttons are where
  this fails.
- **ARIA.** Roles that match what the element does, aria-describedby that
  resolves to a real id, no aria-hidden on something focusable. No ARIA is
  better than wrong ARIA; say so when you find decoration.
- **Contrast.** Compute the ratio from the CSS rather than judging by eye:
  4.5:1 for body text, 3:1 for large text and for the boundary of a control.
  Give the numbers.
- **Keyboard.** Tab order follows the DOM; nothing is reachable only by hover
  or pointer; focus is VISIBLE (an \`outline: none\` with no replacement is a
  finding); no keyboard trap.
- **Images.** alt text that says what the image is FOR, empty alt on
  decoration, and no alt that just repeats the filename.
- **Motion and media**, if any: a \`prefers-reduced-motion\` path, captions.

WRITE IT AS A DOCUMENT, not a chat message. \`isocan add audit.md --title
"<screen> — accessibility audit" --prop parent=<the screen's item id>\`, so it
hangs under the screen it is about.

Structure it so somebody can act on it before lunch:
- A one-paragraph verdict, and a count by severity.
- Findings ordered by severity, each with: what is wrong, WHERE (the selector,
  the element, the line if you can), which WCAG criterion it fails (with the
  number, e.g. 1.4.3 Contrast (Minimum)), and the fix as a diff or a snippet.
- What you checked and found FINE. A report with no green is a report nobody
  believes.
- What you could not check from source — anything that needs a screen reader
  or a real keyboard — said plainly rather than left implied.

Then reply on the thread with the count, the worst one in a sentence, and
#the-report. If the person named a focus in the argument, lead with that.`,
  },
  {
    name: "app-store-assets",
    description: "Icon, three marketing screenshots, and the ASO metadata",
    usage: "[what to emphasise]",
    source: "built-in",
    body: `Produce a full App Store set from the selected screens.

Read "Making an image" in \`isocan --agent-help\` first — it has the three ways
to make a picture here and a working headless-Chrome recipe. The short version:
compose in HTML/SVG and render at an exact size. Do not generate UI.

FIVE DELIVERABLES. Produce all five, even for a partial-sounding request; a
half set is not usable in App Store Connect.

**1. App icon — 1024x1024 PNG.**
- The whole image IS the icon. No rounded rectangle, no squircle, no container
  shape, no border, no margin: the store applies the mask itself, and an icon
  that draws its own corners gets them clipped twice.
- Full-bleed background, edge to edge — a 2-3 stop gradient from the app's own
  palette, never a flat fill.
- One motif, centred, orthographic, generous negative space. Distil what the
  app IS into a single mark; do not draw a phone, and do not put text in it.
- Weight and light: a soft top-down specular and a hint of material make it
  read as an object rather than a sticker.

**2-4. Three marketing screenshots — 1290x2796 PNG** (the 6.7" size; the store
scales the rest down from it).
- Put the REAL screen inside the device frame: \`isocan get\` it and drop it in
  an \`<iframe>\`. Never redraw a UI. This is the rule the whole command hangs
  on — a screenshot with invented UI is a lie about the product, and it is the
  one thing reviewers notice.
- Frame: straight on, no tilt, titanium rim, layered shadow for depth. No
  hands, no desks, no cafés.
- Layout: headline in the top fifth, device below it, ~150px of quiet at every
  edge. Identical headline typography across all three — same face, weight,
  size, alignment. That consistency is what makes a set read as a set.
- Each one carries ONE idea: (2) the hook — what this is; (3) the feature that
  makes it worth having; (4) polish — dark mode or the most visually
  confident view, on a deep background with a midnight device.
- The palette evolves gently across the three; it does not change.

**5. ASO metadata — a document on the canvas.** Respect the limits exactly and
count the characters rather than estimating:
- App name, 30. Subtitle, 30. Short description, 80. Long description, 4000.
- Keywords, 100 total, comma-separated, no spaces after commas, and NEVER a
  word already in the name or subtitle — that is a wasted slot.
- Category, primary and secondary, with a sentence on why.
- What's New, 500.
Lead with benefits, not features. Say what the person gets, not what the app
contains.

Everything lands on the canvas — \`isocan add icon.png --title "App icon"
--prop parent=<the screen it came from>\` — so \`isocan format\` hangs the set
under its source. Finish with one comment:
the five deliverables, which way each image was made, and two or three
follow-ups worth doing.`,
  },
  {
    name: "web-assets",
    description: "Favicon, Apple touch icon, and a manifest.json",
    usage: "[what to emphasise]",
    source: "built-in",
    body: `Produce the web asset set from the selected screens.

Read "Making an image" in \`isocan --agent-help\`. For icons, prefer AUTHORING
the SVG over rendering or generating: a favicon is geometry, an SVG one is
sharp at every size, and \`icon.svg\` is a first-class favicon in every current
browser. Render the PNGs from that same SVG so they cannot drift.

**1. Favicon.** One recognisable mark from the app's branding, on a full-bleed
background — no squircle, no container shape, no margin. Deliver \`icon.svg\`
plus \`favicon-32.png\` and \`favicon-192.png\` rendered from it. It has to be
legible at 16px: if the mark has more than three parts, it is a logo, not a
favicon.

**2. Apple touch icon — 180x180 PNG.** Same mark, no transparency (iOS
composites on white and a transparent icon looks broken), no rounded corners —
iOS applies the mask.

**3. manifest.json.** \`name\`, \`short_name\` (12 chars or it truncates on the
home screen), \`icons\` covering 192 and 512 with \`purpose: "any maskable"\`,
\`start_url\`, \`display: "standalone"\`, and \`theme_color\`/\`background_color\`
taken from the app's actual palette rather than invented — the background
colour is what people see during the splash, so it must match the app's first
paint or the launch flashes.

**4. The two lines nobody remembers.** Include the \`<link>\` tags to paste into
\`<head>\`, since assets with no wiring are assets nobody installs.

Land everything with \`isocan add icon.svg --title "Favicon" --prop
parent=<the screen it came from>\`. Finish with one comment listing what you
made, how each was made, and the head snippet.`,
  },
  {
    name: "marketing-kit",
    description: "Social card, banner, email header, and the copy to go with them",
    usage: "[the angle to take]",
    source: "built-in",
    body: `Produce a marketing set from the selected screens.

Read "Making an image" in \`isocan --agent-help\`. These are compositions —
type, gradient, geometry, and where it helps a framed shot of the real screen —
so compose and render rather than generate.

**1. Social card — 1200x630 PNG** (the size Open Graph and Twitter actually
use; 1:1 is for a feed post, and if they asked for one, do both).
- It will be seen at 300px wide in a timeline. One idea, six words at most,
  type large enough to read at a third of this size.
- The product visible, not described.

**2. Banner — 1600x900 PNG.** 16:9, room for the headline to breathe, safe
margins so nothing important dies in a crop.

**3. Email header — 1600x900 PNG,** and remember it renders at ~600px wide in
most clients: no small type, no thin strokes, and legible on a white ground
since half of clients strip backgrounds.

**4. The copy, as HTML on the canvas.** A headline, a subhead, three short
benefit lines, and one call to action. Reference the email header with a
relative \`<img>\` so the document is self-contained on the canvas. Write like a
person: no "revolutionise", no "seamless", no "unlock the power of". Say what
it does and who it is for.

ONE VOICE ACROSS ALL FOUR. Same palette, same type, same claim. A kit whose
pieces argue with each other is worse than one piece.

Land everything with \`isocan add card.png --title "Social card" --prop
parent=<the screen it came from>\`. Finish with one comment: the four
deliverables, how each image was made, and the single sentence you would lead
with if you only got one.`,
  },
  {
    name: "design-audit",
    description: "Review a screen's craft against the house style and the usual tells",
    usage: "[what to look at]",
    source: "built-in",
    body: `Audit the design of the selected screens, from the source.

READ TWO THINGS FIRST.

1. THE HOUSE STYLE: \`isocan style\`. If this canvas has one, it is the
   standard — its type scale, its palette, its spacing unit, its rules. A
   finding is "this is not the scale" and not "I would have chosen otherwise".
   If there is no house style, say so once at the top and audit against the
   list below alone; do not invent a system and then grade against it.
2. THE SCREEN: \`isocan get <item> screen.html\`. Audit the HTML and CSS, not a
   picture of them. A ratio you computed beats a colour you looked at, and
   half of what matters here — the scale, the spacing unit, the focus states —
   is invisible in a screenshot.

WHAT TO LOOK FOR, in this order:

**Conformance.** Where the screen departs from the house style. Cite the
declared value and the one it should have been.

**The usual tells.** These are the moves a generated interface reaches for.
Each one says how to spot it, so report it only when you can point at the
line:

${slopRulesAsText()}

**Craft, in the parts a list cannot hold.** Hierarchy (does the eye land on
the right thing first?), rhythm (do the gaps mean something?), and whether the
copy says anything. Be specific or say nothing: "the hero and the first card
compete because both are 32px semibold" is worth reading; "improve visual
hierarchy" is not.

WRITE IT AS A DOCUMENT: \`isocan add design-audit.md --title "<screen> —
design audit" --prop parent=<the screen's item id>\`, so it hangs under what it
is about.

Structure it to be acted on:
- One paragraph of verdict, and the single change that would help most.
- Findings worst first, each with the selector or element, what is wrong, and
  the fix as a snippet or a diff — a value, not an adjective.
- What is GOOD, named specifically. A report with no green is a report the
  person stops believing, and it tells them what to keep.
- What you could not judge from source.

This list is a FLOOR, not taste. Removing every item on it makes a screen
unembarrassing, not good; say plainly which findings are hygiene and which are
the one or two that would actually make it better.

Then reply on the thread with the verdict, the top fix, and #the-report.`,
  },
  {
    name: "house-style",
    description: "Write down what this canvas has decided things look like",
    usage: "[what to change]",
    source: "built-in",
    body: `Write or update this canvas's house style.

It is an item on the canvas, not a file in a repo — so it sits beside the
designs it governs, versions like everything else, and the person can read it
without knowing it exists. \`isocan style\` prints the current one.

IF THERE IS NONE, DERIVE IT FROM WHAT IS ALREADY THERE. Do not invent a system
and impose it: \`isocan ls --kind site --kind document\`, \`isocan get\` the two
or three screens that look most like what they want, and write down what they
ALREADY do. Where the screens disagree, pick the one that appears most, and
say in the document that you did.

WHAT IT MUST CONTAIN — numbers, not adjectives. "Clean and modern" describes
nothing and grades nothing:
- **Type.** The faces, with fallbacks, and what each is for. The scale as
  actual values. Line heights. The one or two weights in use.
- **Colour.** Every colour as a hex with a name and a job (ground, ink, muted
  ink, accent, accent ink, line, danger). Both themes if the canvas has two.
- **Space.** The unit, and the steps taken from it. What separates sections,
  what separates related things.
- **Shape.** Radii and what each is for. Borders. Shadows, if any, and what
  they mean.
- **Rules this project actually cares about.** Three to six, in the
  imperative, each one falsifiable: "body text is left-aligned", "one accent
  per screen", "no shadow without overlap".

Keep it under two pages. A style guide nobody finishes is a style guide nobody
follows.

SAVE IT: \`isocan style set style.md\` — that creates the item, or adds a
version to the existing one, so the old style is still there to compare
against. Then reply with what you wrote down and, honestly, where the existing
screens disagree with each other — that disagreement is the decision the
person now gets to make.`,
  },
  {
    name: "skill",
    description: "Find a published skill, or add one to this canvas",
    usage: "find <what you want> | add <owner/repo/path>",
    source: "built-in",
    body: `Get this canvas a new skill.

A slash command's body IS a skill — same markdown, same frontmatter — which is
why anything published for Claude Code, Codex or Cursor drops straight in. The
first argument says which job:

**\`/skill find <what you want>\`** — look, propose, install NOTHING.

Search for skills that do the thing they described. Then, for the two or three
worth their time, reply with:
- what it does, in your words, and whether it actually fits this canvas
- the CANONICAL source — the repo it lives in, not the tenth aggregator site
  that reprinted it. Most search results for skills are SEO copies; find the
  original and name it.
- its licence, and roughly how used it is (stars, installs) — one line
- the exact command to add it, ready to paste

Then stop. Choosing is theirs.

**\`/skill add <owner/repo/path/SKILL.md or https URL>\`** — fetch and show it.

    isocan command add --from <ref>          # prints it, installs nothing
    isocan command add --from <ref> --yes    # installs it

Run the first form. Post what it printed — or, if it is long, the frontmatter,
what it instructs an agent to DO, and anything that reaches outside this canvas
(network calls, shell, credentials, files outside the project). Then ask
whether to install it, and wait.

WHY THE TWO STEPS. A command's body is read as instructions by every future
agent here, with this CLI, on this canvas. Adding one is not downloading a
document, it is giving a stranger a seat at the table — and a bad one does not
misbehave now, it waits until somebody runs it. So nothing lands unread. If
they tell you to skip the reading, install it and say plainly what you did not
check.

A file already on their disk is different: they wrote it or they already have
it, so \`isocan command add <name> <file>\` needs no ceremony.

AFTERWARDS: say the name, that \`/name\` now works in any composer, and that
\`isocan command rm <name>\` takes it back. If it shadows a built-in, say which
one and that removing yours gives ours back.

WHAT NOT TO DO: do not add several at once "to be helpful", and do not add
anything they did not ask for. A canvas whose menu is forty commands nobody
chose is worse than one with eight.`,
  },
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
    description: "A relentless interview that ends in a spec, not a vibe",
    usage: "[what you want to build]",
    source: "built-in",
    body: `Interview them until nothing is left silently assumed, then write the spec.

The procedure is Matt Pocock's \`grilling\` skill (github.com/mattpocock/skills,
MIT), adapted to a canvas thread. If you already have that skill, use it and
apply the thread notes at the bottom.

THE TREE AND THE FRONTIER. Map the work as a design tree: every decision
branches into the decisions that hang off it. The FRONTIER is every decision
whose prerequisites are already settled — the questions you can ask NOW without
guessing at answers you have not heard. A question whose answer depends on
another question still open belongs to a LATER round, not this one.

WORK IN ROUNDS. Ask the WHOLE frontier in one comment, numbered, each with your
recommended answer:

    ❓ **Q1** — **<title>**: <the question, with options where there are any>

    ➡️ <what you would do, and why in one line>

    ---

    ❓ **Q2** — **<title>**: …

Then \`isocan wait --timeout 900\` and stop. Their answers reshape the tree:
settled decisions push the frontier outward and unblock what depended on them.
Recompute and ask the next round.

FINDING FACTS IS YOUR JOB, NEVER THEIRS. If a question needs something the
canvas can answer — what is already built, what a screen does, what the house
style says — go and look: \`isocan ls\`, \`isocan get\`, \`isocan style\`,
\`isocan activity\`. Asking somebody what is on their own canvas wastes the one
thing this costs, which is their attention. The DECISIONS are theirs; put each
one to them and wait.

ON A CANVAS, TWO CHANGES TO THE ABOVE:
- One comment per ROUND, not per question. Every round costs them a trip back
  to the thread, and every wait costs you a turn.
- Say where you are: "Round 2 of about 4" costs nothing and tells them how long
  this is.

DONE IS AN EMPTY FRONTIER. Then write the spec as an item —
\`isocan add spec.md --title "<what it is> — spec" --prop parent=<the screen
it is about, if there is one>\` — covering what is being built and for whom,
every decision they made and WHY in their own words, what is explicitly out of
scope, and what is still open. Reply with #the-spec and the one thing to do
first.

Do not start building until they confirm you have understood the same thing.
The value is in the decisions, not the prose: a spec that says "clean, modern"
recorded nothing.`,
  },
];
