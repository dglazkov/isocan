import { useState, type FormEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Actor } from "@isocan/core";
import { MAX_COPY_VARIANTS } from "@isocan/core/copy-variants";
import { selectCreatedItems } from "../lib/groupplacement.ts";
import { varyCopy } from "../lib/varycopy.ts";
import { flashNotice, useCanvasStore } from "../stores/canvasStore.ts";
import { Modal } from "./Modal.tsx";
import "./vary-copy.css";

/**
 * **Vary the copy…** — how many voices, and what for (copy-edit phase 2).
 *
 * Opened from a screen's item menu and from ⌘K, loaded on that click: it
 * mounts its own root on `document.body` (as Compare versions does), so the
 * entry chunk pays for a menu row and nothing else. It asks two things — how
 * many (three unless you say) and, optionally, a brief — and hands them to
 * `varyCopy`, the same core path `isocan words vary` walks. The variants land
 * under the screen, selected; a failure stays in the dialog, in words.
 */
interface VaryRequest {
  canvasId: string;
  actor: Actor;
  itemId: string;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

export function openVaryCopy(request: VaryRequest): void {
  if (!host) {
    host = document.createElement("div");
    host.dataset.varyCopy = "";
    document.body.appendChild(host);
    root = createRoot(host);
  }
  root!.render(<VaryCopy key={request.itemId} {...request} onClose={closeVaryCopy} />);
}

/**
 * *Compare the copy…* (copy-edit phase 3), through this file so the item menu
 * names one lazy import for both copy rows; the panel itself is its own chunk,
 * fetched on this call.
 */
export function openCopyCompare(request: VaryRequest): void {
  void import("./CopyCompare.tsx").then((m) => m.openCopyCompare(request));
}

function closeVaryCopy(): void {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
}

function VaryCopy({ canvasId, actor, itemId, onClose }: VaryRequest & { onClose: () => void }) {
  const title = useCanvasStore((s) => s.canvas?.items[itemId]?.title) ?? "this screen";
  const [n, setN] = useState("3");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const count = Number(n);
  const valid = Number.isInteger(count) && count >= 1 && count <= MAX_COPY_VARIANTS;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    varyCopy(canvasId, actor, itemId, { n: count, ...(brief.trim() ? { brief: brief.trim() } : {}) })
      .then((done) => {
        onClose();
        selectCreatedItems(canvasId, done.itemIds);
        // Placeholder voices already said so in the notice bar, as a problem that stays until seen: not flashed over.
        if (!done.placeholder) flashNotice(`${done.itemIds.length} voice${done.itemIds.length === 1 ? "" : "s"} under “${title}”: ${done.stances.join(", ")} — Compare the copy… on it mixes them (⌘Z takes them back)`, 6000);
      })
      .catch((err: unknown) => {
        setBusy(false);
        setError((err as Error)?.message ?? String(err));
      });
  };

  return (
    <Modal label="Vary the copy" title="Vary the copy" onClose={onClose}>
      <form className="vary-copy" onSubmit={submit}>
        <p className="vary-copy-note">
          Voices for the words of “{title}”: each lands under it as a variation, titled with its stance, with only the words changed.
        </p>
        <label>
          How many voices
          <input type="number" min={1} max={MAX_COPY_VARIANTS} value={n} autoFocus onChange={(e) => setN(e.target.value)} disabled={busy} />
        </label>
        <label>
          For what <span className="vary-copy-optional">(optional)</span>
          <input type="text" value={brief} placeholder="shorter, for a first-time buyer" onChange={(e) => setBrief(e.target.value)} disabled={busy} />
        </label>
        {error && <p className="vary-copy-error" role="alert">{error}</p>}
        <div className="vary-copy-actions">
          <button className="btn primary" type="submit" disabled={!valid || busy}>
            {busy ? `Writing ${count} voice${count === 1 ? "" : "s"}…` : `Write ${valid ? count : ""} voice${count === 1 ? "" : "s"}`}
          </button>
          <button className="btn" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
