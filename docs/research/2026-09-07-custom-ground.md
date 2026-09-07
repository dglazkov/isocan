---
status: designed
since: 2026-09-07
issue: 204
see: ui-refresh
note: a custom tile is a blob named by a canvas property, and the garbage collector does not know properties name blobs — it would sweep the background within the hour. The cursor half is the interesting one and the answer is probably to choose rather than upload.
---

# A ground of your own: custom tiles, and what a custom cursor can be

**7 September 2026.** Research. Nothing built.

> "For the background feature… there should be a 'custom' setting where the
> user can set a tile and cursor and then it takes on its own?"

Two halves, and they are not equally hard. The tile is mostly plumbing with one
blocking bug to fix first. The cursor is a design question the seeded themes
already answered once, and the answer is probably not "upload one".

## The blocking finding

**The garbage collector does not know that a property can name a blob.**

`reachableHashes` (`server/src/gc.ts`) walks three things: every version of
every item, every version in the trash, and the hashes inside retained log
entries. It never looks at `canvas.properties`.

A home collects itself **on an hour's timer**. So a custom tile stored the
obvious way —

```
project.update { properties: { theme: "custom", tile: "<sha256>" } }
```

— is unreachable the moment it is set, and the canvas silently loses its
background within the hour. Nothing errors; the ground just goes.

This has to be fixed before any of the rest is worth building, and the fix
should be a **rule rather than a special case**: a named fold in core —
`blobsNamedBy(canvas)` — that gc consults alongside items and trash. Written as
"which properties name blobs" it also covers the next feature that wants one,
where teaching gc about `tile` specifically would have to be done again.

## The tile: what is already true

- **Uploading is solved.** `uploadBlob(canvasId, file, filename)` exists and is
  content-addressed.
- **Replicas are solved.** A replica that has never held the bytes streams them
  from the home on read (`server/src/content.ts`) — *"the ops replicate; the
  blobs they name do not follow on their own"* — so a custom ground appears on
  every machine without mirroring anything.
- **It needs no new op.** `project.update` carries properties, and the
  vocabulary stays at 33.

### Three things that are genuinely new

**1. Seams, and the anchor that makes them irrelevant.** A world-anchored
ground tiles forever, so a photograph that is not seamless shows a grid of its
own edges. A **pinned** ground (`themeAnchor: window`) never repeats and never
shows a seam. So the honest default for a custom image is **pinned**, with
world-anchored offered as an advanced choice for somebody who has actually made
a tile. See `docs/theme-art-prompts.md` for what that costs.

**2. Contrast, which the shipped grounds solve by fiat.** Every seeded ground
is dark on purpose — `#05060c`, `#0b2733`, `#2b2825` — so white item cards read
as objects standing on them. A user's holiday photo will not be, and the result
is a canvas where nothing is legible.

The fix should not be a warning telling somebody to be a designer. **A fixed
scrim** — a dark overlay at a set opacity between the image and the items —
makes any image safe, costs nothing, and is one rule the app applies rather
than a judgement it asks for. The seeded grounds already sit at roughly this
darkness, so the scrim is calibrated to something real.

**3. Weight.** The generated grounds cost **zero bytes**. A 3 MB tile is
downloaded by everybody on that canvas, on every cold load, forever. Worth a
stated ceiling and a stated number in the UI, not a silent cost.

## The cursor, which is the actual design question

#195 is emphatic, and it is right:

> A themed cursor must **wear the person's colour still**, or the theme quietly
> deletes the one signal that says who is who. A sheep tinted with your colour
> is delightful; a sheep that makes six people identical is a regression
> dressed as a feature.

The shipped cursors are single SVG paths filled at runtime with the viewer's
own identity colour. That constraint rules out the obvious implementation and
leaves four options:

| | What it is | Keeps identity colour | Askable of a person |
| --- | --- | --- | --- |
| **A** | No custom cursor; custom = tile only | ✅ | ✅ |
| **B** | **Choose** from a shipped library of shapes | ✅ | ✅ |
| **C** | Upload an SVG path | ✅ | ❌ "paste path data" |
| **D** | Upload an image | ❌ | ✅ |

**B is the recommendation, and it reframes the ask.** "Set a cursor" almost
certainly means *choose* one, not author one — and a library of tintable
silhouettes gives the feature away for free while keeping the rule that makes
cursors mean something. The three that ship (sparkle, fish, flag) are the start
of that library; a sheep, a rocket that actually works at 18px, a leaf, a
pencil are the obvious next ones.

It also lands the cost where it belongs: **drawing a cursor that reads at 18
pixels is hard**, and this project has the evidence — six candidates across
four sizes to get three, and a rocket that never worked because at that size a
rocket silhouette IS an arrow. Asking a user to do that is asking them to fail.

D is the one to refuse explicitly rather than leave open, because it is what
somebody will ask for. An uploaded PNG cursor cannot be tinted, so on that
canvas six people would share one pointer.

## Decisions

**D1. Fix gc first, as a rule.** `blobsNamedBy(canvas)` in core, consulted by
`reachableHashes`. Nothing else in this note is safe to build before it.

**D2. A custom ground defaults to pinned.** Seams are the failure a person
cannot debug, and pinning makes them impossible. World-anchored stays available
for a real tile.

**D3. A scrim, not a warning.** Fixed opacity, applied to custom grounds,
calibrated against the seeded grounds' darkness.

**D4. Cursors are chosen, not uploaded.** Grow the shipped library; refuse
image upload for cursors and say why in the refusal.

**D5. Both surfaces.** `isocan canvas background --tile <file>` beside the
seeded names, and `--cursor <name>` from the library. The web sets the same
properties. Otherwise it is a habit, not a feature.

**D6. State the weight.** A ceiling on tile size, and the number shown where
somebody picks the file.

## Phases

1. **`blobsNamedBy` and gc.** The blocking fix, with a test that a
   property-named blob survives a sweep. Worth doing on its own.
2. **A custom tile, pinned, with the scrim.** Upload, set two properties,
   render. The whole visible feature for the tile half.
3. **The cursor library.** Names in `themeCursor`, a picker in the Background
   submenu, and more shapes.
4. **World-anchored custom tiles.** For somebody with a real seamless tile,
   with the seam risk stated where they choose it.

## What this leaves open

- **Does a custom ground travel with an export?** `isocan export` and the
  JSON Canvas work both have a view on what a canvas "is". A ground that lives
  in a property pointing at a blob is exactly the kind of thing an exporter
  forgets.
- **Per-canvas or per-person?** Stated as per-canvas here, matching the seeded
  themes — everybody on the canvas sees the same ground. Worth noting that
  "my own background on your canvas" is a different feature and a reasonable
  want.
- **Whether the scrim should be adjustable.** Fixed is the honest start. If it
  turns out to be wrong for a whole class of image, that is evidence, not a
  reason to ship a slider first.
