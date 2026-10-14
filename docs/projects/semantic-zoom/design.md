---
status: partial
since: 2026-10-13
see: canvas-groups
note: "The mechanism for Semantic Zoom: a per-viewer experiment flag; a fourth zoom band below the opening-words mark; summaries of text nodes, groups and areas made through the existing /api/text door, keyed by a hash of exactly what was summarised, cached at the home outside the oplog, debounced, and replaced only when the key changes; a CLI read and refresh."
---

# Semantic Zoom — design

**The debt this discharges.** `journey.md` asks for a summary wherever words
are too small to read, for text nodes, groups and areas, stored until the
content changes. This is the mechanism, and where it puts each decision.

## 1. What already exists, and is reused

- **The zoom ladder.** `zoomDecisions` (`web/src/lib/chrome.ts`) packs the
  per-item decisions into bits with hysteresis (`ZoomHeld`). A text node is
  legible above `TEXT_LEGIBLE_PX` (core `textnode.ts`); below it, since 13 Oct,
  ItemView draws the node's title as `.text-mark`, sized by `textMarkSize`.
  Groups and areas (`isAreaItem`) draw a title strip in world units and no
  zoomed-out mode at all.
- **The model door.** `POST /api/text` (core `text.ts`, server `text.ts`,
  `model-routes.ts`) is the only place the product calls a model. It already
  enforces size (64 KB), edit capability, a canvas's own home, owner-only key
  spend unless `keys.json` shares it, a 30-a-minute rate per badge, and key
  scrubbing. It carries no prompt; the caller writes one.
- **Content collection.** `groupDescendants` (core `canvas-groups.ts`) and
  `itemsIn(canvas, area)` (core `area.ts`) say what a group or an area holds;
  `excludedInAmbient` (`canvas-group-context.ts`) honours
  `properties.context === "excluded"` up the ancestor chain.
- **Experiments.** `EXPERIMENTS` in `web/src/lib/experiments.ts`: per person,
  in localStorage, toggled in Settings. Web-only today.

Nothing in isocan yet keeps a model's output as a regenerable cache. Recap,
recap-head and the context manifests are deterministic. This is the first.

## 2. The experiment

`{ id: "semantic.zoom", name: "Semantic Zoom", what: "Far away, text, groups
and areas show a short summary of what they hold." }`.

Off: nothing changes, nothing is fetched, no model is called. On: this viewer
**reads** summaries and, if they are an editor whose key may be spent, their
view may **cause** missing ones to be made. Everything Semantic Zoom adds to
the web app loads lazily behind the flag; the entry chunk gains the
experiment's row and nothing else.

## 3. When a summary shows: a fourth band

| Band | When | A text node shows | A group or area shows |
|---|---|---|---|
| Words | legible | its words | its members, title strip |
| Opening words | below `TEXT_LEGIBLE_PX` | its title, readable size (today) | as today |
| **Summary** | below legible AND the node holds more than its title | its summary, if one is cached | its summary card, if one is cached |
| Mark | too small for even a summary line | the mark | the title only |

- A text node whose body is no longer than its title has nothing to summarise
  and never asks for one; its title is already the whole thing.
- A group or an area shows its summary when its **members** are illegible:
  the median member's screen size is below the legible threshold. Drawn as a
  counter-scaled card inside the frame, under the title strip, never larger
  than the frame. One new bit, `Z_GIST`, decided in `zoomDecisions` with the
  same hysteresis rule (`holdsAtZoom`) so it does not flicker at the edge.
- With no cached summary the band falls back to the opening words (text) or
  today's strip (groups, areas). A summary is an improvement on the fallback,
  never a precondition for drawing.
- The summary is marked as one: a small "≈" before it and the words "Summary
  of" in its accessible name. A screen reader hears what it is.

## 4. The key: what exactly was summarised

A summary is stored against a **content key**, a SHA-256 over:

```
prompt version · kind (text | group | area)
· for each source item, in a fixed order: item id, current version id,
  title, and for an area its x, y, w, h
```

- **Text node:** its one item.
- **Group:** `groupDescendants`, minus excluded items.
- **Area:** `itemsIn(canvas, area)` (membership by geometry, so moving a card
  in or out changes the key), minus excluded items.

Version ids are content-addressed by the blob they point at, so an edit
changes the key, a move inside a group does not, and an undo that restores a
version restores the old key and finds the old summary still cached. Bumping
the prompt version invalidates everything at once, on purpose.

This is lesson 94's shape avoided by construction: nothing is fixed at birth;
the summary is looked up by its inputs every time it is drawn.

## 5. Where summaries live: a cache at the home, not the oplog

Summaries are **derived, regenerable and nobody's act**, so they are not ops:
they would put a model's churn into undo, the timeline, `isocan log` and every
replica's history. They live beside the snapshots, which are already derived:

```
<home>/summaries/<canvasId>/<contentKey>.json
  { key, kind, sourceIds, summary, words, model, promptVersion, madeAt, madeFor }
```

