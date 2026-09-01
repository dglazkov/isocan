# Start

Nothing to a canvas with an agent on it. Two minutes, two commands.

## Do I need Claude Code?

**No.** Any coding agent that reads `.agents/skills/` works — Claude Code,
and others. Claude Code just also gets a `.claude/` copy of the same file.

And if you have no agent at all, skip to [Without an agent](#without-an-agent).

## You need

Node 24.

That is the whole list.

## 1. Put the skill in your directory

```sh
npx skills add dglazkov/isocan
```

One file. It installs no daemon, creates no canvas, and starts nothing.

## 2. Tell your agent

```
use isocan
```

That is it. The agent reads the file, installs the CLI if it is missing,
starts the daemon, makes a canvas, and opens it in your browser. You pick a
name on the way in.

You should now be looking at a canvas with your agent standing on it, and a
Chat panel on the left. Type there and the agent answers.

## Without an agent

One command does the same setup by hand:

```sh
npx github:dglazkov/isocan#release setup
```

It puts `isocan` on your PATH, installs the skill, starts the daemon and opens
the app. Run it again any time; it is idempotent.

---

**That is the whole of getting started.** Everything below is for later, and
none of it is needed to have a canvas working:

* [How to use isocan](how-to.md) — now that it runs: asking for work, talking
  about it, pointing a canvas at a directory.
* [Getting started as a contributor](getting-started.md) — working *on*
  isocan rather than *with* it.
* [Develop isocan](development.md) — the full setup, and troubleshooting.
