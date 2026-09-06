# Teleport: moving a canvas to another home

**For somebody who has a canvas at the wrong home.** A canvas lives at the
home it was born at — this laptop, dev, production — and `isocan home` says
which one. Teleport moves an existing canvas to a different home, carrying
its whole history and the bytes with it. Afterwards the old home forwards to
the new one, so every address that worked still works.

The design reasoning, including why a canvas cannot be writable at two homes
at once, is in [the research note](research/2026-09-01-teleport.md). This
page is only how to use it. If what you want is a copy you can keep — a
backup, a repository — rather than a move, that is
[`isocan export`](isocan-export.md).

## 1. Check where the canvas lives now

```sh
isocan home
```

That prints this daemon's role, the birth default, and a table of every
canvas with its home. `isocan status` is the shorter version.

Note that `isocan home <url>` sets a *birth default*: it decides where the
NEXT canvas is created and moves nothing that already exists. Teleport is
the command that moves.

## 2. Dry run first

```sh
isocan teleport <canvas> --to https://isocan.io --dry-run
```

Nothing moves. The command reports:

* the canvas, by title and id
* the destination home
* how many operations are in the history
* how many blobs, and how many bytes, would travel

A move is not undoable by any gesture the CLI has, so seeing the shape of
the thing first is most of the confidence.

## 3. Move it

```sh
isocan teleport <canvas> --to https://isocan.io
```

Bytes go first, then the log, then the routing row, in that order. Anything
that fails before the last step leaves the canvas exactly where it was. On
success the command says the canvas now lives at the new home and that this
daemon forwards to it.

Add `--json` for the report as data instead of prose.

## What travels

**The whole history, verbatim.** The same operations, in the same order,
with the same sequence numbers and the same timestamps. Replicas and parked
agents holding a seq cursor do not notice the move happened. The bytes the
items name go with the log.

## What does not travel

The command says this on the dry run and after the real move, because the
answer does not change and somebody deciding whether to move should know
before rather than discover after.

* **Who may enter.** Grants and the canvas link are a decision about a
  PLACE, and the new home is a different place with a different operator.
  Invite people again at the new home and set its link there.
* **Names, colours and face marks.** These belong to the old home's actor
  registry, which is home-scoped and never replicates. People arrive under
  whatever name was stamped on their ops at the time.

## Two rules the command enforces

* **Only a canvas's own home can send it.** Run teleport against the daemon
  that holds the canvas, not against a replica of it.
* **It can only land at a home that does not already have it.** Moving a
  canvas onto a home that holds a copy would be a merge, and two orders of
  the same canvas is not a thing this system has an answer for.

## Before you experiment

If your birth default is `https://isocan.io`, a canvas you create "just to
test something" is created on production, on the machine other people are
using. Check `isocan home` first, and delete scratch canvases when you are
done rather than teleporting them somewhere quieter.
