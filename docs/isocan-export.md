# Export: backing a canvas up

**For somebody who wants a copy they can keep.** `isocan export` writes a
canvas to a directory: its whole history, every file it names, and a note
saying where it came from. That directory is the canvas — with no daemon
involved — and `isocan import` hands it back to a home, history intact.
[Teleport](isocan-teleport.md) is the other verb: it *moves* a canvas and
leaves nothing behind but a signpost. Export copies, and leaves the canvas
exactly where it was.

## 1. Back up the canvas you are in

```sh
isocan export --to ./isocan-backup --dry-run    # what would be written
isocan export --to ./isocan-backup              # write it
```

With no target it takes this directory's canvas, the way every other command
does. `--to` defaults to `./isocan-backup`. Running it again over the same
directory is cheap: blobs are content-addressed, so only new bytes are
fetched, and the log is rewritten whole.

## 2. Point it at something else

A target can be a canvas ref, or an address:

```sh
isocan export "Moving Day" --to ./backup                       # a canvas here, by id or title
isocan export https://isocan.io/p/<id> --to ./backup           # a canvas at any home you may see
isocan export https://isocan.io/p/<id>/i/<item> --to ./backup  # one item
isocan export <canvas> --item <ref> --to ./backup              # the same, by ref
isocan export https://isocan.io --to ./backup                  # every canvas you may see there
isocan export --all --to ./backup                              # every canvas at this daemon
```

An address is read at the home it names, on the badge that home's door hands
this machine. If you can open the canvas, you can back it up; it does not
need to be replicated here. A home address has to carry its scheme
(`https://…`), so a canvas whose title happens to contain a dot is still a
ref.

## 3. What is written

```
isocan-backup/
  manifest.json              what, from where, when, by whom — and what was missing
  names.json                 the home's current names and colours, for reference
  projects/<canvasId>/
    project.json             the canvas record
    canvas.json              the folded snapshot (derived — a convenience)
    trash.json               what was deleted
    oplog.jsonl              the WHOLE history, one operation per line, seq order
    blobs.json               hash → file, type, name, size
    blobs/<hash>.<ext>       the bytes
  items/<canvasId>/<itemId>/ (only for an item export)
    item.json                the item and its version stack
    ops.jsonl                every operation that names it
    threads.json             comment threads pinned to it
    versions/01-<name>       each version's bytes, oldest first
```

The layout under `projects/` is the same one the daemon keeps in
`~/.isocan/projects/`, on purpose. The one difference is that the export's
`oplog.jsonl` holds everything, including what `gc` compacted into the
daemon's archive file. So the least clever restore of all also works: stop
the daemon and copy the directory in.

`manifest.json` lists any blobs the history names that the home no longer
had, under `missing`. An export that says where its holes are is a backup.
One that did not would only look like one.

`isocan export --jsoncanvas <file>` is a different thing: it writes the
canvas as a [JSON Canvas](https://jsoncanvas.org) file for Obsidian and the
tools that read that format. It carries no history, no versions and no
threads, and its own output says "this is not a backup". Use it to hand a
canvas to another tool, and this page's export to keep one.

## 4. Back it up to git

```sh
isocan export --to ./isocan-backup --commit                 # commit into the repo at --to
isocan export --to ./isocan-backup --git dion/canvas-backups   # commit and push
```

`--commit` commits into whatever repository `--to` sits in, and makes one if
there is none. `--git <remote>` does that and pushes: `owner/name` means a
GitHub repository, and any git URL is passed through as typed. The first run
sets `origin`; a later run against a different remote is refused by name
rather than silently re-pointed.

Only what the export wrote is staged, never `git add -A`. So `--to .` inside
a project's own repository keeps a backup beside the code without sweeping
unrelated changes into the commit.

**A canvas is not public until you push it somewhere public.** An export
holds every version of every file and every comment ever written. Use a
private repository, and never one whose address is posted next to a pass or
a share link.

A nightly backup is one cron line:

```
15 3 * * * cd ~/work/project && isocan export --to ~/backups/project --git me/project-backups
```

## 5. Restore

```sh
isocan import ./isocan-backup --dry-run        # what would be restored
isocan import ./isocan-backup                  # into this machine's daemon
isocan import ./isocan-backup --to https://isocan.io   # into another home
isocan import ./isocan-backup --only <canvasId>        # one canvas from a home export
```

The history goes back verbatim, the same seqs and the same timestamps,
through the route a teleport arrives by. Then the bytes follow. A restore
**creates and never merges**: a canvas the home already holds is refused,
per canvas, and the rest of the export still restores. Merging two orders of
one canvas is not something this system does; if the canvas is already
there, what you want is `isocan tail --archived` on it, not a restore over it.

The person who runs the restore is admitted to what they restored, as the
creator of a new canvas is. Two things do not come back, and the command
says so:

- **Who may enter.** Grants are a decision about a place. Run `isocan share`
  at the restored canvas to set its link and invite people.
- **Names, colours and face marks.** These belong to a home's registry and
  never travel; `names.json` in the export is for reading, not restoring.
  People appear under whatever name was stamped on their ops.

The desk itself, badges, passes and the secrets behind them, is never
exported. A backup carries the canvas, not the keys to the building.

## What it is for

- **A canvas that exists in one place.** A laptop's local canvas has one
  copy. `isocan export --git` makes a second one that is not on the laptop.
- **Before a teleport, or a `trash empty --force`.** Neither is undoable.
  A dry run says what would move; an export keeps what was there.
- **Reading a canvas without isocan.** `oplog.jsonl` is one JSON operation
  per line and `blobs/` is the files. `jq` and `ls` are enough.
- **Moving a canvas by hand** between two homes that cannot reach each other:
  export at one, carry the directory, import at the other.
