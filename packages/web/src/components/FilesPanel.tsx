import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { CanvasState, Item } from "@isocan/core";
import { ITEM_KINDS, itemKind, type ItemKind } from "@isocan/core";
import { KIND_LABEL, iconKindFor } from "../lib/kinds.ts";
import { PanelResizer } from "./PanelResizer.tsx";
import { KindIcon } from "./KindIcon.tsx";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { glideToBox } from "../lib/zoomactions.ts";

import { ItemThumb } from "./ItemThumb.tsx";
import { openPanel } from "../lib/panels.ts";
import { actorNameIn, useActorNames } from "../lib/names.ts";

/**
 * The files on this canvas, docked like the main thread — because every item
 * IS a file, and a canvas is a directory you happen to have arranged. It is a
 * second way into the same state, not a second copy of it: clicking a row
 * flies the canvas to that item, so the list and the surface always agree
 * about where things are.
 *
 * Grouped by kind rather than by folder: the canvas has no folders, and
 * inventing some here would be a shape the model does not have. The kinds
 * themselves come from core, so this list and `isocan ls --kind` group the
 * canvas the same way.
 */

/** Open/close the panel and remember it. The left dock holds one panel at a
 * time; opening the files puts the main thread away. */
export function openFilesPanel(projectId: string, open: boolean): void {
  openPanel(projectId, open ? "files" : null);
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
  kind: ItemKind;
}

function rowsOf(canvas: CanvasState, filter: string): Array<[ItemKind, Row[]]> {
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
    rows.push({ item, filename: current.filename, size: current.size, kind: itemKind(item) });
  }
  rows.sort((a, b) => a.item.title.localeCompare(b.item.title));
  return ITEM_KINDS.map((kind): [ItemKind, Row[]] => [
    kind,
    rows.filter((row) => row.kind === kind),
  ]).filter(
    ([, group]) => group.length > 0,
  );
}

export function FilesPanel({ projectId }: { projectId: string }) {
  const open = useUiStore((s) => s.filesPanelOpen);
  const panelWidth = useUiStore((s) => s.panelWidth);
  const canvas = useCanvasStore((s) => s.canvas);
  const selected = useUiStore((s) => s.selectedItemIds);
  const [filter, setFilter] = useState("");
  // What the pointer is resting on, and where that row sits, so the card can
  // open beside it rather than under the pointer.
  const [peek, setPeek] = useState<{ row: Row; top: number } | null>(null);
  const groups = useMemo(() => (canvas ? rowsOf(canvas, filter) : []), [canvas, filter]);

  if (!open || !canvas) return null;
  const total = Object.keys(canvas.items).length;

  /** A row is a way to the thing, not a copy of it: select it and fly there. */
  function goTo(item: Item) {
    const ui = useUiStore.getState();
    ui.select(item.id);
    // Fit the item in the canvas the panel leaves visible, so the thing you
    // asked for does not land underneath the list you asked from.
    glideToBox({ minX: item.x, minY: item.y, maxX: item.x + item.width, maxY: item.y + item.height });
  }

  return (
    <aside className="files-panel" style={{ width: panelWidth }} aria-label="Files on this canvas">
      <PanelResizer />
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
                onPointerEnter={(e) => {
                  useUiStore.getState().setPeeked(row.item.id);
                  const rect = e.currentTarget.getBoundingClientRect();
                  setPeek({ row, top: rect.top + rect.height / 2 });
                }}
                onPointerLeave={() => {
                  useUiStore.getState().setPeeked(null);
                  setPeek((current) => (current?.row.item.id === row.item.id ? null : current));
                }}
              >
                <KindIcon className="files-kind" kind={iconKindFor(row.item)} />
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
      {peek && <FileCard projectId={projectId} row={peek.row} top={peek.top} />}
    </aside>
  );
}

/**
 * A peek at the row under the pointer, beside the panel — the same card the
 * edge radar opens off a beacon, because it answers the same question: what is
 * this thing, before I go to it.
 */
function FileCard({ projectId, row, top }: { projectId: string; row: Row; top: number }) {
  const names = useActorNames();
  const panelWidth = useUiStore((s) => s.panelWidth);
  const versions = row.item.versions.length;
  // Never off the top or bottom of the window it is meant to be read on.
  const clamped = Math.min(Math.max(top, 96), window.innerHeight - 96);
  // Portalled for the same reason ItemPeek is: this card hangs outside the
  // panel, and inside a panel's stacking context no z-index can lift it over
  // chrome that outranks the panel.
  return createPortal(
    <div className="hover-card file-card" style={{ left: panelWidth + 10, top: clamped }}>
      <ItemThumb projectId={projectId} itemId={row.item.id} />
      <div className="file-card-text">
        <b>{row.item.title}</b>
        <i>{row.filename}</i>
        <i>
          {formatSize(row.size)}
          {versions > 1 && ` · ${versions} versions`}
          {` · last edit by ${actorNameIn(names, row.item.updatedBy)}`}
        </i>
      </div>
    </div>,
    document.body,
  );
}
