import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Actor } from "@isocan/core";
import { FILE_PROP, cleanFilePath, workbenchItemPath } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { screenToWorld } from "../lib/viewport.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { addFiles } from "../lib/upload.ts";
import { sendOp } from "../lib/api.ts";
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
  // See `BindDirectory` — a picker inside a clamped section is a keyhole.
  const [browsing, setBrowsing] = useState(false);

  // Bumped when a directory is bound, so the pane re-reads without a reload.
  const [reloadToken, setReloadToken] = useState(0);
  const reload = () => setReloadToken((n) => n + 1);

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
  }, [canvasId, reloadToken]);

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
      if (ids[0]) {
        /**
         * **The item that just arrived IS that file**, so it says so.
         *
         * This closes the round trip that was open in one direction: `＋`
         * carried a file onto the canvas and the canvas then had no idea
         * where it came from, so `isocan save` could not put it back. The
         * path is the canvas's fact about the item (`FILE_PROP`,
         * `docs/projects/workbench/files-on-disk.md`) and rides the same
         * `item.update` every other property does.
         *
         * A separate op rather than part of the add: `addFiles` is the
         * shared upload path every drop and paste uses, and threading a
         * property through it would put a workbench concern in everybody's
         * gesture.
         */
        const where = cleanFilePath(entry.path);
        if (where) {
          void sendOp(canvasId, actor, {
            type: "item.update",
            itemId: ids[0],
            patch: { properties: { [FILE_PROP]: where } },
          });
        }
        goStage(navigate, workbenchItemPath(canvasId, ids[0]));
      }
    } finally {
      setAdding(null);
    }
  }

  return (
    <section
      className="wb-files"
      aria-label="Files in the directory bound to this canvas"
      style={{ maxHeight: browsing ? Math.max(filesH, 340) : filesH }}
    >
      {/**
       * **The header names the DIRECTORY, not the idea of files.**
       *
       * It said "Files", and so does the canvas's own panel three feet away
       * — which lists every item ON THE CANVAS. Two panels, one word, two
       * different sets, and the failure is silent: a canvas holding ten
       * screens beside a repo holding one `index.html` shows one file here
       * and looks broken. It was reported as exactly that.
       *
       * So this says which folder it is showing, with the full path on
       * hover, and a quiet "on disk" to draw the line the word could not.
       *
       * UNBOUND there is no folder to name, and the fallback used to be the
       * plain word "Files" — which is the collision again, in the one state
       * where it does the most damage: a canvas with twelve items showing a
       * section called FILES that is empty. "Directory" names the thing that
       * is missing (a folder on this machine) rather than the thing that is
       * not (the canvas's items), so the empty state reads as "nothing is
       * bound yet" instead of "your files are gone".
       */}
      <h3>
        {tree.state === "ready" ? (
          <>
            <span title={tree.root}>{tree.root.split("/").filter(Boolean).pop()}/</span>
            <i className="wb-files-hint">on disk</i>
          </>
        ) : (
          "Directory"
        )}
      </h3>
      {tree.state === "loading" && <p className="wb-quiet">Reading the tree…</p>}
      {tree.state === "none" && <BindDirectory canvasId={canvasId} note={tree.note} onBound={reload} onBrowsing={setBrowsing} />}
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

/**
 * **Attaching a directory, without a terminal.**
 *
 * The pane used to end here with a sentence naming a command — "no directory
 * is bound to this canvas on this machine (isocan use <canvas>)" — which is a
 * dead end that tells you to leave.
 *
 * A path typed rather than picked, and that is the finding rather than a
 * shortcut: a directory chosen through the File System Access API arrives as
 * a handle that exposes `kind` and `name` and NEVER a path, by design, so it
 * cannot be written into the roster and cannot become a binding the CLI or an
 * agent can see. The daemon is the only party that can name a directory, so
 * the browser asks and the daemon does — through the same functions
 * `isocan use` calls. See `docs/research/2026-08-26-attaching-a-directory.md`.
 *
 * Every refusal from that route is its own sentence and is shown verbatim: a
 * path that is not there, a file where a directory belongs, a directory that
 * already belongs to another canvas. Being told "no" without being told which
 * "no" is how a person ends up guessing at their own filesystem.
 */
function BindDirectory({
  canvasId,
  note,
  onBound,
  onBrowsing,
}: {
  canvasId: string;
  note: string;
  onBound: () => void;
  /** Browsing needs more room than the clamped section gives. */
  onBrowsing: (open: boolean) => void;
}) {
  const [path, setPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState(false);
  // The files section is height-clamped and draggable; a picker opened inside
  // it would be a three-row window onto a filesystem. Browsing asks the
  // section for room and gives it back on close — the person's own dragged
  // height is untouched.
  useEffect(() => {
    onBrowsing(browsing);
  }, [browsing, onBrowsing]);

  // Only the owner's own machine can bind at all, and the daemon says so with
  // this code — there is nothing to offer a person looking at somebody else's
  // canvas but the explanation.
  const canBind = !note.includes("live with its home daemon");

  async function bind() {
    if (busy || path.trim() === "") return;
    setBusy(true);
    setRefusal(null);
    try {
      const res = await fetch(`/api/projects/${canvasId}/bind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const body = (await res.json().catch(() => null)) as
        | { error?: string; root?: string }
        | null;
      if (!res.ok) {
        setRefusal(body?.error ?? "that directory could not be bound");
        return;
      }
      setPath("");
      onBound();
    } catch {
      setRefusal("the daemon did not answer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wb-bind">
      <p className="wb-quiet">{note}</p>
      {canBind && (
        <>
          <div className="wb-bind-row">
            <input
              className="text-input"
              placeholder="/path/to/your/project"
              aria-label="Directory to bind to this canvas"
              value={path}
              disabled={busy}
              onChange={(e) => setPath(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation(); // canvas shortcuts are not for this field
                if (e.key === "Enter") void bind();
                if (e.key === "Escape") setPath("");
              }}
            />
            {/* For everyone who does not have the path in their head. It fills
                the field rather than binding on the spot, so the gesture ends
                where the typed one does — you can see what you picked before
                it becomes a fact. */}
            <button
              className="btn"
              title="Browse for it"
              aria-label="Browse for a directory"
              onClick={() => setBrowsing((open) => !open)}
            >
              …
            </button>
            <button className="btn" disabled={busy || path.trim() === ""} onClick={() => void bind()}>
              {busy ? "…" : "Attach"}
            </button>
          </div>
          {browsing && (
            <Picker
              canvasId={canvasId}
              at={path.trim() || null}
              // Picking ends the gesture: the filled field and a live Attach
              // are the clear end state, and an open picker under them
              // competes with the button for the next click. One press
              // reopens it if the choice was wrong.
              onPick={(picked) => {
                setPath(picked);
                setBrowsing(false);
              }}
            />
          )}
          {refusal ? (
            <p className="wb-bind-refusal">{refusal}</p>
          ) : (
            <p className="wb-quiet">
              The folder this canvas is about — a repo binds at its root. Same as
              <code> isocan use</code>, so the CLI and your agents see it too.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * **Browsing for the directory**, one level at a time, from `$HOME` down.
 *
 * It fills the field rather than binding: picking and committing stay two
 * gestures, so what you chose is visible as a path before it becomes a fact —
 * and the typed route and the browsed route end in exactly the same place.
 *
 * Directory names only, and that is the daemon's rule rather than this
 * component's taste (`pickList` in server/tree.ts): this is the first
 * enumeration surface the daemon has, so it lists no files, never recurses,
 * and cannot leave `$HOME`. A directory already bound to something is shown
 * as such instead of being offered and then refused.
 */
/** The last of a path, with an ellipsis for what was cut — see the call. */
function tailOf(dir: string, keep = 34): string {
  return dir.length <= keep ? dir : `…${dir.slice(dir.length - keep + 1)}`;
}

function Picker({
  canvasId,
  at,
  onPick,
}: {
  canvasId: string;
  at: string | null;
  onPick: (path: string) => void;
}) {
  const [listing, setListing] = useState<{
    dir: string;
    up: string | null;
    entries: Array<{ name: string; path: string; bound: boolean }>;
  } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // What the picker is showing, which follows what you click — NOT the field,
  // or every keystroke would re-list a directory you are halfway through
  // typing. The field seeds it once, when the picker opens.
  const [where, setWhere] = useState<string | null>(at);

  useEffect(() => {
    let live = true;
    void (async () => {
      const url = where ? `?at=${encodeURIComponent(where)}` : "";
      const res = await fetch(`/api/projects/${canvasId}/pick${url}`);
      if (!live) return;
      if (!res.ok) {
        setNote("there is nothing to list here");
        setListing(null);
        return;
      }
      setNote(null);
      setListing(await res.json());
    })();
    return () => {
      live = false;
    };
  }, [canvasId, where]);

  if (note) return <p className="wb-bind-refusal">{note}</p>;
  if (!listing) return <p className="wb-quiet">Looking…</p>;
  return (
    <div className="wb-pick">
      <div className="wb-pick-at" title={listing.dir}>
        {listing.up && (
          <button className="wb-pick-btn wb-pick-up" onClick={() => setWhere(listing.up)} title="Up one">
            ↑
          </button>
        )}
        {/* Clipped HERE rather than in CSS. `text-overflow` only ever eats the
            tail, and the usual `direction: rtl` workaround reorders the
            neutral characters at a string's edges — a path rendered as
            "Users/dalmaer/" with its leading slash moved to the far end,
            which is what it did. The tail is the part that says where you
            are, so the head is what goes. */}
        <span>{tailOf(listing.dir)}</span>
      </div>
      <ul className="wb-pick-list">
        {listing.entries.length === 0 && <li className="wb-quiet">nothing to show here</li>}
        {listing.entries.map((entry) => (
          <li key={entry.path}>
            {/* One click goes IN; the ✓ takes it. A folder you can enter and
                a folder you can choose are the same folder, so both live on
                the row rather than behind a mode. */}
            <button className="wb-pick-btn wb-pick-in" onClick={() => setWhere(entry.path)}>
              {entry.name}/
            </button>
            {entry.bound ? (
              <span className="wb-pick-bound" title="Already bound to a canvas">
                bound
              </span>
            ) : (
              <button
                className="wb-pick-btn wb-pick-take"
                title={`Use ${entry.path}`}
                onClick={() => onPick(entry.path)}
              >
                ✓
              </button>
            )}
          </li>
        ))}
      </ul>
      <button className="wb-pick-btn wb-pick-take here" onClick={() => onPick(listing.dir)}>
        Use this folder
      </button>
    </div>
  );
}