- `madeFor` is the actor whose key paid, for the cost record, never shown as
  an author.
- Bounded: at most 2,000 entries per canvas, least-recently-read evicted.
  A summary nobody can reach (its key no longer current) is evictable first.
- A canvas homed elsewhere has its summaries at its home, as `/api/text`
  already forwards there.

**Read route:** `GET /api/projects/:id/summaries?keys=…` → the cached entries
for the keys asked about. View capability is enough, because a summary says
nothing a viewer could not read by zooming in, and only items the viewer can
see contribute to a key the client can compute.

**Make route:** `POST /api/projects/:id/summaries` with `{ kind, sourceId }`.
The server, not the client, collects the content and builds the prompt, so a
client cannot ask for a summary of something it cannot see or slip excluded
content in. It then goes through `/api/text`'s guards in-process: edit
capability, owner-only spend, rate, size. Over 64 KB of source, the
collector truncates by member (largest last) and says so in the prompt.

## 6. When summaries are made

- **Lazily, by being looked at.** A viewer with the flag on and the right to
  spend asks for missing summaries of what is in the summary band on their
  screen, at most four at a time, nearest the centre first.
- **Debounced.** A source changed in the last 30 s is not summarised; the
  stale summary keeps showing with a "being updated" mark until the content
  has been quiet for 30 s. Ten edits in a minute cost one summary.
- **One maker.** The server keys in-flight work by content key; a second
  request for the same key waits for the first.
- **A budget.** Per canvas, at most 60 summaries an hour across everyone,
  beyond `/api/text`'s own rate. Over it, stale summaries keep showing and
  missing ones fall back.

## 7. The prompt and the model

- One prompt per kind, versioned in core (`semanticZoomPrompt(kind, sources)`),
  tested with fixtures. The instruction: one or two sentences, at most 30
  words, what this is and what matters in it; say only what the content says;
  name people and numbers as written; no preamble.
- Images and screens are summarised from their titles and any text they
  carry, not their pixels, unless the viewer has also turned on **Semantic
  Zoom: look at pictures** (§11).
- Model: the cheapest tier the configured provider offers (a summary is a
  short, high-volume, low-stakes call), overridable with
  `ISOCAN_SUMMARY_MODEL`. `/api/text`'s own default is the most capable tier,
  which is wrong for this.
- The answer is checked: non-empty, under 60 words, plain text. Anything else
  is dropped and not cached.

## 8. Both surfaces

| Surface | What |
|---|---|
| Ops | none — a summary is not an act |
| CLI | `isocan summary <item\|group\|area>` prints the cached summary and whether it is current; `--refresh` asks for one under the same rules; `isocan ls --summaries` adds a column |
| Agent guide | a paragraph: summaries exist, are approximate, and an agent reads the words before acting on them |
| Core | the content key, the prompt, the collectors' exclusion rule, the checks |
| Web | the flag, the band, the card, the fetcher |
| Tests | key stability and change (edit, move in and out of an area, undo), exclusion, the server's guards, and a journey on a fixture canvas with a stub model |

## 9. What it costs

- **Network:** one batched GET per settled viewport change while the flag is
  on; nothing while it is off.
- **Model:** one short call per (thing × distinct content), debounced. A
  forty-note canvas seen whole for the first time is forty calls once, then
  none until something changes.
- **Entry bytes:** one experiment row.

## 10. Decided (Dion, 13 Oct 2026)

1. **Who pays: the first person who can.** The first viewer whose key may be
   spent under the key's own rules (the owner, or anyone if the key is
   shared) and who sees a missing summary causes it; everyone after reads it.
   No per-viewer keys.
2. **Text nodes: only long ones.** A note is summarised only when its body is
   longer than about 40 words; a shorter one keeps showing its opening words.
3. **Not shown without the flag.** While this is an experiment, nobody meets
   model text they did not opt into.
4. **Vision: yes, as its own setting** (§11).

Still open: should an agent's `ls` see summaries by default once this leaves
the experiment?

## 11. Looking at pictures

A second experiment row, `semantic.zoom.vision`, named **Semantic Zoom: look
at pictures**, shown in Settings only while `semantic.zoom` is on, and
meaningless without it.

- **What changes:** for a viewer with it on, an image, a screen or a group or
  area holding them is summarised from what it shows, not just its title.
  The make route takes `vision: true`; the server sends the image (a
  downscaled render, at most 1024 px on the long side, at most eight per
  group or area, largest first) alongside the text.
- **A separate summary, not a replacement.** `vision` is part of the content
  key, so a vision summary and a text-only one of the same thing are two
  cache entries. A viewer with vision on reads the vision summary when there
  is one and the text-only one meanwhile; a viewer with it off never causes
  or sees a vision summary.
- **Cost.** A vision call is roughly ten times a text one, so it has its own
  budget inside the canvas's (at most 15 an hour) and needs a provider whose
  configured model takes images; with one that does not, the row says so and
  stays off.
- **Text-only items are unchanged.** A text node's summary is the same with
  or without vision; only items with pictures get a second entry.
