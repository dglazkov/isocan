---
status: partial
since: 2026-09-02
issue: 152
see: standing-agents, on-demand
note: stages 1–3 built 2–3 Sep — the ↗ on anything with a source, `isocan gdoc add` and the Add-site dialog landing a doc's markdown as a document with source and synced, the daemon fetching for the app, `gdoc sync` stacking a version only where the doc changed, and on 3 Sep `gdoc auth`: a Drive access token on the machine for docs not shared by link, with sync asking Drive for modifiedTime first. Stage 4's live mode and stage 5's folder watch are designed and not built
---

# Google Docs on the canvas

**2 September 2026.** Research, not a build. The question, as asked: *I want
to add assets such as a Google Doc. Is the best way the Add URL / site
feature — a link to the doc, embedded and inlined, that opens a tab on hover?
How do I do this with a bunch of them? I want a home for my Google docs and
to use the canvas to organize them, an agent that keeps it up to date, and
maybe the content shown inline.*

The short version. **You can do the first half today with no new code**: a
doc that is shared by link frames inside a site item, because Google sends no
framing refusal on `/preview` or `/edit` — measured below, and the daemon's
own `frameable` check will say yes. But a live frame is the wrong *home* for
a doc: it is a window onto Google that the canvas cannot read, search, thumb,
version, or hand to an agent, and it is blank for anyone Google has not let
in. The recommendation is **one item per doc that holds two things** — the
doc's markdown, exported, as the item's version blob, and the doc's URL as a
property — so the canvas has the content (thumbnails in the lens and the
card peek, `#Title` references, versions that are the doc's history, an agent
that can read it) and the person has the link (a ↗ that opens the real doc
in a tab; "live" as a mode of the same item, not a second one). A standing
agent keeps the snapshot current from the Drive changes feed. That is the
same shape [attaching a directory](2026-08-26-attaching-a-directory.md) gave
local files: the canvas holds a copy it can render, the source stays the
source, and something watches the seam.

## What was measured

Against Google's own public sample document (the Docs API quickstart's
`195j9eDD3ccgjQRttHhJPymLJUCOUjs-jmwTrekvdjFE`), from a terminal, 2 Sep:

| Request | Answer |
| --- | --- |
| `GET …/document/d/<id>/preview` | **200**, two `Content-Security-Policy` headers, **neither carries `frame-ancestors`; no `X-Frame-Options`** — the daemon's `frameable` verdict would be *ok* |
| `GET …/document/d/<id>/edit` | Same: 200, no framing refusal |
| `GET …/document/d/<id>/export?format=md`, no credentials | **200**, the document's markdown (`Sample doc`) |

Three readings. Google does not refuse framing for Docs — the `/preview`
form is what every "embed a Google Doc" guide uses, and the headers say why
it works. A doc that is NOT shared by link answers 200 too, with a sign-in
page: `frameable` cannot tell that apart from the doc, so the honest failure
for a private doc is a Google login inside the frame, not a refusal the
canvas can explain. And the markdown export is a plain GET for a public doc,
and a Drive API call (`files.export`, MIME `text/markdown`, since July 2024)
for anything that needs a credential — with a documented 10 MB ceiling on
the exported bytes.

For keeping a copy current, Drive offers two feeds: `changes.list` from a
start page token (poll), and `changes.watch`, which POSTs to an HTTPS URL of
yours when there are changes and tells you nothing about them — you call
`changes.list` to find out. Both need OAuth for the account whose Drive it
is.

## The canvas already has most of it

| Need | Today's verb | The fit |
| --- | --- | --- |
| A doc, live, in a frame | `isocan browse <url>` — a `text/uri-list` blob in an ordinary item, an iframe in the app, the daemon's `frameable` check up front | Works for a link-shared doc's `/preview` today; the item is a window, not a copy |
| A doc's words on the canvas | `isocan add doc.md` — markdown renders natively, thumbs in the lens and the card peek, is `#Title`-addressable, is context an agent reads | The snapshot half |
| The doc changed | `isocan edit <item> doc.md` — a new version on the stack, one undo, the fan-out shows the history | The doc's revision history, as the canvas keeps it |
| Which doc this is | `properties` — `source=<url>`, the way `paper`, `board` and `sprintOf` are one property each | The link half, and what an agent syncs against |
| A home for many | areas (`isocan area new`, `--in`) and `format --in` | Sheets as folders or lanes; the board pattern, for documents |
| Something that watches | a standing agent (`isocan rc`), `isocan wait`, the nightly pattern in `scripts/` | The sync loop |
| Open the real thing | the item's titlebar (a site has ⟳ today) | One more glyph, ↗, for anything with a `source` |

Nothing here is a new op. The one thing missing from the vocabulary is a
verb that does the export-and-add in one gesture, and a convention for
`source`.

## Three ways to do it, and which

**A. The doc as a site item.** `isocan browse https://docs.google.com/document/d/<id>/preview`.
Works today for link-shared docs; add a ↗ to open the real doc in a tab and
it is the feature as first described. What it cannot do: show a thumbnail
(an iframe is opaque to the lens), be searched or referenced by content,
version, or be read by an agent — and for a private doc it shows a login.
Right for a live dashboard somebody is watching; wrong for a home for
documents.

**B. The doc as a markdown item.** An agent exports the doc and `add`s it;
on change, `edit`s a new version. The canvas has the words. What it cannot
do alone: get you to the real doc, or show the live thing.

