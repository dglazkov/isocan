import { useMemo, useState } from "react";
import type { CanvasState, Item } from "@isocan/core";
import { BROWSER_MIME, isDrawingItem } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { glideToBox } from "../lib/zoomactions.ts";
import { PANEL_WIDTH } from "./MainThreadPanel.tsx";
import { openPanel } from "../lib/panels.ts";

/**
 * The files on this canvas, docked like the main thread — because every item
 * IS a file, and a canvas is a directory you happen to have arranged. It is a
 * second way into the same state, not a second copy of it: clicking a row
 * flies the canvas to that item, so the list and the surface always agree
 * about where things are.
 *
 * Grouped by kind rather than by folder: the canvas has no folders, and
 * inventing some here would be a shape the model does not have.
 */

/** Open/close the panel and remember it. The left dock holds one panel at a
 * time; opening the files puts the main thread away. */
export function openFilesPanel(projectId: string, open: boolean): void {
  openPanel(projectId, open ? "files" : null);
}

type Kind = "drawing" | "image" | "video" | "document" | "site" | "other";

const KIND_ORDER: Kind[] = ["drawing", "image", "video", "document", "site", "other"];

const KIND_LABEL: Record<Kind, string> = {
  drawing: "Drawings",
  image: "Images",
  video: "Video",
  document: "Documents",
  site: "Sites",
  other: "Files",
};

const KIND_GLYPH: Record<Kind, string> = {
  drawing: "✎",
  image: "▣",
  video: "▶",
  document: "▤",
  site: "◍",
  other: "◇",
};

function kindOf(item: Item): Kind {
  if (isDrawingItem(item)) return "drawing";
  const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0];
  const mime = current?.mimeType ?? "";
  if (mime === BROWSER_MIME) return "site";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("text/") || mime === "application/pdf") return "document";
  return "other";
}

/** Bytes as a person reads them. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Row {
  item: Item;
  filename: string;
  size: number;
  kind: Kind;
}

function rowsOf(canvas: CanvasState, filter: string): Array<[Kind, Row[]]> {
  const needle = filter.trim().toLowerCase();
  const rows: Row[] = [];
  for (const item of Object.values(canvas.items)) {
    const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0];
    if (!current) continue;
    if (
      needle !== "" &&
      !item.title.toLowerCase().includes(needle) &&
      !current.filename.toLowerCase().includes(needle)
    ) {
      continue;
    }
    rows.push({ item, filename: current.filename, size: current.size, kind: kindOf(item) });
  }
  rows.sort((a, b) => a.item.title.localeCompare(b.item.title));
  return KIND_ORDER.map((kind): [Kind, Row[]] => [kind, rows.filter((row) => row.kind === kind)]).filter(
    ([, group]) => group.length > 0,
  );
}

export function FilesPanel({ projectId }: { projectId: string }) {
  const open = useUiStore((s) => s.filesPanelOpen);
  const canvas = useCanvasStore((s) => s.canvas);
  const selected = useUiStore((s) => s.selectedItemIds);
  const [filter, setFilter] = useState("");
  const groups = useMemo(() => (canvas ? rowsOf(canvas, filter) : []), [canvas, filter]);

  if (!open || !canvas) return null;
  const total = Object.keys(canvas.items).length;

  /** A row is a way to the thing, not a copy of it: select it and fly there. */
  function goTo(item: Item) {
    const ui = useUiStore.getState();
    ui.select(item.id);
    // Fit the item in the canvas the panel leaves visible, so the thing you
    // asked for does not land underneath the list you asked from.
    glideToBox(
      { minX: item.x, minY: item.y, maxX: item.x + item.width, maxY: item.y + item.height },
      PANEL_WIDTH,
    );
  }

  return (
    <aside className="files-panel" aria-label="Files on this canvas">
      <header>
        <span className="files-glyph">▤</span>
        <b>Files</b>
        <span className="files-count">{total}</span>
        <span className="spacer" />
        <button
          className="main-close"
          title="Close"
          aria-label="Close the files panel"
          onClick={() => openFilesPanel(projectId, false)}
        >
          ✕
        </button>
      </header>
      <input
        className="files-filter text-input"
        placeholder="Filter by name…"
        value={filter}
        aria-label="Filter files"
        onChange={(e) => setFilter(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation(); // canvas shortcuts are not for this field
          if (e.key === "Escape") setFilter("");
        }}
      />
      <div className="files-scroll">
        {groups.length === 0 && (
          <div className="files-empty">{total === 0 ? "Nothing on this canvas yet." : "No matches."}</div>
        )}
        {groups.map(([kind, rows]) => (
          <section key={kind}>
            <div className="files-group">
              {KIND_LABEL[kind]}
              <i>{rows.length}</i>
            </div>
            {rows.map((row) => (
              <button
                key={row.item.id}
                className={`files-row${selected.includes(row.item.id) ? " active" : ""}`}
                onClick={() => goTo(row.item)}
                onPointerEnter={() => useUiStore.getState().setPeeked(row.item.id)}
                onPointerLeave={() => useUiStore.getState().setPeeked(null)}
                title={`${row.filename} — ${formatSize(row.size)}, ${row.item.versions.length} version${
                  row.item.versions.length === 1 ? "" : "s"
                }`}
              >
                <span className="files-kind">{KIND_GLYPH[kind]}</span>
                <span className="files-name">
                  <b>{row.item.title}</b>
                  <i>{row.filename}</i>
                </span>
                <span className="files-size">
                  {formatSize(row.size)}
                  {row.item.versions.length > 1 && <em>×{row.item.versions.length}</em>}
                </span>
              </button>
            ))}
          </section>
        ))}
      </div>
    </aside>
  );
}
