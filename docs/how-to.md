# How to use isocan

From nothing to working with an agent on a canvas. Five minutes.

## 1. Give your agent the skill

In the directory you want to work in:

```sh
npx skills add dglazkov/isocan
```

That is the doorway and nothing else — one file telling your agent what
isocan is and how to get the rest. It installs no daemon and creates no
canvas.

*Any agent that reads `.agents/skills/` works. Claude Code also gets a
`.claude/` copy.*

## 2. Start your agent and say it

```
use isocan
```

The agent reads the skill, installs the CLI if it is missing, starts the
local daemon, makes a canvas, and opens it in your browser. You pick a name
on the way in — that name is stamped on everything you do.

*Already have the CLI and want to skip the agent? `npx
github:dglazkov/isocan#release setup` does the same setup by hand.*

## 3. Ask for something

Type in the **CHAT** panel on the left. Everything there reaches every
collaborator, agents included, with no @-mention needed — that is what makes
it different from a comment pinned to one thing.

> Build me three versions of a landing page hero.

The agent works on the canvas while you watch: its cursor moves, items
appear, and it says what it is doing as it goes. When it finishes it replies
on the thread and **parks** — blocked, waiting for your next word. It is not
gone; it is listening.

## 4. Talk about the work

- **Comment on a thing.** Select an item, press <kbd>⇧C</kbd>. The pin hangs
  off its top-right corner. Press <kbd>⇧C</kbd> again to reopen that same
  conversation rather than starting a second.
- **Point at things.** `#Title` in any message becomes a chip that flies the
  reader to that item. `@Name` addresses someone — an agent wakes on it.
- **React.** Select an item; a `+` appears under it.

An agent parked on `wait` wakes on anything addressed to it and picks the
work back up. You do not restart it.

## 5. Look closer

| key | does |
| --- | --- |
| <kbd>Enter</kbd> | the selected item, full screen — preview only |
| <kbd>W</kbd> | the **workbench** — agents, files, chat, and the item with its editor |
| <kbd>Esc</kbd> | back out, one layer at a time |
| <kbd>F</kbd> | fit the selection · <kbd>⇧1</kbd> fit everything |
| <kbd>?</kbd> | every key |

On the workbench the seam between the editor and the preview drags, as does
the edge of the left column.

## 6. Edit without touching HTML

On a screen's preview, press **Edit text** — double-click any text, type,
press <kbd>Enter</kbd>. Save lands a new version; the old one is still in the
stack. Anything the edit cannot place exactly is refused with a sentence
rather than guessed at.

Every save is a **version**, never an overwrite. Press <kbd>S</kbd> on an item
to fan its history out.

## 7. Point the canvas at a directory (optional)

If the canvas is about a project on your disk, bind it — then the workbench's
**FILES** section lists that directory, and `＋` carries a file onto the
canvas.

```sh
isocan use <canvas>     # in the project directory
```

Or in the workbench: paste the path into the FILES section, or press `…` to
browse.

**Items can be files.** A screen an agent runs up to answer "let me see"
should stay on the canvas; a screen that is a new part of the project can be
written out:

```sh
isocan set <item> --file src/views/start.html   # where it belongs
isocan save <item>                              # write it there
```

A mark on the item says whether the file is written, missing, or **drifted**
— changed on disk since anything the canvas wrote. Drift is refused, not
overwritten.

## 8. Work from the terminal too

Everything you can click, you can type. The CLI is the same canvas:

```sh
isocan ls                     # what is on it
isocan add ./hero.html        # put something on it
isocan comment add "…" --item <item>
isocan open --workbench       # open it in the browser
isocan recap                  # the whole history, summarized
```

`isocan --help` for the rest, `isocan --agent-help` for the guide agents
read.

## Where things live

- **Your canvases** are held by a daemon on your machine, or by
  **isocan.io** if that is where they were born. `isocan status` says which.
- **Nothing on disk is touched** unless you bind a directory and save an
  item to it.
- **A share link** invites a person: `isocan share`. A `pass` is for another
  MACHINE of your own — never post one.

## When something is wrong

| | |
| --- | --- |
| the app looks stale | `isocan restart` |
| "no directory is bound" | bind one (step 7) — the canvas works fine without |
| an agent seems asleep | it is parked; say something that names it |
| you broke something | <kbd>⌘Z</kbd> — undo is per-person, never a collaborator's |
