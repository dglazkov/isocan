## Documents

A document is a markdown or text file somebody brought or wrote as prose —
not a caption, a post-it or a speaker note, and not the design system. The
canvas can already show and edit one; this module adds ways to READ them:

- `isocan docs ls` — every document on the canvas with its words, minutes
  and heading count, newest edit first. The Documents page in the app
  (`isocan open --page docs`) is the same list.
- `isocan docs outline <item>` — the headings, indented by level, each with
  the line it starts on. The app shows the same outline beside the stage in
  the workbench whenever a document is open there.

Two slash commands ride with it, for you to carry out: `/outline` posts a
document's outline as a comment on it (with its size; if it has no headings,
propose three), and `/summarize [in <n> words]` posts a summary in the
document's own words, leading with what it decides or asks. Neither edits
the document — a summary that replaces its source is a deletion. Documents
are a module (`@isocan/documents`): a home without it still shows and edits
every document, and only these readings and commands are gone.
