---
status: designed
since: 2026-09-11
see: workbench, modules, multiuser, embed
note: registration seed — extends docs/research/2026-09-04-modules.md and Issue #141 with hosted static page snapshots (MHTML/PDF) as ordinary content-addressed items; P2 deferred/backlog, not implemented
---

# Shared static page snapshots

**11 September 2026.** Track registration (8cr). Thin on purpose: registers
the static snapshot track in the roadmap and bounds its physical mechanisms.
Status is **P2 deferred / backlog** (Paul Kinlan directive); this registration
activates no implementation.

The thesis in one line: **a static page snapshot is an ordinary
content-addressed item whose blob is MHTML or PDF, carrying visible provenance
and rendering in an isolated frame without new operations, new item kinds, or
new relay servers.**

---

## 1. What it extends: ordinary items, not new kinds

Static snapshots build upon the existing `@isocan/core` item and blob storage
substrate, referencing the archival discussion in
[`docs/research/2026-09-04-modules.md`](../../research/2026-09-04-modules.md)
and the hosting model of
[`docs/research/2026-08-26-attaching-a-directory.md`](../../research/2026-08-26-attaching-a-directory.md)
(Issue #141):

- **Standard MIME blobs**: Snapshots are stored as ordinary binary blobs wearing
  `multipart/related` (MHTML) or `application/pdf` (PDF), mapped via
  `packages/core/src/filenames.ts`.
- **Zero new operations**: Saving a snapshot emits standard `item.add`. Re-capturing
  a page over time emits `item.addVersion`, preserving the visual and textual
  chronology of the site in the version stack.
- **Hosting is existing blob serving**: Blobs are served by the home daemon via
  content hash (`/api/blob/:hash`). No secondary relay role or snapshot server
  is introduced. Cross-machine access on hosted canvases shares the exact same
  remote-serving gap identified in Issue #141.
- **Drag-and-drop ingestion overlap with Track D**: Importing a downloaded
  `.mhtml` or `.pdf` file via canvas drop reuses the same file ingestion path
  designed for Track D (`isocan-pa5`) collections.

---

## 2. Capture architecture: reusing the CDP substrate

Rather than introducing an unverified secondary capture tool, snapshots reuse
the Chrome DevTools Protocol (CDP) substrate established in
`chrome-agent-platform` (CAP) and Track C (`isocan-chf`):

1. **MHTML Snapshot**: Captured via CDP `Page.captureSnapshot({ format: "mhtml" })`.
   Yields a self-contained RFC 2557 MIME archive containing DOM, inline styles,
   and subresource images.
2. **PDF Snapshot**: Captured via CDP `Page.printToPDF({ printBackground: true })`.
   Yields an immutable print layout for documents, invoices, and long-form articles.
3. **No invented capture paths**: We distinguish formats: `Page.captureSnapshot`
   produces MHTML, not PDF; PDF generation must invoke `Page.printToPDF`.

---

## 3. Provenance, audience, and privacy boundaries

A static snapshot is a frozen copy of content someone had privileged access to:

- **Required visible item metadata**:
  - `properties.sourceUrl`: Original URL, with sensitive query tokens
    (e.g. `?token=...`, `?auth=...`, session IDs) explicitly stripped before
    storage.
  - `properties.capturedAt`: ISO 8601 capture timestamp.
  - `properties.capturedBy`: Actor identity (`actorId`, tool name).
  - **Visual Snapshot Badge**: Canvas card explicitly wears a "Static Snapshot"
    badge with capture date, ensuring viewers never mistake an archive for a
    live, interactive tab.
- **Audience & Redaction**: Capturing an authenticated intranet page, bank
  statement, or paid newsletter is a deliberate publication to the canvas's
  admitted audience. Authentication cookies, session tokens, and passwords are
  **never** captured into item metadata.
- **Sandbox & Script Isolation**: Captured MHTML contains active JavaScript.
  Serving raw MHTML directly on the application origin would risk stored XSS
  and ambient cookie access. Snapshots must be rendered inside a restricted,
  sandboxed `iframe` (or via the separate content-origin domain established in
  `docs/projects/atlas/content-origin.md`), stripping ambient network authority
  and disabling script execution.

---

## 4. Archival format research & verification

We verify the status of web packaging formats against current platform standards:

| Format | Specification Status (Verified 2026-09-11) | Evaluation for isocan Snapshots |
|---|---|---|
| **MHTML (`multipart/related`)** | RFC 2557 standard. Supported natively by Chromium CDP `Page.captureSnapshot`. | **Primary HTML snapshot carrier**. Fully self-contained single-file archive of DOM and assets. |
| **PDF (`application/pdf`)** | ISO 32000 standard. Universally viewable across all desktop/mobile browsers. | **Primary document carrier**. Ideal for articles, reports, receipts, and printable artifacts. |
| **Web Bundles (`.wbn`)** | WICG Community Group draft. **Experimental navigation support removed from Chromium in Feb 2023**; remains non-standard. | **Rejected as primary carrier**. Lack of multi-engine browser support makes it unviable for general canvas sharing. |
| **WARC / ZIM** | ISO 28500 (WARC) / open format (ZIM). Used by Internet Archive and Kiwix. | Useful for whole-domain bulk crawls, but unnecessarily heavy for individual canvas card snapshots. |

---

## 5. What is owed

The full docset (journey, design, phases), MHTML sandbox renderer, and CDP capture
tooling when this backlog track is activated by the coordinator. Nothing is built.
