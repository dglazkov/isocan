---
status: partial
since: 2026-09-10
issue: 236
see: modules, context
note: reading controls, typography, outline, shared text projection and live version-specific selections built 11 September; CLI quote selection and two-browser owner/read-only acceptance included. Durable quoted comments and relative saved-file links/local image bundling added 11 September; richer editing remains separate.
---

# Markdown that reads well, and selections another person can see

**10 September 2026 research; reading and shared-selection implementation added 11 September.**

The improvement worth building is a better document reading surface with shared text attention. A selects a sentence; B sees that sentence lightly highlighted in A's identity colour, with A's name. B keeps their own selection, scroll position and viewport. Turning that attention into a durable comment is a separate, explicit act, already proposed in [#49](https://github.com/dglazkov/isocan/issues/49).

## Implementation — 11 September 2026

The first three steps now have implementation: explicit Read mode, focused
typography and heading navigation; a shared `markdown-hast-v1` projection; and
live version-specific text presence on web/CLI. The implemented projection
matches the renderer's text nodes rather than inventing visual separators:
React removes structural whitespace in tables, so cells concatenate in this
text space. Unicode offsets count code points; raw HTML stays literal text.

`session start`, then `session select <item> --quote "words" [--occurrence 2]`
shares a range for 15 seconds; `session select --clear` clears it. The CLI
retains the existing session API's permission requirements. Read-only browser
users can select using their already-admitted WebSocket presence.

Verification is reproducible with `npm run build` and
`node scripts/check-text-selection.mjs`. The live check uses two browsers with
separate owner/read-only badges plus a CLI using the test owner's badge. It
checks native selection preservation, width changes, internal scrolling,
hidden-tab/version clearing and an unchanged operation cursor. Projection tests
compare against the actual renderer across tables, nested marks, entities,
emoji/combining characters, RTL, code, raw HTML and both newline flavors.
The Chrome pan/zoom probe with 21 mounted documents recorded zero samples in
the Markdown chunk out of 997 CPU samples. This is a bounded regression probe,
not a cross-device performance guarantee.

Remaining: durable comments (#49), relative-file/asset resolution, richer
editing, and cross-browser/device acceptance. Browsers without Custom
Highlights retain named attention and Show selection rather than a fabricated
pixel overlay. The original proposal below is preserved as research, not a
claim that every later-stage idea has shipped.

## What exists

Inspected checkout source at `86cc4cbc`, with unrelated edits already underway. The probe used the checkout's installed renderer stack and stylesheet; it is not a measurement of the deployed site.

- [MarkdownBody](https://github.com/dglazkov/isocan/blob/86cc4cbc/packages/web/src/lib/markdown-body.tsx) uses react-markdown plus remark-gfm: headings, lists, tables, task lists, links and fenced code already render. Plain text remains plain. Canvas text nodes preserve authored newlines; documents use Markdown paragraph rules. The rendering stack is lazy-loaded and the body memoized; preserve both.
- [ItemView](https://github.com/dglazkov/isocan/blob/86cc4cbc/packages/web/src/components/ItemView.tsx) gives ordinary documents a `.md-view` with 13px text, 18/15/13.5px first three heading levels, 10×14px padding and internal scrolling. Contents are inert until entered. Double-click enters a document and clears the incidental browser selection; double-clicking a text node instead opens its editor. “Just select a sentence” therefore needs an explicit interaction design, especially for read-only text nodes.
- [StageEditor](https://github.com/dglazkov/isocan/blob/86cc4cbc/packages/web/src/components/StageEditor.tsx) is CodeMirror with Markdown language support. Drafts are local; saving creates `item.addVersion`. A concurrent version is retained and reported, not merged character by character. This is versioned editing, not a shared live buffer.
- [PresenceSession](https://github.com/dglazkov/isocan/blob/86cc4cbc/packages/core/src/protocol.ts) carries item IDs in `selection`, plus cursor/activity information. There is no text range. The [presence service](https://github.com/dglazkov/isocan/blob/86cc4cbc/packages/server/src/presence.ts), WebSocket parsing and client publication all need a coordinated extension.

The earlier [WYSIWYG research](https://github.com/dglazkov/isocan/blob/86cc4cbc/docs/research/2026-08-26-wysiwyg.md) correctly distinguishes editing HTML screens from a future Markdown editor. This proposal does not reopen HTML sandbox access or replace the file/version model.

## What the browser probe established

Rendered one synthetic “Acme launch review” with the installed react-markdown/remark-gfm stack and actual stylesheet, in 320px and 660px containers, each with a 480px reading viewport. It included repeated sentences, strong text, a link, an entity, task list, table, code block and long paragraph. Headless Chrome 152 on macOS; screenshot inspected.

| Observation | Result | Meaning |
| --- | --- | --- |
| Narrow document | 318px client width, 781px scroll height | This sample needs substantial internal scrolling; table columns become narrow stacks of words. |
| Wider document | 658px client width, 480px scroll height | The same content fits vertically, but the font remains 13px. Extra space alone does not create a reading typography. |
| Whole-body horizontal overflow | None in this sample | Do not claim all tables overflow. The observed cost here is wrapping and height. Long code already has its own horizontal overflow rule. |
| Heading target | No ID on the rendered h1 | The baseline renderer does not provide heading deep links. |
| Task checkbox | Disabled | It is rendered document content, not an implemented task-toggle gesture. |
| Native and simulated remote selection | Both showed “this sentence”; native selection unchanged | CSS Custom Highlights can paint another range without replacing `window.getSelection()`. |
| First phrase position | Source offset 29; DOM `textContent` offset 24 | Raw-source and rendered-text offsets are different coordinate systems even in a tiny example. |

The two widths and highlight were a local DOM experiment, **not two networked users**. It did not prove transport, reconnect, cross-browser behavior, editing synchronization, pan/zoom performance or accessibility. DOM `textContent` was used to demonstrate the mismatch, not endorsed as the canonical anchoring format.

## Improve reading before adding a new editor

Keep one Markdown renderer with surface-specific presentation, not divergent parsers.

1. **Make entering a document discoverable.** Offer a clear Read action and keyboard route. Inside Read, drag means select words; outside it, drag moves the item. Escape returns to canvas navigation. Preserve the existing text-node edit gesture while giving readers a way to select its words too.
2. **Give the focused view a reading layout.** Start a design trial around 16px type, 1.55–1.7 line height and a 60–75-character measure; these are proposed settings, not measured product requirements. Scale headings, lists and quotations coherently. A compact card remains a preview; do not enlarge every card or resize shared geometry automatically.
3. **Make long content navigable.** Show that a preview continues; offer a jump to the reading view. Add stable, duplicate-safe heading IDs and an outline using the existing document module's heading information. Keep code/table overflow local, provide code copy, and test focus and keyboard scrolling. Do not silently wrap code in ways that change its apparent structure.
4. **Resolve links in document context.** Audit relative assets, relative Markdown links and heading fragments with bound-directory versus hosted-only documents. The current URL sanitizer is not a relative-file resolver. A renderer should explain an unresolved target rather than accidentally treating it as an app route. Preserve URL safety and the existing HTML boundary.
5. **Respect the file.** Reading/highlighting must not rewrite Markdown. If task toggling is added later, source-patch the specific task and save a version on both surfaces; don't make decorative GFM checkboxes appear editable first. Add syntax highlighting, math or embedded diagrams only for demonstrated needs, behind the existing lazy boundary.

At low zoom show document-level attention (“Taylor is selecting text”), not a microscopic label pile. At readable zoom show the actual range. Entering Read must not move another person's viewport; a “Show selection” action is an explicit local choice.

## How B sees A's selection

Use the current ephemeral presence channel. Sharing a selection does not mutate a document, create an undo entry or require a CRDT.

1. A enters Read and selects within one rendered Markdown/plain-text item. Observe `selectionchange` only for that mounted reading surface. Ignore selections in Chat, unrelated controls or another document.
2. Convert the local DOM range to a shared descriptor. Send the item, displayed version/representation and canonical text range, plus direction if useful. Coalesce drag updates; trial a 10Hz ceiling and send the final/clear update immediately. This rate is a proposed starting point to measure.
3. The authenticated presence session supplies identity. Validate lengths, offsets, item membership and version/representation before accepting a descriptor. Extend both local and hosted forwarding paths; unknown optional fields should degrade to item presence on older peers.
4. B resolves the descriptor against B's copy of that exact representation. B constructs a local DOM `Range` and paints an identity-coloured CSS highlight. Different widths, scroll positions and canvas scales then use B's own layout.
5. Add a small name marker near the range when readable, plus a textual “Taylor selected …” status available on demand. Avoid announcing every drag event to assistive technology. Handle overlapping people and two sessions of one actor explicitly; colour alone is insufficient identification.
6. Clear on deselection, leaving Read, switching item/version, hiding the tab and disconnect. A session's regular heartbeat must not indefinitely preserve an old range: a selection needs its own bounded freshness rule. Do not publish selection text from an unsaved private draft.

If B is looking at another version, say “Taylor is selecting in an earlier version” and offer to open it. **Do not carry an ephemeral highlight forward by guessing.** When B scrolls away, a local indicator can offer a jump; it must not scroll B automatically.

[CSS Custom Highlights](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API) styles ranges without modifying document structure. Feature-detect it. A fallback can use locally measured [Range rectangles](https://developer.mozilla.org/en-US/docs/Web/API/Range/getClientRects) in a pointer-transparent, clipped overlay; remeasure on relevant layout/scroll changes, not by reparsing Markdown on each animation frame. If that cannot stay accurate, show item-level attention. Never broadcast A's pixel rectangles or call `removeAllRanges()` to display B's selection.

## The hard part is naming the text

A DOM path breaks when render wrappers change. Raw Markdown offsets include delimiters and URLs the reader cannot see. `innerText` depends on layout; `textContent` lacks a sufficient contract for block boundaries and generated controls. A selected string alone is ambiguous when repeated.

Define a **versioned visible-text projection in core**, shared with CLI consumers. Proposed descriptor, not an existing API:

```ts
{
  itemId, versionId, blobHash,
  textSpace: "markdown-visible-v1",
  flavor: "document", // distinguish text-node breaks and plain text
  start, end,         // half-open Unicode code-point offsets
  direction: "forward"
}
```

Specify and fixture the projection: decoded entities; inline marks excluded; link label included but destination excluded; soft/hard breaks treated according to flavor; deterministic separators between blocks, list items and table cells; code whitespace preserved; generated checkbox controls and image-only regions excluded. Define whitespace and Unicode normalization deliberately; do not use CSS wrapping or visual bidi order as text order.

The browser adapter maps DOM text-node offsets (UTF-16) to that projection, and back. Parser source positions can seed mapping, but entities, escapes and Markdown delimiters prevent a simple constant-offset conversion. The [unist position model](https://github.com/syntax-tree/unist#position) is useful metadata, not a ready-made rendered-to-source map. Share the pure projection and selector resolver, keep DOM mapping in web, and keep parser loading lazy. Measure any additional core/CLI dependency cost before choosing the parser placement.

For live selection on an immutable version, offsets plus representation identity are enough. For a durable comment, add exact quote and surrounding context plus original version provenance. [W3C Web Annotation](https://www.w3.org/TR/annotation-model/#text-quote-selector) provides the quote/position vocabulary and specifies normalized logical text and Unicode code points. An isocan selector should declare its projection rather than claim arbitrary DOM offsets are interoperable W3C positions.

This strengthens #49: resolve its persistent anchors forward only when unambiguous, verify any positional fallback against the quote, and retain the original quotation when unresolved. If the sentence repeats, do not silently choose the first match. Persistent comment creation/reanchoring belongs in the existing operation vocabulary; live attention does not.

## What not to buy yet

| Option | Fit now | Cost it introduces |
| --- | --- | --- |
| Existing renderer + presence ranges | Recommended | Projection, DOM mapping and careful interaction; preserves Markdown blobs. |
| CodeMirror collaborative editing | Later, if simultaneous source editing is required | A shared change protocol and reconciliation with version saves and agent writes. The existing editor alone does not provide that. |
| Tiptap/ProseMirror document editor | Evaluate only for a separate rich-editing request | Markdown-to-editor-model round trips, unsupported constructs, persistence and undo decisions. |
| Yjs | Useful if a shared live document is chosen | A second synchronization model and a decision about how CLI version writes enter it. Not needed to share a read selection. |

[Yjs awareness](https://docs.yjs.dev/getting-started/adding-awareness) separates transient presence from stored content. That separation is the useful precedent; isocan already has a presence service. [Yjs relative positions](https://docs.yjs.dev/api/relative-positions) track positions inside shared Yjs types as edits occur; they do not directly anchor immutable Markdown blobs. Tiptap's [current Markdown integration](https://tiptap.dev/docs/editor/markdown) is marked beta and converts through its JSON model, with documented limitations. It should pass a round-trip corpus before becoming the default editor. CodeMirror's [collaboration package](https://github.com/codemirror/collab) is another distinct editing mechanism, not a highlighting prerequisite.

## Recommended implementation order and proof

- [ ] **1. Reading pass:** explicit Read/Select entry, focused typography, preview continuation and safe overflow. Browser-test narrow/wide documents, light/dark themes, keyboard access and read-only users. Keep text nodes distinct from document cards.
- [ ] **2. Projection spike:** pure shared projection with DOM mapping and fixtures for repeated text, nested emphasis, links/entities, emoji/combining characters, RTL, code, tables, breaks and cross-block ranges. Same-version mapping must round-trip before networking.
- [ ] **3. Live selection:** add bounded presence descriptors and render local ranges. Prove two independent sessions over the real transport, with different widths, pan/zoom, scrolling, clears, reconnect, hidden tabs, overlapping selections and version changes. Neither user's native selection may be replaced; no content op may be emitted.
- [ ] **4. Durable selection comments:** deliver #49 on the same resolver, with CLI quote selection and explicit unresolved/ambiguous output. Markdown/plain text first; HTML selection reporting stays separate.
- [ ] **5. Only then assess rich or simultaneous editing** against real demand and a Markdown round-trip corpus.

For agents, expose text attention through the existing presence read/write surfaces with a named descriptor and quote-resolution helper; a CLI should be able to report “Taylor selected this passage” and deliberately point to a passage itself. A command must report ambiguity, never invent a match. These are proposed surface extensions, not currently available CLI syntax.

Regression proof must include a many-document pan/zoom trace: the existing memoization was introduced after Markdown parsing dominated canvas movement. Selection updates should touch range decorations, not parse every document. No new operation is needed for reading or presence; #49 extends the anchor contract for persistent comments. Source Markdown, versions and the HTML isolation boundary remain the authority.


## Durable discussion and relative resources — 11 September

Selecting words now offers **Comment on selection**. The existing
`thread.create` operation saves a `textAnchor` alongside the item offset:
version ID, displayed blob hash, projection flavor, Unicode-point range,
quote, and surrounding context. `thread.setAnchor` replaces or clears it in
one undoable act. The original selector is never overwritten merely because
a newer version happens to contain the passage.

A unique quote follows edits. Repeated text needs matching context; missing
or ambiguous text keeps the item pin and explains the unresolved passage.
The document highlights the opened thread's quote with CSS Highlights,
outside the native selection. Pin locations are derived from the current
rendered range and remeasured on resize and scroll; an offscreen quote falls
back to its item pin. Full-screen composition uses the same popover above the
viewer. An open comment can be moved to another selected passage. Plain text
and displayed Markdown visual faces use the same representation checks.

The CLI offers `comment add --item … --quote …`, optional `--occurrence`,
`comment anchor … --quote …`, and resolution status in `comment list --json`.
This implementation uses rendered quotes rather than Markdown source-line
numbers. It does not introduce rich-text editing or PDF selectors.

Relative Markdown links resolve against saved canvas files, using explicit
`file`/`visualFile` paths first, import `sourcePath` next, and filename last.
They open the target item's route, including a heading fragment. Duplicate,
missing or unsafe paths stay visibly unavailable. Images can use saved canvas
image blobs. CLI Markdown `add`/file `edit` also bundles local image references
into a visual face while keeping the exact source available through `get`.
Image discovery uses the Markdown parser: balanced filenames and references
work, while code examples, ordinary links and literal HTML stay untouched.
`sourcePath` is provenance, never an instruction to write a file to disk.
Browser uploads cannot inspect neighboring local files; import those assets
or use self-contained Markdown. No filesystem-reading server endpoint was
added and the content-origin boundary is unchanged.

`check-text-selection.mjs` now covers the prior presence checks plus native
browser composition, receiving the thread as a read-only user, CLI resolution,
reflow, full-screen composition, an imported PNG, missing-link treatment and
navigation to another document's heading. Core tests cover Unicode offsets,
context ambiguity, version provenance, operation undo/restore and safe path
resolution. CLI tests cover source/visual identity, edits and re-anchoring.
