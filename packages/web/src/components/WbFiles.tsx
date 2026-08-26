import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Actor } from "@isocan/core";
import { workbenchItemPath } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { screenToWorld } from "../lib/viewport.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { addFiles } from "../lib/upload.ts";
import { SectionResizer, useSectionHeight } from "./SectionResizer.tsx";
import { goStage } from "../lib/goStage.ts";
import { ItemPeek } from "./ItemThumb.tsx";

/**
 * The bound directory, listed — the workbench's files pane.
 *
 * The tree comes from the canvas's own local daemon and only there: the
 * `/tree` route is owner-scoped (loopback + local-home + a verified binding
 * — `server/tree.ts` has the rules and the jail), so on somebody else's
 * canvas, or a hosted one, this pane says where the files live instead of
 * pretending. The CLI's `isocan tree` prints the same listing from the same
 * route: one derivation, two surfaces.
 *
 * **A file here is not yet shared.** The listing is names; the line between
 * "on my disk" and "on the canvas" is crossed only by the ＋, which pulls
 * the file's bytes through the owner-scoped read route and adds them
 * through the ordinary upload + `item.add` path — the same op a drag onto
 * the canvas or an `isocan add` sends, attributed to you like either. A
 * file that already IS an item (matched by its current filename) opens on
 * the stage instead.
 */

interface TreeEntry {
  path: string;
  kind: "file" | "dir";
  size: number;
}

type TreeState =
  | { state: "loading" }
  | { state: "none"; note: string }
  | { state: "ready"; root: string; entries: TreeEntry[]; truncated: boolean };

export function WbFiles({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const navigate = useNavigate();
  const canvas = useCanvasStore((s) => s.canvas);
  const [tree, setTree] = useState<TreeState>({ state: "loading" });
  const [filesH, setFilesH] = useSectionHeight("isocan.wb.files.h", 180);
  const [adding, setAdding] = useState<string | null>(null);
  // The row under the pointer, when it IS an item — hovering a filename peeks
  // the thing itself, the same card the canvas files panel and the edge radar
  // open, at a position measured on entry (the roster's peek pattern:
  // position-fixed via the portal, so the section's scroll box cannot clip it).
  const [peek, setPeek] = useState<{ itemId: string; x: number; y: number } | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const res = await fetch(`/api/projects/${canvasId}/tree`);
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          if (live) {
            setTree({
              state: "none",
              note: body?.error ?? "this canvas has no bound directory here",
            });
          }
          return;
        }
        const { roots } = (await res.json()) as {
          roots: Array<{ root: string; entries: TreeEntry[]; truncated: boolean }>;
        };
        const first = roots[0];
        if (live) {
          setTree(
            first
              ? { state: "ready", ...first }
              : { state: "none", note: "no directory is bound to this canvas here" },
          );
        }
      } catch {
        if (live) setTree({ state: "none", note: "the tree could not be read" });
      }
    })();
    return () => {
      live = false;
    };
  }, [canvasId]);

  // File → item, by the item's CURRENT filename. First match wins; two items
  // sharing a filename is a canvas question, not this pane's.
  const itemByFile = useMemo(() => {
    const map = new Map<string, string>();
    if (!canvas) return map;
    for (const item of Object.values(canvas.items)) {
      const current = item.versions.find((v) => v.id === item.currentVersionId);
      const name = current?.filename;
      if (name && !map.has(name)) map.set(name, item.id);
    }
    return map;
  }, [canvas]);

  async function add(entry: TreeEntry) {
    if (adding) return;
    setAdding(entry.path);
    try {
      const res = await fetch(
        `/api/projects/${canvasId}/tree/file?path=${encodeURIComponent(entry.path)}`,
      );
      if (!res.ok) return;
      const bytes = await res.arrayBuffer();
      const name = entry.path.split("/").pop()!;
      const { viewport } = useUiStore.getState();
      const ids = await addFiles(
        canvasId,
        actor,
        [new File([bytes], name)],
        screenToWorld(viewport, window.innerWidth / 2, window.innerHeight / 2),
      );
      if (ids[0]) goStage(navigate, workbenchItemPath(canvasId, ids[0]));
    } finally {
      setAdding(null);
    }
  }

  return (
    <section className="wb-files" aria-label="Files" style={{ maxHeight: filesH }}>
      <h3>Files</h3>
      {tree.state === "loading" && <p className="wb-quiet">Reading the tree…</p>}
      {tree.state === "none" && <p className="wb-quiet">{tree.note}</p>}
      {tree.state === "ready" && (
        <ul className="wb-tree">
          {tree.entries.map((entry) => {
            const name = entry.path.split("/").pop()!;
            const depth = entry.path.split("/").length - 1;
            const itemId = entry.kind === "file" ? itemByFile.get(name) : undefined;
            return (
              <li key={entry.path} style={{ paddingLeft: depth * 12 }}>
                {entry.kind === "dir" ? (
                  <span className="wb-tree-dir">{name}/</span>
                ) : itemId ? (
                  <button
                    className="wb-tree-file on-canvas"
                    title="On the canvas — open it on the stage"
                    onClick={() => goStage(navigate, workbenchItemPath(canvasId, itemId))}
                    onPointerEnter={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setPeek({ itemId, x: r.right + 10, y: r.top });
                    }}
                    onPointerLeave={() => setPeek(null)}
                  >
                    {name}
                  </button>
                ) : (
                  <span className="wb-tree-file">
                    {name}
                    <button
                      className="wb-tree-add"
                      disabled={adding !== null}
                      title="Add this file to the canvas — until then it is only on this disk"
                      onClick={() => void add(entry)}
                    >
                      {adding === entry.path ? "…" : "＋"}
                    </button>
                  </span>
                )}
              </li>
            );
          })}
          {tree.truncated && <li className="wb-quiet">… truncated</li>}
        </ul>
      )}
      <SectionResizer value={filesH} onChange={setFilesH} label="Resize the file list" />
      {peek && (
        <ItemPeek
          canvasId={canvasId}
          itemId={peek.itemId}
          // Clamped so the card is readable off a row near the window's foot;
          // it opens to the row's right, clear of the rail.
          style={{ left: peek.x, top: Math.min(Math.max(peek.y, 12), window.innerHeight - 240) }}
        />
      )}
    </section>
  );
}
