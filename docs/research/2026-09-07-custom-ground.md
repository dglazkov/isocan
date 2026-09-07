---
status: partial
since: 2026-09-07
issue: 204
see: ui-refresh
note: a custom tile is a blob named by a canvas property, and the garbage collector does not know properties name blobs — it would sweep the background within the hour. The cursor half is the interesting one and the answer is probably to choose rather than upload.
---

# A ground of your own: custom tiles, and what a custom cursor can be

**7 September 2026.** Research. **Phase 1 is built** — the gc fix below,
which had to come first; the rest is designed and unstarted.

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

**Fixed 7 Sep 2026, before the feature rather than after the bug report:**
`blobsInProperties` in `core/src/blobrefs.ts`, consulted by `reachableHashes`.
It matches by SHAPE — a 64-character hex string in any property value — rather
than by a list of blessed keys, because a list is a second thing to keep right
and its failure is silent.

Two notes from building it.

**It takes the whole `CanvasState`, not `CanvasContents`.** A canvas's own
properties live on the RECORD (`state.project`); the contents carry only items,
threads and trash. A signature over the contents could not have seen the thing
it exists for — the same distinction that made the themed cursor read
`s.project` rather than `s.canvas`.

**And `export.ts` got there first, on the other surface.** `blobsNamedBy(log)`
finds every blob the LOG names, *"by shape rather than by op type… so a new op
that names bytes is backed up the day it ships rather than the day somebody
remembers this."* The same argument, made earlier, for backup instead of
sweeping. Two surfaces name blobs and both are now matched by shape; the names
are kept apart because a caller wanting one would be badly served by the
other.

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

**D1. Fix gc first, as a rule.** ✅ Done 7 Sep — `blobsInProperties` in
`core/src/blobrefs.ts`, with a test that a property-named blob survives a real
sweep at `graceMs: 0`, and is swept once the property lets go.

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

1. ~~**`blobsNamedBy` and gc.**~~ ✅ Done 7 Sep as `blobsInProperties`.
2. ~~**A custom tile, pinned, with the scrim.**~~ ✅ Done 7 Sep — and it is
   **one** property, not two. See below.
3. **The cursor library.** Names in `themeCursor`, a picker in the Background
   submenu, and more shapes.
4. **World-anchored custom tiles.** For somebody with a real seamless tile,
   with the seam risk stated where they choose it.

## What phase 2 actually shipped, where it differs from the plan

**7 September 2026.** `isocan canvas background --picture <file>`, and
`Background > A picture of yours…` in the app. Three departures, each because
building it said something the plan could not.

**`ground`, not `tile`.** A pinned ground does not repeat, so for the whole of
this phase the picture is a backdrop drawn once and `cover` — and a key called
`tile` promises repetition only phase 4 delivers. `ground` is the word every
sentence about this feature already uses, and it stays true when phase 4 makes
it actually tile.

**One property, not two.** D2 says a custom ground defaults to pinned, and the
first build wrote `themeAnchor: window` beside the hash to say so. That is a
fact about the picture written down as a fact about the CANVAS, and it outlives
the picture: set a picture, then choose Space Galaxy, and the galaxy was pinned
— by a choice nobody made, that nothing said, and that could only be undone by
unticking something you never ticked. Found by running the two commands in a
row and reading the properties back. The pinning now lives in `groundIsPlace`,
which is also the single function phase 4 changes.

**The scrim's derivation was wrong and the number was right.** D3 says fixed
opacity calibrated against the seeded grounds. It shipped as 0.7 with an
argument that 0.7 is the 3:1 minimum — which treats an sRGB value as a relative
luminance. Run properly, 3:1 is met at **0.42**; 0.7 is a choice past the floor,
because a floor is not a design and at 0.42 a busy photograph still competes
with the work standing on it. Measured on a deliberately near-white photograph:
the ground went 246 → 74 (ratio 0.301 against the 0.3 the overlay promises) and
a white card reads 8.9:1. The lesson is the shape rather than the arithmetic —
**the number was right and its reason was not**, which is the more dangerous
half, and only a measurement separates them.

**And one thing found in passing, which is #195's and not this note's:** the
dot grid does NOT come back under a pinned ground, though `THEME_ANCHOR_PROP`'s
comment says it does. The dots are the viewport's `background-image` and every
ground is an opaque child element covering it, so they are painted and then
hidden — for the seeded grounds as much as for a picture. Nothing here depends
on it (a picture is not a place because it does not pan), but the claim is on
`main` and is false.

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
