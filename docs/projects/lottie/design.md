---
status: built
since: 2026-10-15
see: modules, node-focus, design-partner
note: "Built 15 Oct 2026. @isocan/lottie brings Lottie (.lottie.json) and dotLottie (.lottie) animations onto both surfaces: live deterministic SVG playback on the canvas with off-screen pause and inline Enter transport, View Focus (/i/:itemId) with frame-accurate scrubber, named markers, backdrop switcher and DevTools compatibility linter/profiler, Edit Focus (/w/:itemId) with palette remapping, DESIGN.md token binding, layer tree subtargets for Node-Anchored Chat, trim/markers, and isocan lottie inspect|palette|trim|marker|lint|poster on the CLI."
---

# Lottie Motion Animations (`@isocan/lottie`)

**15 October 2026.**

## 1. The debt it discharges

Without a dedicated module, a Bodymovin Lottie JSON file (`.lottie.json`, `application/vnd.lottie+json`) lands on an isocan canvas as raw JSON text, and a dotLottie archive (`.lottie`, `application/vnd.lottie+zip`) lands as an inert binary attachment. Yet a Lottie file is a structured vector scene graph of layers, bezier shapes, keyframes, and named state markers — the motion equivalent of an HTML screen or Mermaid diagram.

`@isocan/lottie` (`packages/modules/lottie`) adds Lottie as a removable build-time module (`docs/projects/modules/design.md`) across both the web app and the `isocan` CLI, with zero new operation types and zero external runtime bundle bloat on canvases that hold no animations.

## 2. Capability matrix & removability

| Artifact | MIME Type | Extensions | `view` | `edit` | `enter` | `file` |
| --- | --- | --- | --- | --- | --- | --- |
| Bodymovin JSON | `application/vnd.lottie+json` | `.lottie.json` | `true` | `true` | `true` | `true` |
| dotLottie archive | `application/vnd.lottie+zip` | `.lottie` | `true` | `true` | `true` | `false` |

Removing `@isocan/lottie` leaves every `.lottie.json` item readable and editable as plain JSON and every `.lottie` item downloadable as a file.

## 3. Canvas card & inline `Enter`

- **At rest:** `LottiePlayer` renders interpolated SVG frames via `renderLottieFrameSvg`, pauses automatically when scrolled off-screen (`IntersectionObserver`), respects `prefers-reduced-motion: reduce` (freezing on `lottiePosterFrame` or `ip`), and displays a quiet `duration · fps` badge.
- **Entered (`↘ Enter` / double-click):** Mounts an inline mini-transport bar at the bottom of the card (`Play/Pause`, frame scrubber, `Loop/Once` toggle, `f12/120` counter) while keeping pointer events inside the card.

## 4. `View` Focus (`/i/:itemId`) & DevTools

`LottieFocusView` provides:
- **Frame-accurate transport:** Play/Pause, `◀`/`▶` single-frame step, frame scrubber, speed presets (`0.25x`–`2x`), and loop modes (`Loop`, `Bounce`, `Once`).
- **Named state markers:** Clickable pills for every entry in `markers[]` (`cm`, `tm`, `dr`) so interactive state segments (`idle`, `hover`, `success`) can be auditioned in isolation.
- **Backdrop & wireframe toggles:** `Checker`, `Light`, `Dark`, `Surface`, plus an `Outlines` wireframe mode that strokes every vector shape path in `#0ea5e9`.
- **DevTools drawer:**
  - **Cross-Platform Compatibility Linter (`lintLottie`):** Flags After Effects expressions (`x`), Merge Paths (`mm`), 3D layers (`ddd=1`), layer effects (`ef`), masks, track mattes, and unembedded external images across `web-svg`, `thorvg`, `ios`, and `android`.
  - **Frame Complexity Sparkline (`profileLottieFrames`):** Samples active layers, bezier vertices, and masks/mattes per frame, highlighting the peak frame (`peakFrame`) and jumping to any frame on click.
  - **Embed Snippet Generator (`lottieEmbedSnippets`):** Ready-to-copy snippets for `<dotlottie-wc>`, React (`<DotLottieReact>`), iOS Swift, and Android Compose.

## 5. `Edit` Focus (`/w/:itemId`) & `DESIGN.md` binding

`LottieFocusEdit` provides:
- **Color Palette Map & `Sync to DESIGN.md`:** Extracts every distinct static and keyframed RGB fill/stroke hex color (`extractLottiePalette`), provides live color pickers (`remapLottiePalette`), and offers one-click **Sync to DESIGN.md** (`syncLottieToDesignSystem`) when a governing design system is present on the canvas.
- **Layer Tree & Node-Anchored Chat (`FocusSubtarget`):** Lists every layer (`shape`, `text`, `precomp`, `solid`, `image`, `null`) with visibility (`hd`) and `Solo` toggles, inline text editing for text layers (`ty === 5`), and click-to-anchor `FocusSubtarget` (`kind: "lottie-layer"`) so `NodeFocusChat` (`⌘J`) can target a single layer.
- **Trim, FPS & Markers:** Non-destructive `ip`, `op`, and `fr` controls (`trimLottie`), marker segment editor (`setLottieMarker` / `removeLottieMarker`), and `Set Poster` (`lottiePosterFrame` property).
- **Version stacking:** **Stack Animation Version** uploads the updated JSON via `host.putBlob` and sends `item.addVersion` in one undoable op group. Because `caps.file` is `true` for `.lottie.json`, the header's `[ Studio | Code | Split ]` switcher also lets engineers inspect and edit the raw Bodymovin JSON in CodeMirror.

## 6. CLI parity (`isocan lottie`)

Every web studio action has an exact terminal counterpart in `packages/modules/lottie/src/cli.ts`:
- `isocan lottie inspect <item>` — dimensions, fps, duration, layers, markers, and palette (`--json` supported).
- `isocan lottie palette <item> [--remap <old=new...>] [--sync-design]` — list or remap colors and stack a version.
- `isocan lottie trim <item> [--in <frame>] [--out <frame>] [--fps <n>]` — trim frames or change frame rate.
- `isocan lottie marker <item> [--add <name:frame:duration>] [--rm <name>]` — list, add, or remove named state markers.
- `isocan lottie lint <item> [--target web-svg|thorvg|ios|android]` — audit cross-platform compatibility and peak frame complexity.
- `isocan lottie poster <item> [--frame <n>] [--set-poster <n>]` — render deterministic SVG for any frame or record `lottiePosterFrame`.
