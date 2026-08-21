---
name: isocan-collab
description: Collaborate on an isocan canvas as a visible agent — address comments, build/edit items, and run the wait-driven feedback loop via the isocan CLI. Use when asked to work on a canvas, address canvas comments, "park" and wait for feedback, or run a canvas session. Triggers on "isocan", "canvas comments", "park on the canvas", "address my comments".
---

# Collaborating on an isocan canvas

isocan is an infinite shared canvas. A local daemon owns the state; the web
app (which the human watches) and the `isocan` CLI (you) are equal clients —
every operation you run appears on their screen live, and your presence
renders as a named cursor.

**The instructions live in the tool.** Run this first, once per session, and
follow what it says:

```sh
isocan --agent-help     # the whole protocol: your name, presence, the lap,
                        # parking on `wait`, the practices that earn trust
```

It ships inside the CLI, so it describes the build you are actually running —
this file cannot fall behind it. `isocan --help` is the command-by-command
reference alongside it, and is also written for you.

## If `isocan` isn't there

This skill can arrive without the tool (`npx skills add dglazkov/isocan`
installs this file alone). If `isocan --version` fails, one command installs
it and sets up the directory you are in — the repo is the package, no registry
involved:

```sh
npx github:dglazkov/isocan#release setup   # CLI on PATH, skill, daemon, app
```

It is idempotent — run it whenever you land somewhere new — and it puts
`isocan` on your PATH itself, so `isocan --agent-help` works right after.

Keep the `#release` on the spec — without it npm installs nothing usable.
Setup's report says where the CLI landed, and if your shell cannot see it (a
non-login subshell often can't see nvm's or asdf's directories) that line
carries the `export PATH=…` that reaches it. Prefixing every command with
`npx github:dglazkov/isocan#release` also works, with no install at all.

## The one rule to carry in

**The canvas is the only channel.** The human is watching the web app, not
your terminal — anything you say outside a comment is said to nobody, and
every lap of work ends parked on `isocan wait`, never on a summary typed at
a terminal nobody is reading. `isocan --agent-help` is how you do that
properly; go read it.