**C. One item, both halves — recommended.** The item's blob is the markdown
export (so B's everything); `properties.source` is the doc's URL (so A's
link); the app draws a ↗ on any item with a `source`, and a "live" mode that
swaps the rendered markdown for the `/preview` frame *in the same item* —
a mode you flip, not a second item to keep in sync. `isocan gdoc add <url>`
does the export and the add in one gesture; `isocan gdoc sync` re-exports
every item with a Google `source` whose Drive `modifiedTime` moved, as new
versions. A standing agent runs the sync on a timer or on Drive's push.

C wins because the canvas is the record: the words are on it, the link is on
it, and the live view is a lens over the same thing.

## What the agent does

`isocan gdoc sync` on a schedule (the nightly pattern) or an rc parked on
Drive push notifications. Per item with a Google `source`: read Drive's
`modifiedTime` (one metadata call), compare to the item's last version's
time (a property, `synced=<iso>`), export markdown if newer, `edit` a new
version, stamp `synced`. Images: the markdown export links to Google-hosted
images that need the same credential; the sync should download them and add
them as image items beside the doc, or rewrite the links to the canvas's own
blobs — the same job [design import](2026-08-24-design-systems-and-tokens.md)
did for a design file. New docs in a watched folder: `isocan gdoc add` for
each, `--in` the sheet that folder maps to.

Credentials live on the machine that runs the agent — a Drive read-only
OAuth token in `~/.isocan`, or a service account for a Workspace — never on
the canvas. Public docs need none, which is the case to build first.

## What has to be said out loud

- **The canvas cannot keep a secret.** A doc's words, once on a canvas, are
  readable by everyone admitted to it. `gdoc add` should say so once, and a
  private doc should not be added to a canvas with a link grant on without a
  deliberate flag.
- **A frame of a private doc is a login, not an error.** The app should say
  "Google will ask you to sign in" over the frame rather than let it look
  broken; `frameable` cannot know.
- **10 MB and formatting.** Markdown export drops what markdown cannot say
  (comments, suggestions, some tables). The snapshot is for reading and
  finding, not for editing — editing happens in the doc, through the ↗.

## Recommendation, in stages

0. **Nothing.** `isocan browse <doc>/preview` for a link-shared doc works
   now; try it before anything is built.
1. **↗ on anything with a source.** `properties.source`, drawn as a
   titlebar glyph that opens a tab; `browse` sets it on site items. Small,
   general, useful beyond Google.
2. **`isocan gdoc add <url>`** — export as markdown (anonymous for public
   docs, Drive API with a local token otherwise), `add` with `source` and
   `synced`, `--in` a sheet. The web's Add-URL dialog does the same when the
   URL is a Google Doc.
3. **`isocan gdoc sync`** and a standing agent that runs it; images pulled
   into blobs.
4. **Live mode** on a doc item — the `/preview` frame in place of the
   markdown, remembered per person, never a second item.
5. **A folder as a sheet** — `isocan doc watch <folder> --in <sheet>`, the
   agent adding and syncing what appears there.

## What was built

**2 September 2026, stages 1 to 3, the anonymous half.** `core/googledoc.ts`
recognises a doc's address in every form Google writes, derives the export
and preview addresses, names the item from its first heading, and spells the
two properties — `source`, the ↗ (shared with the canvas item), and
`synced`. `isocan gdoc add <url>` fetches the anonymous markdown export and
lands it as a document with both, `--in` a sheet like anything else; the
Add-site dialog does the same when the address is a doc, through
`GET /api/docs/export`, because a browser cannot read docs.google.com across
origins and the daemon can — for an address core recognises as a doc and
nothing else. A doc that is not shared by link answers a sign-in page, which
both fetchers refuse by its content type, in words. `isocan gdoc sync`
re-exports every doc item on the canvas and lands a new version only when
the daemon's hash of the bytes changed, moving `synced` with it.

**3 September 2026, stage 3, the credentialed half.** `isocan gdoc auth`
saves a Drive access token on the machine — `~/.isocan/google.json`, mode
600, never on a canvas — after asking Drive whose it is. One fetcher
(`server/google.ts`) now serves both the CLI and the daemon's route: the
anonymous export first, so a doc shared by link spends no credential, then
`files.export` with the bearer token; a sign-in page is still a refusal,
and a refused token says how old it is, because Google's access tokens
last about an hour and that is the usual reason. With a token, `gdoc sync`
makes one `files.get` for `modifiedTime` per doc and leaves the unchanged
ones unread — the changes feed's job, done per document rather than per
Drive. An access token rather than an OAuth flow of isocan's own, on
purpose: a refresh flow is a registered Google application, a consent
screen and a review, and this stage needed to prove private docs work,
not to ship a Google integration. Not built: `changes.list`, images pulled
into blobs, live mode, the folder watch.

## Sources

- Measured 2 Sep 2026: `curl -sI` on `/preview` and `/edit`, `curl` on
  `/export?format=md`, of Google's Docs API sample document.
- [Import and export Markdown in Google Docs](https://workspaceupdates.googleblog.com/2024/07/import-and-export-markdown-in-google-docs.html) — Google Workspace Updates, July 2024.
- [Export MIME types for Google Workspace documents](https://developers.google.com/workspace/drive/api/guides/ref-export-formats) and [Method: files.export](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export) — the 10 MB ceiling and `text/markdown`.
- [Notifications for resource changes](https://developers.google.com/workspace/drive/api/guides/push) and [Retrieve changes](https://developers.google.com/drive/v3/web/manage-changes) — `changes.watch` and `changes.list`.
- [Content-Security-Policy: frame-ancestors](https://developer.mozilla.org/docs/Web/HTTP/Headers/Content-Security-Policy/frame-ancestors) and [X-Frame-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options) — what the daemon's `frameable` reads.
