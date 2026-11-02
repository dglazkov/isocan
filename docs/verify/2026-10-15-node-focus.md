---
status: unverified
since: 2026-10-15
never: Whether the top-left View / Edit / Enter action strip, kind-aware View and Edit Focus studios (Image, Design System, Wireframe, Screen), and Node-Anchored Chat (⌘J) feel natural by hand across node types.
needs: The web app in a desktop browser with a canvas holding an HTML screen, a PNG image, a DESIGN.md, and a wireframe screen — about fifteen minutes.
---

# Node Focus — View, Edit, Enter, and Node-Anchored Chat

**Status: `unverified`.**

**What you need:** a desktop browser, fifteen minutes, and a canvas containing at
least:
- one **HTML screen** (`text/html`),
- one **PNG or JPEG image**,
- one **`DESIGN.md`** design system, and
- one **wireframe screen** (you can add one with `/wire` or `isocan wire add`).

**Why this page exists.** Phases 1–6 of `node-focus` are built and verified in
Vitest: `nodeCapabilitiesFor` computes `{ view, edit, enter, file }`, the card's
top-left strip adapts per node, `/i/:itemId` and `/w/:itemId` share a unified
Focus Header (`[ View | Edit ]` + `💬 Chat (⌘J)`), and each node kind mounts its
own View and Edit studio. None of those unit tests can judge whether the
counter-scaled top-left strip feels comfortable to aim at across zoom levels,
whether switching between `[ Studio | Code | Split ]` feels fluid, or whether
chatting with an agent anchored to a specific node subtarget feels clear.

---

## 1. The top-left action strip & right-click menu: Screen vs. Image

Click once on an **HTML screen** card on the canvas (do not double-click). Look
at the top-left corner of the selected card and right-click it, then do the same
on a **PNG image** card and compare.

**You should see:**
- On the **HTML screen**, four icons along the top-left strip and four matching
  rows in the right-click menu:
  `⤢` **View** (`Enter`), `✎` **Edit** (`E`), `↘` **Enter** (`Double-click`),
  and `⊡` **Fit** (`F`).
- On the **PNG image**, only **`View`**, **`Edit`**, and **`Fit`** — no
  `↘ Enter`, because a static image has nothing to interact with inside its card.
- Zoom out (`⌘-`) and zoom in (`⌘+`): the top-left icon strip stays crisp and
  clickable at a constant screen size (`COUNTER_SCALED_CSS`).

**If `↘ Enter` appears on a static image, or the icons scale down into tiny dots
when zoomed out,** note the node kind and zoom level.

## 2. Image View Focus & Image Edit Studio

Select the **PNG image** and click `⤢` **View** (or press `Enter`).

**You should see:**
- **View Focus (`/p/:canvas/i/:item`)**: a lightbox with `Fit`, `1:1`, zoom
  slider, and an **Alpha checkerboard** toggle, beside a **Metadata Inspector**
  showing pixel dimensions, aspect ratio, MIME type, byte size, SHA-256 hash
  (with a copy button), author/timestamp, any embedded PNG `tEXt` / EXIF tags,
  and **Where Used** backlinks if any HTML or Markdown item on the canvas
  references the image.

Now click **`Edit`** in the top header's **`[ View | Edit ]`** switch (or press
`Escape` back to the canvas and press `E`).

**You should see:**
- **Edit Focus (`/p/:canvas/w/:item`)**: the **Image Studio** opens with crop
  aspect presets (`Free`, `1:1`, `16:9`, `4:3`), `90°` rotate / flip buttons,
  markup pen, and alt-text fields — and **no CodeMirror code editor** in the
  header (`[ Studio | Code | Split ]` is hidden because a PNG has `file: false`).
- Choose a crop aspect (e.g. `1:1` or `16:9`), click **Apply edit (stack
  version)**, and verify the version pill increments (`v2`) and `⌘Z` on the
  canvas undoes it in one step.

## 3. Node-Anchored Chat (`⌘J`) & Subtarget Pills

While still in **Edit Focus** (`/w/:itemId`), press **`⌘J`** (or click **`💬 Chat`**
in the top-right of the Focus Header).

**You should see:**
- A **Node-Anchored Chat** drawer on the right listing only threads anchored to
  this item (`anchorItemId = item.id`), starter prompt chips (e.g. *"Remove
  background"*, *"Generate 3 variations"* on an image), and a composer that says
  messages stay attached to this node.
- Send a test comment in the drawer, then click **`← Canvas`** (`Escape`): the
  comment pin appears anchored directly to that node on the canvas.

## 4. Design System Focus (`DESIGN.md`)

Select a **`DESIGN.md`** node on the canvas and click `⤢` **View**, then switch
to `✎` **Edit**.

**You should see:**
- **View Focus**: the full specimen sheet followed by a **Governed Screens
  Matrix** showing live `design check` status for screens on the canvas.
- **Edit Focus**: because `DESIGN.md` is both a structured design system and a
  Markdown file (`file: true`), the header shows **`[ Studio | Code | Split ]`**.
  In **Studio** (or **Split**), tweak a color swatch in the **Token & Direction
  Studio**: live WCAG AA contrast badges update immediately, and clicking a
  token row attaches a `📍 Token` subtarget pill in the `⌘J` chat composer.

## 5. Wireframe Composer Studio (`@isocan/wireframe`)

Select a **wireframe screen** on the canvas and press **`E`** (or click `✎`
**Edit**).

**You should see:**
- **Wireframe Composer Studio**: a top bar with archetype, layout template, and
  density (`compact` / `comfortable` / `spacious`), the live interactive
  wireframe stage in the center, and a slot inspector on the right.
- Click any `[data-wf]` block on the wireframe stage: the right rail highlights
  that slot and lets you swap it with another component from the 53-component
  catalog, toggle bar emphasis or pattern fills (`dots`, `stripes`, `grid`,
  `hatch`), or edit its copy/intent — stacking a clean new `ItemVersion` while
  keeping its embedded `WireSpec` intact.
- Open `⌘J` Chat while a slot is selected: a **`📍 Slot`** pill appears above the
  composer so an agent prompt targets that exact wireframe section.

## 6. HTML Screen Studio (`text/html`)

Select a non-wireframe **HTML screen** and press **`E`**.

**You should see:**
- Responsive viewport presets (`390` Mobile / `768` Tablet / `1440` Desktop /
  `Fit`), **`[ Studio | Code | Split ]`** switching cleanly between visual copy
  / element inspection and CodeMirror (`StageEditor`), and the **`Pick element
  for Chat`** button that captures any clicked DOM element as a `📍 Element`
  subtarget pill in Node-Anchored Chat.
